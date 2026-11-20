import { stopTracking } from '@/services/location/tracking';
import { store } from '@/services/store';
import {
  adoptLocalOwner,
  discardMessage,
  getLocalOwner,
  LoginCancelledError,
  prepareLocalDataFor,
} from '../local-owner';

jest.mock('@/services/store', () => {
  const { MemoryStore: Store } = jest.requireActual('@/services/store/memory-store');
  return { store: new Store() };
});

jest.mock('@/services/location/tracking', () => ({
  stopTracking: jest.fn(async () => undefined),
}));

jest.mock('@/services/sync', () => ({
  refreshSyncCounts: jest.fn(async () => undefined),
  stopSync: jest.fn(async () => undefined),
}));

const routeStub = { route_id: 1, status: 'active', stops: [] } as never;

async function seedUnsent() {
  await store.enqueue(
    {
      id: 'evt-1',
      route_id: 1,
      order_id: null,
      kind: 'route_start',
      payload: { occurred_at: '2026-10-08T12:00:00.000Z' },
    },
    routeStub,
  );
  await store.addPings([
    {
      id: 'p1',
      route_id: 1,
      latitude: 0,
      longitude: 0,
      accuracy_m: null,
      speed_mps: null,
      recorded_at: '2026-10-08T12:00:00.000Z',
    },
  ]);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await store.clear();
});

describe('dono dos dados locais', () => {
  it('o mesmo motorista entra de novo e mantém a fila', async () => {
    await store.setValue('local.owner', '7');
    await seedUnsent();
    const ask = jest.fn(async () => true);

    await prepareLocalDataFor(7, ask);

    expect(ask).not.toHaveBeenCalled();
    expect(await store.listOutbox()).toHaveLength(1);
    expect(stopTracking).not.toHaveBeenCalled();
  });

  it('outro motorista com dados pendentes: recusar cancela sem apagar', async () => {
    await store.setValue('local.owner', '7');
    await seedUnsent();

    await expect(prepareLocalDataFor(8, async () => false)).rejects.toBeInstanceOf(
      LoginCancelledError,
    );

    expect(await store.listOutbox()).toHaveLength(1);
    expect(await getLocalOwner()).toBe('7');
  });

  it('outro motorista com dados pendentes: aceitar apaga e troca o dono', async () => {
    await store.setValue('local.owner', '7');
    await seedUnsent();
    const ask = jest.fn(async () => true);

    await prepareLocalDataFor(8, ask);

    expect(ask).toHaveBeenCalledWith({ actions: 1, pings: 1 });
    expect(stopTracking).toHaveBeenCalled();
    expect(await store.listOutbox()).toEqual([]);
    expect(await store.countPings()).toBe(0);
    expect(await getLocalOwner()).toBe('8');
  });

  it('outro motorista sem pendências: apaga sem perguntar', async () => {
    await store.setValue('local.owner', '7');
    await store.replaceRoutes('2026-10-08', [routeStub], '2026-10-08T11:00:00.000Z');
    const ask = jest.fn(async () => true);

    await prepareLocalDataFor(8, ask);

    expect(ask).not.toHaveBeenCalled();
    expect((await store.getRoutes()).routes).toEqual([]);
    expect(await getLocalOwner()).toBe('8');
  });

  it('sessão antiga sem dono registrado adota o usuário logado', async () => {
    await adoptLocalOwner(7);
    await adoptLocalOwner(8);
    expect(await getLocalOwner()).toBe('7');
  });

  it('mensagem do aviso', () => {
    expect(discardMessage({ actions: 2, pings: 1 })).toBe(
      'Há 2 ações e 1 ponto de trajeto não enviados de outro motorista neste aparelho. Entrar apaga esses dados.',
    );
    expect(discardMessage({ actions: 0, pings: 5 })).toContain('Há 5 pontos de trajeto não');
  });
});
