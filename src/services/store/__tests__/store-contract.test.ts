import { mergePending } from '@/features/sync/apply';
import type { DriverRoute } from '@/features/routes/model';
import type { NewOutboxItem, PingRow } from '@/features/sync/model';
import { MemoryStore } from '../memory-store';
import { SqliteStore } from '../sqlite-store';
import type { LocalStore } from '../types';

/**
 * As duas implementações do banco local (SQLite no aparelho, memória no
 * navegador) precisam se comportar igual: o app e os testes do worker usam a
 * de memória, o celular usa a de SQLite. Este mesmo roteiro roda nas duas.
 *
 * O SQLite aqui é o de verdade (`node:sqlite`, embutido no Node 22) por trás
 * de uma casca com a API do expo-sqlite: o SQL do `SqliteStore` — esquema,
 * migração, transações — é executado como no aparelho.
 */
jest.mock('expo-sqlite', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite');

  const flat = (params: unknown[]): (string | number | null)[] =>
    (params.length === 1 && Array.isArray(params[0]) ? params[0] : params).map((value) =>
      value === undefined ? null : (value as string | number | null),
    );

  return {
    openDatabaseAsync: async () => {
      const db = new DatabaseSync(':memory:');
      return {
        execAsync: async (sql: string) => db.exec(sql),
        getFirstAsync: async (sql: string, ...params: unknown[]) =>
          db.prepare(sql).get(...flat(params)) ?? null,
        getAllAsync: async (sql: string, ...params: unknown[]) =>
          db.prepare(sql).all(...flat(params)),
        runAsync: async (sql: string, ...params: unknown[]) => db.prepare(sql).run(...flat(params)),
        withTransactionAsync: async (task: () => Promise<void>) => {
          db.exec('BEGIN');
          try {
            await task();
            db.exec('COMMIT');
          } catch (error) {
            db.exec('ROLLBACK');
            throw error;
          }
        },
      };
    },
  };
});

const stop = (orderId: number, sequence: number) => ({
  order_id: orderId,
  stop_sequence: sequence,
  status: 'planned' as const,
  title: `Entrega ${sequence}`,
  description: null,
  invoice_number: null,
  quantity: 1,
  urgency: 'normal',
  delivery_window: null,
  client_name: `Cliente ${sequence}`,
  client_phone: null,
  address: {
    street: 'Rua das Flores',
    number: String(sequence),
    complement: null,
    district: 'Centro',
    city: 'Jaraguá do Sul',
    state: 'SC',
    zipcode: '89251-000',
  },
  latitude: -26.48,
  longitude: -49.06,
  planned_arrival: null,
  arrived_at: null,
  completed_at: null,
  occurrence_type: null,
  notes: null,
});

const route = (routeId: number, extra: Partial<DriverRoute> = {}): DriverRoute =>
  ({
    route_id: routeId,
    status: 'planned',
    planned_date: '2026-11-17',
    region: 'Jaraguá do Sul',
    simulated: false,
    total_distance_m: 12000,
    total_duration_min: 60,
    started_at: null,
    finished_at: null,
    vehicle: null,
    stops: [stop(routeId * 10 + 1, 1), stop(routeId * 10 + 2, 2)],
    ...extra,
  }) as DriverRoute;

const action = (
  id: string,
  routeId: number,
  kind: NewOutboxItem['kind'],
  orderId: number | null = null,
): NewOutboxItem => ({
  id,
  route_id: routeId,
  order_id: orderId,
  kind,
  payload: { occurred_at: '2026-11-17T12:00:00.000Z', latitude: -26.4, longitude: -49.1 },
});

const ping = (routeId: number, index: number, minute = index): PingRow => ({
  id: `ping-${routeId}-${index}`,
  route_id: routeId,
  latitude: -26.5 + index * 0.001,
  longitude: -49,
  accuracy_m: 5,
  speed_mps: null,
  recorded_at: `2026-11-17T12:${String(minute).padStart(2, '0')}:00.000Z`,
});

