import NetInfo from '@react-native-community/netinfo';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { runSync } from '@/features/sync/worker';
import { fetchRoute, sendAction, sendPings } from '@/services/api/driver';
import { classifyFailure } from '@/services/api/errors';
import { getSession } from '@/services/session';
import { store } from '@/services/store';

/** Enquanto o aplicativo está aberto, confere a fila a cada meio minuto. */
const INTERVAL_MS = 30_000;

export interface SyncState {
  /** Ações do entregador ainda não confirmadas pelo servidor. */
  pending: number;
  /** Ações que o servidor recusou e que o entregador precisa ver. */
  rejected: number;
  /** Pontos de GPS aguardando envio. */
  pings: number;
  syncing: boolean;
  online: boolean;
  lastSyncAt: string | null;
}

let state: SyncState = {
  pending: 0,
  rejected: 0,
  pings: 0,
  syncing: false,
  online: true,
  lastSyncAt: null,
};

const listeners = new Set<() => void>();
const routeListeners = new Set<() => void>();

function update(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

/** Recalcula os contadores mostrados no selo de sincronização. */
export async function refreshSyncCounts(): Promise<void> {
  const [outbox, pings] = await Promise.all([store.listOutbox(), store.countPings()]);
  update({
    pending: outbox.filter((item) => item.status === 'pending').length,
    rejected: outbox.filter((item) => item.status === 'rejected').length,
    pings,
  });
}

/** Avisa as telas de que a cópia local das rotas mudou por causa de uma sincronização. */
export function onRoutesChanged(listener: () => void): () => void {
  routeListeners.add(listener);
  return () => routeListeners.delete(listener);
}

let running: Promise<void> | null = null;
let rerun = false;
let lastRunAt = 0;

/**
 * Pede uma rodada de sincronização.
 *
 * Só uma rodada acontece por vez: um pedido que chega no meio de outra fica
 * marcado e roda em seguida, para que duas rodadas nunca enviem o mesmo item
 * ao mesmo tempo. `minIntervalMs` serve à tarefa de GPS, que dispara a cada
 * leitura e não deve abrir uma conexão a cada 15 segundos.
 */
export function requestSync(options: { minIntervalMs?: number } = {}): Promise<void> {
  if (!getSession()) return Promise.resolve();

  if (running) {
    rerun = true;
    return running;
  }

  if (options.minIntervalMs && Date.now() - lastRunAt < options.minIntervalMs) {
    return Promise.resolve();
  }

  running = (async () => {
    update({ syncing: true });
    try {
      do {
        rerun = false;
        lastRunAt = Date.now();

        const outcome = await runSync({
          store,
          send: sendAction,
          sendPings,
          fetchRoute,
          classify: classifyFailure,
          now: Date.now,
        });

        if (outcome.sent > 0 || outcome.rejected > 0) {
          routeListeners.forEach((listener) => listener());
        }
        if (!outcome.deferred && !outcome.authLost) {
          update({ lastSyncAt: new Date().toISOString() });
        }
        if (outcome.authLost) break;
      } while (rerun);
    } catch {
      // Falha inesperada na rodada (ex.: banco local): a próxima tenta de novo.
    } finally {
      running = null;
      await refreshSyncCounts().catch(() => undefined);
      update({ syncing: false });
    }
  })();

  return running;
}

/**
 * Liga os gatilhos de sincronização: rede de volta, aplicativo de volta ao
 * primeiro plano e um intervalo fixo. Devolve a função que desliga tudo.
 */
export function startSyncTriggers(): () => void {
  const unsubscribeNet = NetInfo.addEventListener((info) => {
    const online = info.isConnected !== false;
    const voltou = online && !state.online;
    update({ online });
    if (voltou) void requestSync();
  });

  const appState = AppState.addEventListener('change', (status) => {
    if (status === 'active') void requestSync();
  });

  const interval = setInterval(() => void requestSync(), INTERVAL_MS);

  void refreshSyncCounts();
  void requestSync();

  return () => {
    unsubscribeNet();
    appState.remove();
    clearInterval(interval);
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
