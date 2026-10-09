import type { DriverRoute } from '@/features/routes/model';
import { MemoryStore } from '@/services/store/memory-store';
import { applyAction, mergePending } from '../apply';
import type { NewOutboxItem, OutboxItem, PingRow } from '../model';
import { backoffMs, runSync, type Failure, type SyncDeps } from '../worker';

/**
 * A fila offline é a promessa central do aplicativo: nada do que o
 * entregador registra se perde, chega duplicado ou chega fora de ordem.
 * Estes testes exercitam essa promessa contra um servidor de mentira que
 * falha do jeito que a rede de verdade falha.
 */

const stop = (orderId: number, sequence: number) => ({
  order_id: orderId,
  stop_sequence: sequence,
  status: 'planned',
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

const route = (routeId: number, extra: Partial<DriverRoute> = {}): DriverRoute => ({
  route_id: routeId,
  status: 'planned',
  planned_date: '2026-10-08',
  region: 'Jaraguá do Sul',
  simulated: false,
  total_distance_m: 12000,
  total_duration_min: 60,
  started_at: null,
  finished_at: null,
  vehicle: null,
  stops: [stop(routeId * 10 + 1, 1), stop(routeId * 10 + 2, 2)],
  ...extra,
});

let counter = 0;
const action = (
  routeId: number,
  kind: NewOutboxItem['kind'],
  orderId: number | null = null,
  minute = 0,
): NewOutboxItem => {
  counter += 1;
  return {
    id: `evt-${counter}`,
    route_id: routeId,
    order_id: orderId,
    kind,
    payload: { occurred_at: `2026-10-08T12:${String(minute).padStart(2, '0')}:00.000Z` },
  };
};

const ping = (routeId: number, index: number): PingRow => ({
  id: `ping-${routeId}-${index}`,
  route_id: routeId,
  latitude: -26.5 + index * 0.001,
  longitude: -49,
  accuracy_m: 8,
  speed_mps: 7,
  recorded_at: new Date(Date.UTC(2026, 9, 8, 12, 0, index)).toISOString(),
});

const NETWORK: Failure = { kind: 'retry', message: 'Sem conexão com o servidor.' };
const REFUSED: Failure = { kind: 'reject', message: 'Esta parada já foi encerrada' };

/** Servidor de mentira: aplica a ação na sua própria cópia da rota, ou falha como mandado. */
function setup(serverRoutes: DriverRoute[] = [route(1)]) {
  const store = new MemoryStore();
  const server = new Map(serverRoutes.map((item) => [item.route_id, item]));
  const received: string[] = [];
  const receivedPings: PingRow[] = [];
  const failures = new Map<string, Failure>();
  let now = 1_000_000;
  let pingFailure: Failure | null = null;

  const deps: SyncDeps = {
    store,
    now: () => now,
    classify: (error) => error as Failure,
    send: async (item) => {
      const failure = failures.get(item.id);
      if (failure) throw failure;
      received.push(item.id);
      const updated = applyAction(server.get(item.route_id) as DriverRoute, item);
      server.set(item.route_id, updated);
      return updated;
    },
    sendPings: async (_routeId, pings) => {
      if (pingFailure) throw pingFailure;
      receivedPings.push(...pings);
    },
    fetchRoute: async (routeId) => server.get(routeId) ?? null,
  };

  /** Faz o que a tela faz: aplica na cópia local e põe na fila. */
  const perform = async (item: NewOutboxItem): Promise<OutboxItem> => {
    const local = (await store.getRoute(item.route_id)) as DriverRoute;
    return store.enqueue(item, applyAction(local, item));
  };

  return {
    store,
    deps,
    server,
    received,
    receivedPings,
    perform,
    fail: (id: string, failure: Failure) => failures.set(id, failure),
    recover: (id: string) => failures.delete(id),
    failPings: (failure: Failure | null) => {
      pingFailure = failure;
    },
    advance: (ms: number) => {
      now += ms;
    },
    seed: async () => {
      await store.replaceRoutes('2026-10-08', [...server.values()], '2026-10-08T11:00:00.000Z');
    },
  };
}

describe('fila offline', () => {
  beforeEach(() => {
    counter = 0;
  });

  it('envia as ações na ordem em que foram feitas e esvazia a fila', async () => {
    const t = setup();
    await t.seed();
    const saida = await t.perform(action(1, 'route_start', null, 0));
    const entrega = await t.perform(action(1, 'stop_deliver', 11, 10));

    const outcome = await runSync(t.deps);

    expect(t.received).toEqual([saida.id, entrega.id]);
    expect(outcome).toMatchObject({ sent: 2, rejected: 0, deferred: false });
    expect(await t.store.listOutbox()).toEqual([]);
  });

  it('a tela mostra a ação na hora, antes de qualquer envio', async () => {
    const t = setup();
    await t.seed();

    await t.perform(action(1, 'route_start', null, 0));
    await t.perform(action(1, 'stop_deliver', 11, 10));

    const local = (await t.store.getRoute(1)) as DriverRoute;
    expect(local.status).toBe('active');
    expect(local.stops[0]).toMatchObject({
      status: 'delivered',
      completed_at: '2026-10-08T12:10:00.000Z',
    });
    expect(t.received).toEqual([]);
  });

  describe('regra 2 — ordem por rota', () => {
    it('sem rede na saída, a entrega daquela rota não é enviada na frente', async () => {
      const t = setup();
      await t.seed();
      const saida = await t.perform(action(1, 'route_start', null, 0));
      await t.perform(action(1, 'stop_deliver', 11, 10));
      t.fail(saida.id, NETWORK);

      const outcome = await runSync(t.deps);

      expect(t.received).toEqual([]);
      expect(outcome.deferred).toBe(true);
      expect((await t.store.listOutbox('pending')).map((item) => item.kind)).toEqual([
        'route_start',
        'stop_deliver',
      ]);
    });

    it('uma rota travada não segura a fila de outra', async () => {
      const t = setup([route(1), route(2)]);
      await t.seed();
      const saida1 = await t.perform(action(1, 'route_start', null, 0));
      const saida2 = await t.perform(action(2, 'route_start', null, 1));
      t.fail(saida1.id, NETWORK);

      await runSync(t.deps);

      expect(t.received).toEqual([saida2.id]);
    });
  });

  describe('regra 5 — nova tentativa', () => {
    it('espera o intervalo antes de tentar de novo, e depois envia tudo em ordem', async () => {
      const t = setup();
      await t.seed();
      const saida = await t.perform(action(1, 'route_start', null, 0));
      const entrega = await t.perform(action(1, 'stop_deliver', 11, 10));
      t.fail(saida.id, NETWORK);

      await runSync(t.deps);
      t.recover(saida.id);

      // A rede voltou, mas ainda não deu o tempo de espera.
      t.advance(backoffMs(1) - 1);
      await runSync(t.deps);
      expect(t.received).toEqual([]);

      t.advance(1);
      await runSync(t.deps);
      expect(t.received).toEqual([saida.id, entrega.id]);
    });

    it('aumenta a espera a cada falha, até o teto de 15 minutos', async () => {
      const t = setup();
      await t.seed();
      const saida = await t.perform(action(1, 'route_start', null, 0));
      t.fail(saida.id, NETWORK);

      for (let tentativa = 1; tentativa <= 7; tentativa += 1) {
        await runSync(t.deps);
        const [item] = await t.store.listOutbox('pending');
        expect(item.attempts).toBe(tentativa);
        expect(item.next_attempt_at - t.deps.now()).toBe(backoffMs(tentativa));
        t.advance(backoffMs(tentativa));
      }

      expect([1, 2, 3, 4, 5, 6, 7].map(backoffMs)).toEqual([
        5_000, 15_000, 60_000, 300_000, 900_000, 900_000, 900_000,
      ]);
    });

    it('guarda o motivo da falha para mostrar na tela de sincronização', async () => {
      const t = setup();
      await t.seed();
      const saida = await t.perform(action(1, 'route_start', null, 0));
      t.fail(saida.id, NETWORK);

      await runSync(t.deps);

      const [item] = await t.store.listOutbox('pending');
      expect(item.last_error).toBe('Sem conexão com o servidor.');
    });
  });

  describe('regra 6 — recusa definitiva', () => {
    it('separa a ação recusada e segue com as próximas da mesma rota', async () => {
      const t = setup([route(1, { status: 'active' })]);
      await t.seed();
      const recusada = await t.perform(action(1, 'stop_deliver', 11, 5));
      const seguinte = await t.perform(action(1, 'stop_deliver', 12, 9));
      t.fail(recusada.id, REFUSED);

      const outcome = await runSync(t.deps);

      expect(outcome).toMatchObject({ sent: 1, rejected: 1 });
      expect(t.received).toEqual([seguinte.id]);
      expect(await t.store.listOutbox('rejected')).toEqual([
        expect.objectContaining({ id: recusada.id, last_error: 'Esta parada já foi encerrada' }),
      ]);
    });

    it('não tenta de novo o que foi recusado', async () => {
      const t = setup([route(1, { status: 'active' })]);
      await t.seed();
      const recusada = await t.perform(action(1, 'stop_deliver', 11, 5));
      t.fail(recusada.id, REFUSED);

      await runSync(t.deps);
      t.recover(recusada.id);
      t.advance(60 * 60_000);
      await runSync(t.deps);

      expect(t.received).toEqual([]);
    });

    it('a tela deixa de mostrar como feita a ação que o servidor recusou', async () => {
      const t = setup([route(1, { status: 'active' })]);
      await t.seed();
      const recusada = await t.perform(action(1, 'stop_deliver', 11, 5));
      t.fail(recusada.id, REFUSED);
      expect(((await t.store.getRoute(1)) as DriverRoute).stops[0].status).toBe('delivered');

      await runSync(t.deps);

      expect(((await t.store.getRoute(1)) as DriverRoute).stops[0].status).toBe('planned');
    });

    it('rota que não existe mais no servidor some do aparelho', async () => {
      const t = setup();
      await t.seed();
      const saida = await t.perform(action(1, 'route_start', null, 0));
      t.fail(saida.id, { kind: 'reject', message: 'Rota 1 não encontrada' });
      t.server.delete(1);

      await runSync(t.deps);

      expect(await t.store.getRoute(1)).toBeNull();
    });
  });

  it('sessão encerrada interrompe a rodada sem perder nem marcar nada', async () => {
    const t = setup();
    await t.seed();
    const saida = await t.perform(action(1, 'route_start', null, 0));
    await t.perform(action(1, 'stop_deliver', 11, 10));
    t.fail(saida.id, { kind: 'auth', message: 'Sessão expirada.' });

    const outcome = await runSync(t.deps);

    expect(outcome.authLost).toBe(true);
    expect(t.received).toEqual([]);
    expect(await t.store.listOutbox('pending')).toEqual([
      expect.objectContaining({ attempts: 0 }),
      expect.objectContaining({ attempts: 0 }),
    ]);
  });

  it('resposta do servidor não apaga da tela o que ainda está na fila', async () => {
    const t = setup();
    await t.seed();
    await t.perform(action(1, 'route_start', null, 0));
    const entrega = await t.perform(action(1, 'stop_deliver', 11, 10));
    t.fail(entrega.id, NETWORK);

    // A saída é confirmada; a entrega fica na fila. O servidor devolve a rota
    // sem a entrega, e a cópia local precisa continuar mostrando-a.
    await runSync(t.deps);

    const local = (await t.store.getRoute(1)) as DriverRoute;
    expect((t.server.get(1) as DriverRoute).stops[0].status).toBe('in_route');
    expect(local.stops[0].status).toBe('delivered');
  });

  describe('rastro de GPS', () => {
    it('sobe em lotes de 200, do ponto mais antigo para o mais novo', async () => {
      const t = setup([route(1, { status: 'active' })]);
      await t.seed();
      await t.store.addPings(Array.from({ length: 450 }, (_, i) => ping(1, i)));

      const outcome = await runSync(t.deps);

      expect(outcome.pingsSent).toBe(450);
      expect(t.receivedPings).toHaveLength(450);
      expect(t.receivedPings[0].id).toBe('ping-1-0');
      expect(t.receivedPings[449].id).toBe('ping-1-449');
      expect(await t.store.countPings()).toBe(0);
    });

    it('não sobe na frente das ações da rota', async () => {
      const t = setup();
      await t.seed();
      const saida = await t.perform(action(1, 'route_start', null, 0));
      await t.store.addPings([ping(1, 0), ping(1, 1)]);
      t.fail(saida.id, NETWORK);

      await runSync(t.deps);

      // O servidor ainda não sabe que a rota saiu: recusaria os pontos.
      expect(t.receivedPings).toEqual([]);
      expect(await t.store.countPings()).toBe(2);
    });

    it('sem rede, os pontos ficam guardados para a próxima rodada', async () => {
      const t = setup([route(1, { status: 'active' })]);
      await t.seed();
      await t.store.addPings([ping(1, 0), ping(1, 1)]);
      t.failPings(NETWORK);

      const outcome = await runSync(t.deps);

      expect(outcome.deferred).toBe(true);
      expect(await t.store.countPings()).toBe(2);

      t.failPings(null);
      await runSync(t.deps);
      expect(await t.store.countPings()).toBe(0);
    });

    it('descarta o rastro de uma rota que o servidor não aceita mais', async () => {
      const t = setup([route(1, { status: 'active' })]);
      await t.seed();
      await t.store.addPings([ping(1, 0), ping(1, 1)]);
      t.failPings({ kind: 'reject', message: 'Esta rota está como "cancelled"' });

      await runSync(t.deps);

      expect(await t.store.countPings()).toBe(0);
    });

    it('o mesmo ponto gravado duas vezes conta uma vez só', async () => {
      const t = setup();
      await t.store.addPings([ping(1, 0)]);
      await t.store.addPings([ping(1, 0), ping(1, 1)]);

      expect(await t.store.countPings()).toBe(2);
    });
  });
});

describe('applyAction', () => {
  it('a saída põe a rota em andamento e as paradas a caminho', () => {
    const result = applyAction(route(1), action(1, 'route_start', null, 3));

    expect(result).toMatchObject({ status: 'active', started_at: '2026-10-08T12:03:00.000Z' });
    expect(result.stops.map((item) => item.status)).toEqual(['in_route', 'in_route']);
  });

  it('a chegada registrada duas vezes mantém a primeira hora', () => {
    const chegou = applyAction(route(1, { status: 'active' }), action(1, 'stop_arrive', 11, 5));
    const deNovo = applyAction(chegou, action(1, 'stop_arrive', 11, 9));

    expect(deNovo.stops[0].arrived_at).toBe('2026-10-08T12:05:00.000Z');
  });

  it('a ocorrência guarda o motivo e a observação', () => {
    const item: NewOutboxItem = {
      ...action(1, 'stop_fail', 12, 20),
      payload: {
        occurred_at: '2026-10-08T12:20:00.000Z',
        occurrence_type: 'customer_absent',
        notes: 'Portão fechado',
      },
    };

    const result = applyAction(route(1, { status: 'active' }), item);

    expect(result.stops[1]).toMatchObject({
      status: 'failed',
      occurrence_type: 'customer_absent',
      notes: 'Portão fechado',
    });
    expect(result.stops[0].status).toBe('planned');
  });

  it('não altera o objeto recebido', () => {
    const original = route(1);
    const copia = structuredClone(original);

    applyAction(original, action(1, 'route_start'));

    expect(original).toEqual(copia);
  });

  it('mergePending reaplica só as ações pendentes da própria rota, em ordem', () => {
    const base = { status: 'pending' as const, attempts: 0, next_attempt_at: 0, last_error: null };
    const pending: OutboxItem[] = [
      { ...action(1, 'stop_deliver', 11, 10), ...base, seq: 2, created_at: '' },
      { ...action(1, 'route_start', null, 0), ...base, seq: 1, created_at: '' },
      { ...action(2, 'route_start', null, 0), ...base, seq: 3, created_at: '' },
      { ...action(1, 'stop_deliver', 12, 15), ...base, seq: 4, created_at: '', status: 'rejected' },
    ];

    const result = mergePending(route(1), pending);

    expect(result.status).toBe('active');
    expect(result.stops.map((item) => item.status)).toEqual(['delivered', 'in_route']);
  });
});
