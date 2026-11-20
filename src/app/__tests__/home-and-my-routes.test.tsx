import { fireEvent, render, screen } from '@testing-library/react-native';
import type { DriverRoute } from '@/features/routes/model';
import { addDays } from '@/features/routes/summary';
import { localDay } from '@/lib/format';
import { openNavigation, openPhone } from '@/lib/maps';
import HomeScreen from '../(app)/index';
import MyRoutesScreen from '../(app)/my-routes';

/**
 * Tela inicial (resumo do dia e próxima parada) e a lista "Minhas rotas"
 * (próximas, anteriores e resumo da semana).
 */

const mockRoutes = { current: {} as Record<string, unknown> };
const mockMyRoutes = { current: {} as Record<string, unknown> };
jest.mock('@/features/routes/hooks', () => ({
  useRoutes: () => mockRoutes.current,
  useMyRoutes: () => mockMyRoutes.current,
}));
jest.mock('@/services/session', () => ({
  useSession: () => ({ session: { user: { name: 'Carla Souza' } } }),
}));
jest.mock('@/lib/maps', () => ({
  formatAddress: () => 'Rua A, 1 — Centro',
  openNavigation: jest.fn(async () => undefined),
  openPhone: jest.fn(async () => undefined),
}));
const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  Stack: { Screen: () => null },
}));

const hoje = localDay();

const stop = (orderId: number, sequence: number, status = 'planned') => ({
  order_id: orderId,
  stop_sequence: sequence,
  status,
  title: `Pedido ${orderId}`,
  description: null,
  invoice_number: 'NF-77',
  quantity: 3,
  urgency: 'normal',
  delivery_window: '08:00 - 12:00',
  client_name: `Cliente ${sequence}`,
  client_phone: '(47) 3370-0000',
  address: {
    street: 'Rua A',
    number: '1',
    complement: 'Galpão 2',
    district: 'Centro',
    city: 'Jaraguá do Sul',
    state: 'SC',
    zipcode: '89251-000',
  },
  latitude: null,
  longitude: null,
  planned_arrival: null,
  arrived_at: null,
  completed_at: null,
  occurrence_type: null,
  notes: null,
});

const rota = (id: number, extra: Partial<DriverRoute> = {}): DriverRoute =>
  ({
    route_id: id,
    status: 'planned',
    planned_date: hoje,
    region: 'Jaraguá do Sul',
    simulated: false,
    total_distance_m: 12000,
    total_duration_min: 120,
    started_at: null,
    finished_at: null,
    vehicle: { vehicle_id: 1, name: 'Van', plate: 'ABC1D23' },
    stops: [stop(id * 10 + 1, 1), stop(id * 10 + 2, 2)],
    ...extra,
  }) as DriverRoute;

const query = (data: unknown, extra: Record<string, unknown> = {}) => ({
  data,
  error: null,
  isPending: false,
  isRefetching: false,
  refetch: jest.fn(),
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('tela inicial', () => {
  it('mostra o resumo do dia e a próxima parada com atalhos', () => {
    mockRoutes.current = query({
      routes: [
        rota(1, {
          status: 'active',
          started_at: new Date().toISOString(),
          stops: [stop(11, 1, 'delivered'), stop(12, 2)],
        }),
      ],
      fetchedAt: null,
      offline: false,
    });
    render(<HomeScreen />);

    expect(screen.getByTestId('today-summary')).toBeTruthy();
    expect(screen.getByText('parada a fazer')).toBeTruthy();
    expect(screen.getByText(/término previsto às/)).toBeTruthy();

    expect(screen.getByText('PRÓXIMA PARADA · 2 DE 2')).toBeTruthy();
    expect(screen.getByText(/Janela 08:00 - 12:00 · NF NF-77 · 3 volumes/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('next-stop-navigate'));
    expect(openNavigation).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('next-stop-call'));
    expect(openPhone).toHaveBeenCalledWith('(47) 3370-0000');

    fireEvent.press(screen.getByTestId('next-stop-open'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/stop/[orderId]',
      params: { orderId: 12, routeId: 1 },
    });
  });

  it('próxima parada de nova tentativa avisa o que houve na anterior', () => {
    mockRoutes.current = query({
      routes: [
        rota(5, {
          status: 'active',
          started_at: new Date().toISOString(),
          stops: [
            {
              ...stop(51, 1),
              attempt: 2,
              previous_attempt: { route_id: 4, occurred_at: null, occurrence_type: 'refused', notes: null },
            },
          ],
        }),
      ],
      fetchedAt: null,
      offline: false,
    });
    render(<HomeScreen />);
    expect(screen.getByTestId('next-stop-previous-attempt')).toHaveTextContent(
      '2ª tentativa · anterior: Recusado pelo cliente',
    );
  });

  it('sem rota em andamento, não há cartão de próxima parada; o botão abre Minhas rotas', () => {
    mockRoutes.current = query({ routes: [rota(2)], fetchedAt: null, offline: false });
    render(<HomeScreen />);

    expect(screen.queryByTestId('next-stop-card')).toBeNull();
    fireEvent.press(screen.getByTestId('open-my-routes'));
    expect(mockRouter.push).toHaveBeenCalledWith('/my-routes');
  });

  it('sem rotas hoje, sem resumo', () => {
    mockRoutes.current = query({ routes: [], fetchedAt: null, offline: false });
    render(<HomeScreen />);
    expect(screen.queryByTestId('today-summary')).toBeNull();
    expect(screen.getByText('Nenhuma rota para hoje')).toBeTruthy();
  });
});

describe('Minhas rotas', () => {
  it('agrupa hoje, próximas e anteriores, com o resumo da semana', () => {
    mockMyRoutes.current = query([
      rota(3, { planned_date: addDays(hoje, 1) }),
      rota(1, {
        planned_date: addDays(hoje, -1),
        status: 'completed',
        stops: [stop(11, 1, 'delivered'), stop(12, 2, 'failed')],
      }),
      rota(2),
    ]);
    render(<MyRoutesScreen />);

    expect(screen.getByText('Próximas')).toBeTruthy();
    expect(screen.getByText('Anteriores')).toBeTruthy();
    expect(screen.getByText(/^amanhã · /)).toBeTruthy();
    expect(screen.getByText(/^ontem · /)).toBeTruthy();
    expect(screen.getByTestId('week-rate')).toHaveTextContent('Taxa de entrega: 50%');

    fireEvent.press(screen.getByTestId('my-route-3'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/route/[id]', params: { id: 3 } });
  });

  it('sem rotas no período mostra o vazio', () => {
    mockMyRoutes.current = query([]);
    render(<MyRoutesScreen />);
    expect(screen.getByText('Nenhuma rota no período')).toBeTruthy();
    expect(screen.getByText('Nenhuma parada resolvida nos últimos 7 dias.')).toBeTruthy();
  });

  it('sem rede, explica que a lista precisa de internet', () => {
    const { AxiosError } = jest.requireActual('axios');
    mockMyRoutes.current = query(undefined, { error: new AxiosError('Network Error', 'ERR_NETWORK') });
    render(<MyRoutesScreen />);
    expect(screen.getByText('Sem conexão')).toBeTruthy();
  });

  it('carregando', () => {
    mockMyRoutes.current = query(undefined, { isPending: true });
    render(<MyRoutesScreen />);
    expect(screen.getByText('Buscando suas rotas…')).toBeTruthy();
  });
});
