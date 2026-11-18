import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';
import type { DriverRoute } from '@/features/routes/model';
import { getLocationConsent, waitForConsentDecision } from '@/features/consent/location-consent';
import {
  requestTrackingPermissions,
  startTracking,
  stopTracking,
} from '@/services/location/tracking';
import { store } from '@/services/store';
import LocationConsentScreen from '../(app)/location-consent';
import RouteScreen from '../(app)/route/[id]';

/**
 * As duas telas do início da rota: a de consentimento (LGPD) abre antes da
 * primeira saída, e a da rota registra saída e encerramento pela fila local.
 */

jest.mock('@/services/store', () => {
  const { MemoryStore } = jest.requireActual('@/services/store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('@/services/session', () => ({ getSession: () => ({ user: { id: 7 } }) }));
jest.mock('@/services/location/tracking', () => ({
  lastKnownPosition: jest.fn(async () => undefined),
  startTracking: jest.fn(async () => 'background'),
  stopTracking: jest.fn(async () => undefined),
  requestTrackingPermissions: jest.fn(async () => 'background'),
}));
jest.mock('@/services/sync', () => ({
  refreshSyncCounts: jest.fn(async () => undefined),
  requestSync: jest.fn(async () => undefined),
  onRoutesChanged: () => () => undefined,
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => undefined) }));

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
};
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

const stop = (orderId: number, sequence: number, status = 'planned') => ({
  order_id: orderId,
  stop_sequence: sequence,
  status,
  title: `Pedido ${orderId}`,
  description: null,
  invoice_number: null,
  quantity: 1,
  urgency: 'normal',
  delivery_window: sequence === 1 ? '08:00–10:00' : null,
  client_name: `Cliente ${sequence}`,
  client_phone: null,
  address: {
    street: 'Rua A',
    number: '1',
    complement: null,
    district: 'Centro',
    city: 'Jaraguá do Sul',
    state: 'SC',
    zipcode: null,
  },
  latitude: null,
  longitude: null,
  planned_arrival: sequence === 2 ? '2026-11-17T13:30:00Z' : null,
  arrived_at: null,
  completed_at: status === 'planned' ? null : '2026-11-17T12:10:00Z',
  occurrence_type: status === 'failed' ? 'customer_absent' : null,
  notes: null,
});

const rota = (extra: Partial<DriverRoute> = {}): DriverRoute =>
  ({
    route_id: 9,
    status: 'planned',
    planned_date: '2026-11-17',
    region: 'Nereu Ramos',
    simulated: true,
    total_distance_m: 18500,
    total_duration_min: 95,
    started_at: null,
    finished_at: null,
    vehicle: { vehicle_id: 1, name: 'Van', plate: 'ABC1D23' },
    stops: [stop(91, 1), stop(92, 2)],
    ...extra,
  }) as DriverRoute;

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await store.clear();
  mockParams = { id: '9' };
});

