import NetInfo from '@react-native-community/netinfo';
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { runSync } from '@/features/sync/worker';
import { getSession } from '@/services/session';
import { store } from '@/services/store';
import {
  onRoutesChanged,
  refreshSyncCounts,
  requestSync,
  startSyncTriggers,
  stopSync,
  useSyncState,
} from '..';

/**
 * Quem dispara a fila: rede de volta, app de volta e o relógio. A regra que
 * importa é "uma rodada por vez" — duas rodadas juntas mandariam o mesmo item
 * duas vezes — e "nada depois do logout".
 */

jest.mock('@/services/store', () => {
  const { MemoryStore } = jest.requireActual('@/services/store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('@/features/sync/worker', () => ({ runSync: jest.fn() }));
jest.mock('@/services/api/driver', () => ({
  fetchRoute: jest.fn(),
  sendAction: jest.fn(),
  sendPings: jest.fn(),
}));
jest.mock('@/services/api/errors', () => ({ classifyFailure: jest.fn() }));
jest.mock('@/services/session', () => ({ getSession: jest.fn() }));

let netListener: ((info: { isConnected: boolean | null }) => void) | null = null;
const unsubscribeNet = jest.fn();
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn() },
}));

const run = jest.mocked(runSync);
const outcome = (extra: Partial<Awaited<ReturnType<typeof runSync>>> = {}) =>
  ({ sent: 0, rejected: 0, deferred: false, authLost: false, ...extra }) as Awaited<
    ReturnType<typeof runSync>
  >;

const route = { route_id: 1 } as never;

let appListener: ((status: string) => void) | null = null;
const appRemove = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(getSession).mockReturnValue({ user: { id: 1 } } as never);
  run.mockResolvedValue(outcome());
  jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
    netListener = listener as never;
    return unsubscribeNet;
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appListener = listener as never;
    return { remove: appRemove } as never;
  });
  await store.clear();
  // Cada teste começa com a sincronização ligada e sem rodada pendente.
  startSyncTriggers()();
  await Promise.resolve();
  await requestSync();
  jest.clearAllMocks();
  run.mockResolvedValue(outcome());
});

describe('rodadas', () => {
  it('sem sessão não sincroniza', async () => {
    jest.mocked(getSession).mockReturnValue(null);
    await requestSync();
    expect(run).not.toHaveBeenCalled();
  });

  it('pedido no meio de uma rodada roda logo depois, uma de cada vez', async () => {
    let solta: () => void = () => undefined;
    run.mockImplementationOnce(
      () => new Promise((resolve) => (solta = () => resolve(outcome({ sent: 1 })))),
    );
    const listener = jest.fn();
    const off = onRoutesChanged(listener);

    const primeira = requestSync();
    const segunda = requestSync();
    expect(segunda).toBe(primeira);
    expect(run).toHaveBeenCalledTimes(1);

    solta();
    await primeira;
    expect(run).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('respeita o intervalo mínimo pedido pela tarefa de GPS', async () => {
    await requestSync();
    await requestSync({ minIntervalMs: 60_000 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('sessão perdida encerra a rodada sem marcar sincronizado', async () => {
    const { result } = renderHook(() => useSyncState());
    const antes = result.current.lastSyncAt;
    run.mockResolvedValue(outcome({ authLost: true }));
    await act(async () => {
      void requestSync();
      // Pedido no meio: não roda de novo com a sessão perdida.
      await requestSync();
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.current.lastSyncAt).toBe(antes);

    run.mockResolvedValue(outcome());
    await act(() => requestSync());
    expect(result.current.lastSyncAt).not.toBeNull();
    expect(result.current.syncing).toBe(false);
  });

  it('erro inesperado no banco não derruba o app', async () => {
    run.mockRejectedValueOnce(new Error('disk I/O'));
    await expect(requestSync()).resolves.toBeUndefined();
  });

  it('conta pendentes, recusadas e pontos', async () => {
    await store.enqueue(
      { id: 'a', route_id: 1, order_id: null, kind: 'route_start', payload: { occurred_at: 't' } },
      route,
    );
    await store.enqueue(
      { id: 'b', route_id: 1, order_id: null, kind: 'route_finish', payload: { occurred_at: 't' } },
      route,
    );
    await store.updateOutbox('b', { status: 'rejected' });
    await store.addPings([
      {
        id: 'p',
        route_id: 1,
        latitude: 0,
        longitude: 0,
        accuracy_m: null,
        speed_mps: null,
        recorded_at: 't',
      },
    ]);
    await refreshSyncCounts();
    // A contagem chega ao selo pelo mesmo estado que o hook lê.
    const { result } = renderHook(() => useSyncState());
    expect(result.current).toMatchObject({ pending: 1, rejected: 1, pings: 1 });
  });
});

describe('logout', () => {
  it('espera a rodada em andamento e não começa outra', async () => {
    let solta: () => void = () => undefined;
    run.mockImplementationOnce(() => new Promise((resolve) => (solta = () => resolve(outcome()))));

    const rodada = requestSync();
    requestSync(); // marcaria outra rodada
    const parada = stopSync();
    solta();
    await parada;
    await rodada;
    expect(run).toHaveBeenCalledTimes(1);

    await requestSync();
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('gatilhos', () => {
  it('rede de volta, app de volta e o relógio pedem sincronização', async () => {
    jest.useFakeTimers();
    try {
      const desligar = startSyncTriggers();
      await jest.advanceTimersByTimeAsync(0);
      expect(run).toHaveBeenCalledTimes(1);

      netListener?.({ isConnected: false });
      netListener?.({ isConnected: true });
      await jest.advanceTimersByTimeAsync(0);
      expect(run).toHaveBeenCalledTimes(2);

      // Continuar online não é "voltar".
      netListener?.({ isConnected: true });
      appListener?.('background');
      await jest.advanceTimersByTimeAsync(0);
      expect(run).toHaveBeenCalledTimes(2);

      appListener?.('active');
      await jest.advanceTimersByTimeAsync(0);
      expect(run).toHaveBeenCalledTimes(3);

      await jest.advanceTimersByTimeAsync(30_000);
      expect(run).toHaveBeenCalledTimes(4);

      desligar();
      expect(unsubscribeNet).toHaveBeenCalled();
      expect(appRemove).toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(60_000);
      expect(run).toHaveBeenCalledTimes(4);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('envio forçado', () => {
  it('rede de volta e pedido manual ignoram a espera entre tentativas; o relógio não', async () => {
    jest.useFakeTimers();
    try {
      const desligar = startSyncTriggers();
      await jest.advanceTimersByTimeAsync(0);
      expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ ignoreBackoff: false }));

      netListener?.({ isConnected: false });
      netListener?.({ isConnected: true });
      await jest.advanceTimersByTimeAsync(0);
      expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ ignoreBackoff: true }));

      await jest.advanceTimersByTimeAsync(30_000);
      expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ ignoreBackoff: false }));

      await requestSync({ ignoreBackoff: true });
      expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ ignoreBackoff: true }));
      desligar();
    } finally {
      jest.useRealTimers();
    }
  });
});
