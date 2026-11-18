import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert, Linking } from 'react-native';
import type { DriverRoute } from '@/features/routes/model';
import { login, logoutRemote } from '@/services/api/client';
import { stopTracking } from '@/services/location/tracking';
import { store } from '@/services/store';
import { clearSession } from '@/services/session';
import { stopSync } from '@/services/sync';
import CancelRouteScreen from '../(app)/cancel-route';
import OccurrenceScreen from '../(app)/occurrence';
import ProfileScreen from '../(app)/profile';
import StopScreen from '../(app)/stop/[orderId]';
import LoginScreen from '../(auth)/login';

/**
 * Telas da baixa (parada, ocorrência, cancelamento) e da conta (login,
 * perfil). As ações passam pela fila local de verdade; só a rede, o GPS e a
 * navegação são simulados.
 */

jest.mock('@/services/store', () => {
  const { MemoryStore } = jest.requireActual('@/services/store/memory-store');
  return { store: new MemoryStore() };
});
const mockSession = {
  accessToken: 'a',
  refreshToken: 'r',
  user: { id: 7, email: 'motorista@x.com', name: 'João', driverId: 3, idCompany: 1 },
};
let mockExpired = false;
jest.mock('@/services/session', () => ({
  getSession: () => mockSession,
  useSession: () => ({ hydrated: true, session: mockSession, expired: mockExpired }),
  clearSession: jest.fn(async () => undefined),
}));
jest.mock('@/services/location/tracking', () => ({
  lastKnownPosition: jest.fn(async () => ({ latitude: -26.4, longitude: -49.1 })),
  startTracking: jest.fn(async () => 'background'),
  stopTracking: jest.fn(async () => undefined),
  trackingMode: jest.fn(async () => 'background'),
}));
let mockSync = {
  pending: 0,
  rejected: 0,
  pings: 0,
  syncing: false,
  online: true,
  lastSyncAt: null,
};
jest.mock('@/services/sync', () => ({
  refreshSyncCounts: jest.fn(async () => undefined),
  requestSync: jest.fn(async () => undefined),
  stopSync: jest.fn(async () => undefined),
  onRoutesChanged: () => () => undefined,
  useSyncState: () => mockSync,
}));
jest.mock('@/services/api/client', () => ({
  login: jest.fn(),
  logoutRemote: jest.fn(async () => undefined),
}));
jest.mock('@/services/api/driver', () => ({
  fetchProfile: jest.fn(async () => ({
    user: { id: 7, email: 'motorista@x.com', name: 'João' },
    driver: { driver_id: 3, name: 'João da Silva', phone: null, status: 'available' },
    company: { id_company: 1, name: 'Forte Acessórios', timezone: 'America/Sao_Paulo' },
  })),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => undefined) }));
jest.mock('expo-device', () => ({ manufacturer: 'Motorola', modelName: 'G54' }));

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
    Stack: { Screen: () => null },
  };
});

const stop = (orderId: number, sequence: number, status = 'planned') => ({
  order_id: orderId,
  stop_sequence: sequence,
  status,
  title: `Pedido ${orderId}`,
  description: 'Caixas de corrediças',
  invoice_number: 'NF 123',
  quantity: 4,
  urgency: 'normal',
  delivery_window: '08:00–10:00',
  client_name: `Cliente ${sequence}`,
  client_phone: '(47) 3370-1234',
  address: {
    street: 'Rua A',
    number: String(sequence),
    complement: null,
    district: 'Centro',
    city: 'Jaraguá do Sul',
    state: 'SC',
    zipcode: null,
  },
  latitude: -26.48,
  longitude: -49.06,
  planned_arrival: null,
  arrived_at: null,
  completed_at: status === 'planned' ? null : '2026-11-17T12:10:00Z',
  occurrence_type: status === 'failed' ? 'customer_absent' : null,
  notes: null,
});

const rota = (extra: Partial<DriverRoute> = {}): DriverRoute =>
  ({
    route_id: 9,
    status: 'active',
    planned_date: '2026-11-17',
    region: 'Centro',
    simulated: false,
    total_distance_m: 1000,
    total_duration_min: 30,
    started_at: '2026-11-17T11:00:00Z',
    finished_at: null,
    vehicle: null,
    stops: [stop(91, 1), stop(92, 2)],
    ...extra,
  }) as DriverRoute;

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Responde o diálogo nativo apertando o botão com este texto. */
const responder = (texto: string) =>
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botoes) => {
    botoes?.find((b) => b.text === texto)?.onPress?.();
  });

