import type { DriverRoute } from '@/features/routes/model';
import { store } from '@/services/store';
import { performRouteAction } from '../actions';

jest.mock('@/services/store', () => {
  const { MemoryStore: Store } = jest.requireActual('@/services/store/memory-store');
  return { store: new Store() };
});

jest.mock('@/services/location/tracking', () => ({
  lastKnownPosition: jest.fn(async () => undefined),
  startTracking: jest.fn(async () => 'off'),
  stopTracking: jest.fn(async () => undefined),
}));

jest.mock('@/services/sync', () => ({
  refreshSyncCounts: jest.fn(async () => undefined),
  requestSync: jest.fn(async () => undefined),
}));

let mockCounter = 0;
jest.mock('@/lib/uuid', () => ({
  uuid: () => {
    mockCounter += 1;
    return `evt-${mockCounter}`;
  },
}));

const route = (routeId: number): DriverRoute =>
  ({
    route_id: routeId,
    status: 'planned',
    planned_date: '2026-10-08',
    region: null,
    simulated: false,
    total_distance_m: null,
    total_duration_min: null,
    started_at: null,
    finished_at: null,
    vehicle: null,
    stops: [{ order_id: routeId * 10 + 1, stop_sequence: 1, status: 'planned' }],
  }) as unknown as DriverRoute;

beforeEach(async () => {
  await store.clear();
  await store.replaceRoutes('2026-10-08', [route(1), route(2)], '2026-10-08T11:00:00.000Z');
});

describe('performRouteAction', () => {
  it('toque duplo em "Iniciar rota" enfileira uma saída só', async () => {
    const results = await Promise.allSettled([
      performRouteAction({ kind: 'route_start', routeId: 1 }),
      performRouteAction({ kind: 'route_start', routeId: 1 }),
    ]);

    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect((results[1] as PromiseRejectedResult).reason.message).toBe('Esta rota já foi iniciada.');
    expect(await store.listOutbox()).toHaveLength(1);
    expect((await store.getRoute(1))?.status).toBe('active');
  });

  it('uma ação recusada não trava as próximas da mesma rota', async () => {
    await expect(performRouteAction({ kind: 'route_finish', routeId: 1 })).rejects.toThrow();
    await expect(performRouteAction({ kind: 'route_start', routeId: 1 })).resolves.toMatchObject({
      status: 'active',
    });
  });

  it('rotas diferentes não esperam uma pela outra', async () => {
    await Promise.all([
      performRouteAction({ kind: 'route_start', routeId: 1 }),
      performRouteAction({ kind: 'route_start', routeId: 2 }),
    ]);

    expect((await store.listOutbox()).map((item) => item.route_id).sort()).toEqual([1, 2]);
  });
});