describe.each([
  ['memória', () => new MemoryStore()],
  ['SQLite', () => new SqliteStore()],
])('banco local (%s)', (_nome, criar: () => LocalStore) => {
  let store: LocalStore;

  beforeEach(() => {
    store = criar();
  });

  describe('rotas', () => {
    it('começa vazio', async () => {
      expect(await store.getRoutes()).toEqual({ routes: [], day: null, fetchedAt: null });
      expect(await store.getRoute(1)).toBeNull();
    });

    it('substitui a lista, lê, grava e remove uma rota', async () => {
      await store.replaceRoutes('2026-11-17', [route(2), route(1)], '2026-11-17T08:00:00Z');
      const cached = await store.getRoutes();
      expect(cached.routes.map((r) => r.route_id)).toEqual([1, 2]);
      expect(cached.day).toBe('2026-11-17');
      expect(cached.fetchedAt).toBe('2026-11-17T08:00:00Z');

      await store.saveRoute(route(1, { status: 'active' }));
      expect((await store.getRoute(1))?.status).toBe('active');

      await store.removeRoute(2);
      expect(await store.getRoute(2)).toBeNull();

      await store.replaceRoutes('2026-11-18', [route(3)], '2026-11-18T08:00:00Z');
      expect((await store.getRoutes()).routes.map((r) => r.route_id)).toEqual([3]);
    });

    it('rota do servidor recebe de volta as ações ainda na fila', async () => {
      await store.replaceRoutes('2026-11-17', [route(1)], 't0');
      await store.enqueue(action('a1', 1, 'route_start'), route(1, { status: 'active' }));

      // O servidor ainda não sabe da saída: devolve a rota planejada.
      await store.saveServerRoute(route(1), mergePending);
      expect((await store.getRoute(1))?.status).toBe('active');

      await store.replaceServerRoutes('2026-11-17', [route(1), route(4)], 't1', mergePending);
      const cached = await store.getRoutes();
      expect(cached.routes.find((r) => r.route_id === 1)?.status).toBe('active');
      expect(cached.routes.find((r) => r.route_id === 4)?.status).toBe('planned');
      expect(cached.fetchedAt).toBe('t1');
    });
  });

  describe('fila de ações', () => {
    it('enfileira gravando a rota junto, em ordem de criação', async () => {
      const primeiro = await store.enqueue(
        action('a1', 1, 'route_start'),
        route(1, { status: 'active' }),
      );
      expect(primeiro).toMatchObject({
        id: 'a1',
        route_id: 1,
        order_id: null,
        kind: 'route_start',
        status: 'pending',
        attempts: 0,
        next_attempt_at: 0,
        last_error: null,
        created_at: '2026-11-17T12:00:00.000Z',
      });
      expect(primeiro.payload.latitude).toBe(-26.4);
      expect((await store.getRoute(1))?.status).toBe('active');

      const segundo = await store.enqueue(action('a2', 1, 'stop_arrive', 11), route(1));
      expect(segundo.seq).toBeGreaterThan(primeiro.seq);
      expect((await store.listOutbox()).map((item) => item.id)).toEqual(['a1', 'a2']);
    });

    it('atualiza, filtra por situação e apaga', async () => {
      await store.enqueue(action('a1', 1, 'route_start'), route(1));
      await store.enqueue(action('a2', 1, 'stop_deliver', 11), route(1));

      await store.updateOutbox('a1', {}); // nada a mudar
      await store.updateOutbox('a2', {
        status: 'rejected',
        attempts: 3,
        next_attempt_at: 99,
        last_error: 'Parada já encerrada',
      });

      expect((await store.listOutbox('pending')).map((item) => item.id)).toEqual(['a1']);
      expect(await store.listOutbox('rejected')).toEqual([
        expect.objectContaining({
          id: 'a2',
          attempts: 3,
          next_attempt_at: 99,
          last_error: 'Parada já encerrada',
        }),
      ]);

      await store.updateOutbox('a2', { last_error: null });
      expect((await store.listOutbox('rejected'))[0].last_error).toBeNull();

      await store.deleteOutbox('a1');
      expect((await store.listOutbox()).map((item) => item.id)).toEqual(['a2']);
    });

    it('a rota do servidor ignora o que o servidor recusou', async () => {
      await store.enqueue(action('a1', 1, 'route_start'), route(1, { status: 'active' }));
      await store.updateOutbox('a1', { status: 'rejected' });
      await store.saveServerRoute(route(1), mergePending);
      expect((await store.getRoute(1))?.status).toBe('planned');
    });
  });

  describe('rastro de GPS', () => {
    it('guarda sem duplicar e entrega por rota, do mais antigo', async () => {
      await store.addPings([]);
      await store.addPings([ping(2, 1, 5), ping(1, 1, 1), ping(1, 2, 2)]);
      await store.addPings([ping(1, 1, 1)]); // reenvio da mesma leitura
      expect(await store.countPings()).toBe(3);

      const lote = await store.takePings(10);
      expect(lote.map((p) => p.id)).toEqual(['ping-1-1', 'ping-1-2']);
      expect(lote[0]).toEqual(ping(1, 1, 1));

      expect((await store.takePings(1)).map((p) => p.id)).toEqual(['ping-1-1']);
      expect((await store.takePings(10, [1])).map((p) => p.id)).toEqual(['ping-2-1']);
      expect(await store.takePings(10, [1, 2])).toEqual([]);
      expect((await store.takePingsForRoute(2, 10)).map((p) => p.id)).toEqual(['ping-2-1']);

      await store.deletePings([]);
      await store.deletePings(['ping-1-1', 'ping-1-2']);
      expect(await store.countPings()).toBe(1);
      expect(await store.takePingsForRoute(1, 10)).toEqual([]);
    });
  });

  describe('valores avulsos e limpeza', () => {
    it('grava, sobrescreve e remove', async () => {
      expect(await store.getValue('x')).toBeNull();
      await store.setValue('x', '1');
      await store.setValue('x', '2');
      expect(await store.getValue('x')).toBe('2');
      await store.setValue('x', null);
      expect(await store.getValue('x')).toBeNull();
    });

    it('clear apaga rotas, fila, rastro e valores', async () => {
      await store.replaceRoutes('2026-11-17', [route(1)], 't');
      await store.enqueue(action('a1', 1, 'route_start'), route(1));
      await store.addPings([ping(1, 1)]);
      await store.setValue('x', '1');

      await store.clear();

      expect(await store.getRoutes()).toEqual({ routes: [], day: null, fetchedAt: null });
      expect(await store.listOutbox()).toEqual([]);
      expect(await store.countPings()).toBe(0);
      expect(await store.getValue('x')).toBeNull();
    });
  });
});

describe('SQLite: transações', () => {
  it('gravações simultâneas esperam a vez em vez de se atropelar', async () => {
    const store = new SqliteStore();
    await Promise.all([
      store.addPings([ping(1, 1)]),
      store.enqueue(action('a1', 1, 'route_start'), route(1)),
      store.addPings([ping(1, 2)]),
      store.replaceRoutes('2026-11-17', [route(1)], 't'),
    ]);
    expect(await store.countPings()).toBe(2);
    expect(await store.listOutbox()).toHaveLength(1);
  });

  it('uma transação que falha é desfeita e não trava as próximas', async () => {
    const store = new SqliteStore();
    await store.enqueue(action('a1', 1, 'route_start'), route(1));
    // Mesmo id: o UNIQUE recusa e a rota gravada junto volta atrás.
    await expect(
      store.enqueue(action('a1', 1, 'route_start'), route(1, { status: 'active' })),
    ).rejects.toThrow();
    expect((await store.getRoute(1))?.status).toBe('planned');

    await store.addPings([ping(1, 1)]);
    expect(await store.countPings()).toBe(1);
  });
});
