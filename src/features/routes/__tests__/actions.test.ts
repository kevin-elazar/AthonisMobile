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

describe('roteiro da rota e validações locais', () => {
  const rotaDuasParadas = {
    ...route(3),
    stops: [
      { order_id: 31, stop_sequence: 1, status: 'planned' },
      { order_id: 32, stop_sequence: 2, status: 'planned' },
    ],
  } as unknown as DriverRoute;

  beforeEach(async () => {
    await store.saveRoute(rotaDuasParadas);
  });

  it('saída, chegada, entrega, ocorrência e encerramento, com o GPS ligado e desligado', async () => {
    const tracking = jest.requireMock('@/services/location/tracking');

    await performRouteAction({ kind: 'route_start', routeId: 3 });
    expect(tracking.startTracking).toHaveBeenCalledWith(3);

    await performRouteAction({ kind: 'stop_arrive', routeId: 3, orderId: 31 });
    await performRouteAction({
      kind: 'stop_deliver',
      routeId: 3,
      orderId: 31,
      notes: '  recebido por Ana  ',
    });
    await performRouteAction({
      kind: 'stop_fail',
      routeId: 3,
      orderId: 32,
      occurrenceType: 'customer_absent',
    });
    const fim = await performRouteAction({ kind: 'route_finish', routeId: 3 });
    expect(fim.status).toBe('completed');
    expect(tracking.stopTracking).toHaveBeenCalled();

    const fila = await store.listOutbox();
    expect(fila.map((item) => item.kind)).toEqual([
      'route_start',
      'stop_arrive',
      'stop_deliver',
      'stop_fail',
      'route_finish',
    ]);
    expect(fila[2].payload.notes).toBe('recebido por Ana');
    expect(fila[3].payload.occurrence_type).toBe('customer_absent');
  });

  it('cancelamento exige rota em andamento e motivo', async () => {
    await expect(
      performRouteAction({ kind: 'route_cancel', routeId: 3, reason: 'chuva' }),
    ).rejects.toThrow('Só é possível cancelar uma rota em andamento.');
    await performRouteAction({ kind: 'route_start', routeId: 3 });
    await expect(
      performRouteAction({ kind: 'route_cancel', routeId: 3, reason: ' x ' }),
    ).rejects.toThrow('Informe o motivo do cancelamento.');
    await performRouteAction({ kind: 'route_cancel', routeId: 3, reason: '  pneu furado ' });
    expect((await store.listOutbox()).at(-1)?.payload.reason).toBe('pneu furado');
  });

  it.each([
    [
      { kind: 'stop_arrive', routeId: 3, orderId: 31 },
      'Inicie a rota antes de registrar paradas.',
      false,
    ],
    [{ kind: 'route_finish', routeId: 3 }, 'A rota não está em andamento.', false],
    [{ kind: 'stop_arrive', routeId: 3, orderId: 99 }, 'Esta parada não faz parte da rota.', true],
    [{ kind: 'stop_fail', routeId: 3, orderId: 31 }, 'Informe o motivo da ocorrência.', true],
    [{ kind: 'route_finish', routeId: 3 }, 'Ainda há 2 parada(s) sem baixa.', true],
    [{ kind: 'route_start', routeId: 404 }, 'Rota não encontrada neste aparelho.', false],
  ] as const)('recusa %j', async (input, mensagem, iniciada) => {
    if (iniciada) await performRouteAction({ kind: 'route_start', routeId: 3 });
    await expect(performRouteAction(input as never)).rejects.toThrow(mensagem);
  });

  it('parada já encerrada e rota sem paradas', async () => {
    await performRouteAction({ kind: 'route_start', routeId: 3 });
    await performRouteAction({ kind: 'stop_deliver', routeId: 3, orderId: 31 });
    await expect(
      performRouteAction({ kind: 'stop_deliver', routeId: 3, orderId: 31 }),
    ).rejects.toThrow('Esta parada já foi encerrada.');

    await store.saveRoute({ ...route(5), stops: [] } as unknown as DriverRoute);
    await expect(performRouteAction({ kind: 'route_start', routeId: 5 })).rejects.toThrow(
      'A rota não tem paradas.',
    );
  });
});