describe('tela de consentimento', () => {
  it('permitir grava a decisão, pede a permissão do sistema e avisa quem esperava', async () => {
    const decisao = waitForConsentDecision();
    render(<LocationConsentScreen />);
    expect(screen.getByText('Registro do trajeto da rota')).toBeTruthy();
    expect(screen.getByText('O que é registrado')).toBeTruthy();

    fireEvent.press(screen.getByTestId('consent-accept'));
    await expect(decisao).resolves.toBe(true);
    expect(requestTrackingPermissions).toHaveBeenCalled();
    expect((await getLocationConsent())?.accepted).toBe(true);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('"agora não" grava a recusa e desliga o rastreamento', async () => {
    const decisao = waitForConsentDecision();
    render(<LocationConsentScreen />);
    fireEvent.press(screen.getByTestId('consent-decline'));
    await expect(decisao).resolves.toBe(false);
    expect(stopTracking).toHaveBeenCalled();
    expect(requestTrackingPermissions).not.toHaveBeenCalled();
    expect((await getLocationConsent())?.accepted).toBe(false);
  });

  it('fechar sem escolher vale como "agora não" e não grava nada', async () => {
    const decisao = waitForConsentDecision();
    const tela = render(<LocationConsentScreen />);
    tela.unmount();
    await expect(decisao).resolves.toBe(false);
    expect(await getLocationConsent()).toBeNull();
  });

  it('abre a política de privacidade', async () => {
    const { openBrowserAsync } = jest.requireMock('expo-web-browser');
    render(<LocationConsentScreen />);
    fireEvent.press(screen.getByTestId('consent-policy'));
    expect(openBrowserAsync).toHaveBeenCalledWith(expect.stringContaining('/privacidade'));
  });
});

describe('tela da rota', () => {
  it('rota que não está no aparelho mostra o aviso e volta à lista', async () => {
    renderWithQuery(<RouteScreen />);
    fireEvent.press(await screen.findByText('Voltar para as rotas'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('primeira saída abre o consentimento antes de iniciar', async () => {
    await store.saveRoute(rota());
    renderWithQuery(<RouteScreen />);

    expect(await screen.findByText('Nereu Ramos')).toBeTruthy();
    expect(screen.getByText(/Rota estimada/)).toBeTruthy();
    expect(screen.getByText(/ABC1D23/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('route-start'));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/location-consent'));
    // Toque duplo enquanto a tela de consentimento está aberta: ignorado.
    fireEvent.press(screen.getByTestId('route-start'));

    // O motorista permite na outra tela.
    const { resolveConsentDecision, saveLocationConsent } = jest.requireActual(
      '@/features/consent/location-consent',
    );
    await act(async () => {
      await saveLocationConsent(true);
      resolveConsentDecision(true);
    });

    expect(await screen.findByTestId('route-next-stop')).toBeTruthy();
    expect(startTracking).toHaveBeenCalledWith(9);
    expect(await store.listOutbox()).toHaveLength(1);
    expect(mockRouter.push).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('route-next-stop'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/stop/[orderId]',
      params: { orderId: 91, routeId: 9 },
    });

    fireEvent.press(screen.getByTestId('stop-row-92'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/stop/[orderId]',
      params: { orderId: 92, routeId: 9 },
    });

    fireEvent.press(screen.getByTestId('route-cancel'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/cancel-route',
      params: { routeId: 9 },
    });
  });

  it('com consentimento já dado, inicia direto; recusa da validação aparece na tela', async () => {
    const { saveLocationConsent } = jest.requireActual('@/features/consent/location-consent');
    await saveLocationConsent(false);
    await store.saveRoute(rota({ stops: [] }));
    renderWithQuery(<RouteScreen />);

    fireEvent.press(await screen.findByTestId('route-start'));
    expect(await screen.findByText('A rota não tem paradas.')).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('com todas as paradas baixadas, encerra após confirmar e mostra o resumo', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botoes) => {
      botoes?.find((b) => b.text === 'Encerrar')?.onPress?.();
    });
    await store.saveRoute(
      rota({
        status: 'active',
        simulated: false,
        started_at: '2026-11-17T11:00:00Z',
        stops: [stop(91, 1, 'delivered'), stop(92, 2, 'failed')] as never,
      }),
    );
    renderWithQuery(<RouteScreen />);

    fireEvent.press(await screen.findByTestId('route-finish'));
    expect(await screen.findByTestId('route-summary')).toBeTruthy();
    expect(screen.getByText(/1 entrega concluída · 1 ocorrência/)).toBeTruthy();
    expect(alerta).toHaveBeenCalledWith(
      'Encerrar a rota?',
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
    expect(stopTracking).toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('encerramento cancelado no diálogo não faz nada', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botoes) => {
      botoes?.find((b) => b.text === 'Cancelar')?.onPress?.();
    });
    await store.saveRoute(
      rota({
        status: 'active',
        stops: [stop(91, 1, 'delivered'), stop(92, 2, 'delivered')] as never,
      }),
    );
    renderWithQuery(<RouteScreen />);
    fireEvent.press(await screen.findByTestId('route-finish'));
    await waitFor(() => expect(alerta).toHaveBeenCalled());
    expect(await store.listOutbox()).toHaveLength(0);
    alerta.mockRestore();
  });
});