let openURL: jest.SpyInstance;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await store.clear();
  await store.saveRoute(rota());
  mockParams = { routeId: '9', orderId: '91' };
  mockExpired = false;
  mockSync = { pending: 0, rejected: 0, pings: 0, syncing: false, online: true, lastSyncAt: null };
});

describe('parada', () => {
  it('mostra o pedido, navega, liga, registra chegada e entrega', async () => {
    responder('Entregue');
    renderWithQuery(<StopScreen />);

    expect(await screen.findByText('Cliente 1')).toBeTruthy();
    expect(screen.getByText('Caixas de corrediças')).toBeTruthy();

    fireEvent.press(screen.getByTestId('stop-navigate'));
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('google.com/maps/dir'));
    fireEvent.press(screen.getByLabelText('Ligar'));
    expect(openURL).toHaveBeenCalledWith('tel:4733701234');

    fireEvent.press(screen.getByTestId('stop-arrive'));
    await waitFor(async () => expect(await store.listOutbox()).toHaveLength(1));

    fireEvent.changeText(screen.getByTestId('stop-notes'), 'recebido pelo porteiro');
    fireEvent.press(screen.getByTestId('stop-deliver'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());

    const fila = await store.listOutbox();
    expect(fila.map((item) => item.kind)).toEqual(['stop_arrive', 'stop_deliver']);
    expect(fila[1].payload).toMatchObject({ notes: 'recebido pelo porteiro', latitude: -26.4 });
  });

  it('"não foi possível entregar" leva à ocorrência com a observação', async () => {
    renderWithQuery(<StopScreen />);
    fireEvent.changeText(await screen.findByTestId('stop-notes'), 'portão fechado');
    fireEvent.press(screen.getByTestId('stop-fail'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/occurrence',
      params: { routeId: 9, orderId: 91, notes: 'portão fechado' },
    });
  });

  it('parada encerrada mostra o resultado, sem ações', async () => {
    await store.saveRoute(rota({ stops: [stop(91, 1, 'failed'), stop(92, 2)] as never }));
    renderWithQuery(<StopScreen />);
    expect(await screen.findByTestId('stop-result')).toBeTruthy();
    expect(screen.queryByTestId('stop-deliver')).toBeNull();
  });

  it('rota ainda não iniciada: a validação local aparece na tela', async () => {
    await store.saveRoute(rota({ status: 'planned' }));
    renderWithQuery(<StopScreen />);
    expect(await screen.findByText('Cliente 1')).toBeTruthy();
    expect(screen.queryByTestId('stop-deliver')).toBeNull();
  });

  it('parada que saiu da rota volta para a lista', async () => {
    mockParams = { routeId: '9', orderId: '999' };
    renderWithQuery(<StopScreen />);
    fireEvent.press(await screen.findByText('Voltar para as rotas'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});

describe('ocorrência', () => {
  it('exige o motivo e, em "outro", a descrição; registra e volta para a rota', async () => {
    renderWithQuery(<OccurrenceScreen />);
    const enviar = screen.getByTestId('occurrence-submit');
    expect(enviar.props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('occurrence-other'));
    expect(screen.getByText('Descreva o motivo')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('occurrence-notes'), 'cliente pediu outro dia');
    fireEvent.press(screen.getByTestId('occurrence-customer_absent'));
    fireEvent.press(screen.getByTestId('occurrence-submit'));

    await waitFor(() =>
      expect(mockRouter.dismissTo).toHaveBeenCalledWith({
        pathname: '/route/[id]',
        params: { id: 9 },
      }),
    );
    const [item] = await store.listOutbox();
    expect(item.payload).toMatchObject({
      occurrence_type: 'customer_absent',
      notes: 'cliente pediu outro dia',
    });
  });

  it('recusa da validação aparece na tela', async () => {
    await store.saveRoute(rota({ status: 'planned' }));
    renderWithQuery(<OccurrenceScreen />);
    fireEvent.press(screen.getByTestId('occurrence-refused'));
    fireEvent.press(screen.getByTestId('occurrence-submit'));
    expect(await screen.findByText('Inicie a rota antes de registrar paradas.')).toBeTruthy();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });
});

describe('cancelamento da rota', () => {
  it('pede o motivo, confirma e volta para as rotas do dia', async () => {
    mockParams = { routeId: '9' };
    const alerta = responder('Cancelar rota');
    renderWithQuery(<CancelRouteScreen />);

    fireEvent.press(await screen.findByText('Outro motivo'));
    fireEvent.changeText(screen.getByTestId('cancel-route-details'), 'pneu furado na BR-280');
    fireEvent.press(screen.getByTestId('cancel-route-submit'));

    await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalledWith('/'));
    expect(alerta.mock.calls[0][1]).toContain('2 paradas em aberto voltam');
    const [item] = await store.listOutbox();
    expect(item.payload.reason).toBe('Outro motivo: pneu furado na BR-280');
    expect(stopTracking).toHaveBeenCalled();
  });

  it('"voltar" no diálogo não cancela; falha aparece na tela', async () => {
    mockParams = { routeId: '9' };
    responder('Voltar');
    renderWithQuery(<CancelRouteScreen />);
    fireEvent.press(await screen.findByText('Problema de saúde'));
    fireEvent.press(screen.getByTestId('cancel-route-submit'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(await store.listOutbox()).toHaveLength(0);

    jest.restoreAllMocks();
    responder('Cancelar rota');
    await store.saveRoute(rota({ status: 'planned' }));
    fireEvent.press(screen.getByTestId('cancel-route-submit'));
    expect(await screen.findByText('Só é possível cancelar uma rota em andamento.')).toBeTruthy();
  });
});

describe('login', () => {
  it('valida os campos antes de chamar o servidor', async () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Informe o e-mail')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('entra com o nome do aparelho e mostra senha errada de forma clara', async () => {
    const { AxiosError } = jest.requireActual('axios');
    jest
      .mocked(login)
      .mockRejectedValueOnce(new AxiosError('x', '401', undefined, null, { status: 401, data: {} }))
      .mockResolvedValueOnce(mockSession);
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByTestId('login-email'), 'motorista@x.com');
    fireEvent.changeText(screen.getByTestId('login-password'), 'errada');
    fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeTruthy();
    expect(jest.mocked(login).mock.calls[0].slice(0, 3)).toEqual([
      'motorista@x.com',
      'errada',
      'Motorola G54',
    ]);

    fireEvent.press(screen.getByTestId('login-submit'));
    await waitFor(() => expect(login).toHaveBeenCalledTimes(2));
  });

  it('avisa quando a sessão expirou', () => {
    mockExpired = true;
    render(<LoginScreen />);
    expect(screen.getByText(/Sua sessão expirou/)).toBeTruthy();
  });
});

describe('perfil', () => {
  it('mostra motorista, empresa, consentimento e permissões', async () => {
    const { saveLocationConsent } = jest.requireActual('@/features/consent/location-consent');
    await saveLocationConsent(true, new Date(2026, 10, 16, 9, 5));
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    renderWithQuery(<ProfileScreen />);

    expect(await screen.findByText('João da Silva')).toBeTruthy();
    expect(screen.getByText('Forte Acessórios')).toBeTruthy();
    expect(
      await screen.findByText('Registro de trajeto permitido em 16/11/2026 às 09:05.'),
    ).toBeTruthy();
    expect(await screen.findByText('Ligado, inclusive com a tela apagada')).toBeTruthy();

    fireEvent.press(screen.getByTestId('profile-consent'));
    expect(mockRouter.push).toHaveBeenCalledWith('/location-consent');
    fireEvent.press(screen.getByLabelText('Permissões do aparelho'));
    expect(settings).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('profile-policy'));
    const { openBrowserAsync } = jest.requireMock('expo-web-browser');
    expect(openBrowserAsync).toHaveBeenCalledWith(expect.stringContaining('/privacidade'));
  });

  it('sair: para GPS e fila, revoga no servidor, apaga o aparelho e encerra a sessão', async () => {
    responder('Sair');
    await store.setValue('x', '1');
    renderWithQuery(<ProfileScreen />);
    expect(
      await screen.findByText('Você ainda não decidiu sobre o registro de trajeto.'),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId('profile-logout'));
    await waitFor(() => expect(clearSession).toHaveBeenCalled());
    expect(stopTracking).toHaveBeenCalled();
    expect(stopSync).toHaveBeenCalled();
    expect(logoutRemote).toHaveBeenCalledWith('r');
    expect(await store.getValue('x')).toBeNull();
  });

  it('com dados não enviados, avisa antes de sair e respeita o "cancelar"', async () => {
    mockSync = { ...mockSync, pending: 2, pings: 30 };
    const alerta = responder('Cancelar');
    renderWithQuery(<ProfileScreen />);
    expect(await screen.findByText(/aguardando envio/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('profile-logout'));
    await waitFor(() => expect(alerta).toHaveBeenCalled());
    expect(alerta.mock.calls[0][0]).toBe('Sair e perder o que não foi enviado?');
    expect(clearSession).not.toHaveBeenCalled();
  });
});
