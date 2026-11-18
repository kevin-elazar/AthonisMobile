import { AxiosError } from 'axios';
import type { OutboxItem } from '@/features/sync/model';
import { api } from '../client';
import { fetchProfile, fetchRoute, fetchRoutes, sendAction, sendPings } from '../driver';

/** Contrato com a API `/driver/*`: caminhos, `client_event_id` e validação da resposta. */

jest.mock('../client', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
const get = jest.mocked(api.get);
const post = jest.mocked(api.post);

const rota = {
  route_id: 9,
  status: 'active',
  planned_date: '2026-11-17',
  region: null,
  simulated: false,
  total_distance_m: null,
  total_duration_min: null,
  started_at: null,
  finished_at: null,
  vehicle: null,
  stops: [],
};

const item = (kind: OutboxItem['kind'], orderId: number | null = null): OutboxItem => ({
  id: `evt-${kind}`,
  seq: 1,
  route_id: 9,
  order_id: orderId,
  kind,
  payload: { occurred_at: '2026-11-17T12:00:00Z', latitude: -26.4 },
  status: 'pending',
  attempts: 0,
  next_attempt_at: 0,
  last_error: null,
  created_at: 't',
});

beforeEach(() => jest.clearAllMocks());

it('perfil e rotas do dia', async () => {
  get.mockResolvedValueOnce({
    data: {
      user: { id: 7, email: 'm@x.com', name: 'João' },
      driver: { driver_id: 3, name: 'João', phone: null, status: 'available' },
      company: { id_company: 1, name: 'Forte', timezone: 'America/Sao_Paulo' },
    },
  });
  expect((await fetchProfile()).company.name).toBe('Forte');

  get.mockResolvedValueOnce({ data: [rota] });
  expect(await fetchRoutes()).toHaveLength(1);
  expect(get.mock.calls.map((c) => c[0])).toEqual(['/driver/me', '/driver/routes']);
});

it('rota removida do motorista vira null; outros erros sobem', async () => {
  get.mockResolvedValueOnce({ data: rota });
  expect((await fetchRoute(9))?.route_id).toBe(9);

  get.mockRejectedValueOnce(new AxiosError('x', '404', undefined, null, { status: 404 } as never));
  expect(await fetchRoute(9)).toBeNull();

  get.mockRejectedValueOnce(new AxiosError('x', '500', undefined, null, { status: 500 } as never));
  await expect(fetchRoute(9)).rejects.toBeInstanceOf(AxiosError);
});

it.each([
  ['route_start', null, '/driver/routes/9/start'],
  ['route_finish', null, '/driver/routes/9/finish'],
  ['route_cancel', null, '/driver/routes/9/cancel'],
  ['stop_arrive', 91, '/driver/routes/9/stops/91/arrive'],
  ['stop_deliver', 91, '/driver/routes/9/stops/91/deliver'],
  ['stop_fail', 91, '/driver/routes/9/stops/91/fail'],
] as const)('%s vai para %s com o client_event_id', async (kind, orderId, caminho) => {
  post.mockResolvedValueOnce({ data: rota });
  await sendAction(item(kind, orderId));
  expect(post).toHaveBeenCalledWith(caminho, {
    client_event_id: `evt-${kind}`,
    occurred_at: '2026-11-17T12:00:00Z',
    latitude: -26.4,
  });
});

it('rastro: campos opcionais só quando existem', async () => {
  post.mockResolvedValueOnce({ data: {} });
  await sendPings(9, [
    {
      id: 'p1',
      route_id: 9,
      latitude: 1,
      longitude: 2,
      accuracy_m: 5,
      speed_mps: 3,
      recorded_at: 't1',
    },
    {
      id: 'p2',
      route_id: 9,
      latitude: 1,
      longitude: 2,
      accuracy_m: null,
      speed_mps: null,
      recorded_at: 't2',
    },
  ]);
  expect(post).toHaveBeenCalledWith('/driver/routes/9/locations', {
    points: [
      {
        client_ping_id: 'p1',
        recorded_at: 't1',
        latitude: 1,
        longitude: 2,
        accuracy_m: 5,
        speed_mps: 3,
      },
      { client_ping_id: 'p2', recorded_at: 't2', latitude: 1, longitude: 2 },
    ],
  });
});
