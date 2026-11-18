import { AxiosError } from 'axios';
import type { DriverRoute } from '@/features/routes/model';
import { localDay } from '@/lib/format';
import { fetchRoutes } from '@/services/api/driver';
import { store } from '@/services/store';
import { loadRoute, loadRoutes } from '../repository';

/**
 * A lista de rotas abre sem rede, nunca mostra a cópia de outro dia como "de
 * hoje" (salvo a rota em andamento) e não desfaz o que ainda está na fila.
 */

jest.mock('@/services/store', () => {
  const { MemoryStore } = jest.requireActual('@/services/store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('@/services/api/driver', () => ({ fetchRoutes: jest.fn() }));

const rota = (id: number, status: DriverRoute['status'] = 'planned') =>
  ({
    route_id: id,
    status,
    stops: [{ order_id: id * 10, stop_sequence: 1, status: 'planned' }],
  }) as unknown as DriverRoute;

const semRede = () => new AxiosError('Network Error', 'ERR_NETWORK');

beforeEach(async () => {
  jest.clearAllMocks();
  await store.clear();
});

it('atualiza pelo servidor, ordena e esconde as canceladas', async () => {
  jest.mocked(fetchRoutes).mockResolvedValue([rota(3), rota(1), rota(2, 'cancelled')]);
  const view = await loadRoutes();
  expect(view.offline).toBe(false);
  expect(view.routes.map((r) => r.route_id)).toEqual([1, 3]);
  expect(view.fetchedAt).not.toBeNull();
  expect((await loadRoute(3))?.route_id).toBe(3);
});

it('mantém o que está na fila por cima do que veio do servidor', async () => {
  await store.replaceRoutes(localDay(), [rota(1)], 't');
  await store.enqueue(
    { id: 'a', route_id: 1, order_id: null, kind: 'route_start', payload: { occurred_at: 't' } },
    rota(1, 'active'),
  );
  jest.mocked(fetchRoutes).mockResolvedValue([rota(1)]);
  expect((await loadRoutes()).routes[0].status).toBe('active');
});

it('sem rede, mostra a cópia local e avisa', async () => {
  await store.replaceRoutes(localDay(), [rota(1)], 'ontem 18h');
  jest.mocked(fetchRoutes).mockRejectedValue(semRede());
  expect(await loadRoutes()).toEqual({ routes: [rota(1)], fetchedAt: 'ontem 18h', offline: true });
});

it('cópia de outro dia: só a rota em andamento continua visível', async () => {
  await store.replaceRoutes('2020-01-01', [rota(1), rota(2, 'active')], 't');
  jest.mocked(fetchRoutes).mockRejectedValue(semRede());
  expect((await loadRoutes()).routes.map((r) => r.route_id)).toEqual([2]);
});

it('outros erros sobem para a tela', async () => {
  jest
    .mocked(fetchRoutes)
    .mockRejectedValue(new AxiosError('x', '500', undefined, null, { status: 500 } as never));
  await expect(loadRoutes()).rejects.toBeInstanceOf(AxiosError);
});
