import type { DriverRoute } from '@/features/routes/model';
import type { LocalStore } from '@/services/store/types';
import { mergePending } from './apply';
import type { OutboxItem, PingRow } from './model';

/** Pontos de GPS por chamada. É o limite aceito por `POST /driver/routes/:id/locations`. */
export const PING_BATCH_SIZE = 200;

/** Lotes de GPS por rodada, para uma fila grande não prender o aparelho numa rodada só. */
const MAX_PING_BATCHES_PER_RUN = 10;

/** Espera antes de cada nova tentativa: 5 s, 15 s, 1 min, 5 min e, daí em diante, 15 min. */
const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000, 900_000];

export function backoffMs(attempts: number): number {
  return BACKOFF_MS[Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1];
}

/**
 * O que fazer com um envio que falhou.
 *
 * retry  → rede, timeout ou erro do servidor: tenta de novo mais tarde
 * reject → o servidor entendeu e recusou; repetir não muda a resposta
 * auth   → a sessão acabou; nada mais será aceito até um novo login
 */
export type FailureKind = 'retry' | 'reject' | 'auth';

export interface Failure {
  kind: FailureKind;
  message: string;
}

export interface SyncDeps {
  store: LocalStore;
  /** Envia uma ação. Devolve a rota como o servidor a vê depois dela. */
  send(item: OutboxItem): Promise<DriverRoute>;
  sendPings(routeId: number, pings: PingRow[]): Promise<void>;
  /** Rota atual no servidor, ou null se ela não existe mais para este motorista. */
  fetchRoute(routeId: number): Promise<DriverRoute | null>;
  classify(error: unknown): Failure;
  now(): number;
}

export interface SyncOutcome {
  sent: number;
  rejected: number;
  pingsSent: number;
  /** Ficou algo para depois por falha temporária. */
  deferred: boolean;
  authLost: boolean;
}

/**
 * Uma rodada de sincronização.
 *
 * Regras (seção 3 do SPEC):
 * - As ações de uma mesma rota sobem em ordem, uma por vez. Se uma falha por
 *   rede, as seguintes daquela rota esperam: uma entrega nunca chega ao
 *   servidor antes da saída que a precede.
 * - Recusa definitiva tira o item do caminho e libera os próximos.
 * - O rastro de GPS só sobe depois das ações da rota, e nunca na frente delas.
 */
export async function runSync(deps: SyncDeps): Promise<SyncOutcome> {
  const { store } = deps;
  const outcome: SyncOutcome = {
    sent: 0,
    rejected: 0,
    pingsSent: 0,
    deferred: false,
    authLost: false,
  };

  /** Grava a versão do servidor sem apagar o que ainda está na fila desta rota. */
  const saveFromServer = async (route: DriverRoute) => {
    const pending = await store.listOutbox('pending');
    await store.saveRoute(mergePending(route, pending));
  };

  const waiting = new Set<number>();

  for (const item of await store.listOutbox('pending')) {
    if (waiting.has(item.route_id)) continue;

    if (item.next_attempt_at > deps.now()) {
      waiting.add(item.route_id);
      outcome.deferred = true;
      continue;
    }

    try {
      const route = await deps.send(item);
      await store.deleteOutbox(item.id);
      await saveFromServer(route);
      outcome.sent += 1;
    } catch (error) {
      const failure = deps.classify(error);

      if (failure.kind === 'auth') {
        outcome.authLost = true;
        return outcome;
      }

      if (failure.kind === 'retry') {
        const attempts = item.attempts + 1;
        await store.updateOutbox(item.id, {
          attempts,
          next_attempt_at: deps.now() + backoffMs(attempts),
          last_error: failure.message,
        });
        waiting.add(item.route_id);
        outcome.deferred = true;
        continue;
      }

      await store.updateOutbox(item.id, { status: 'rejected', last_error: failure.message });
      outcome.rejected += 1;

      // A tela mostrava a ação como feita. Como o servidor recusou, a cópia
      // local volta a ser a do servidor — ou some, se a rota não existe mais.
      try {
        const route = await deps.fetchRoute(item.route_id);
        if (route) await saveFromServer(route);
        else await store.removeRoute(item.route_id);
      } catch {
        // Sem rede para conferir agora; a próxima atualização da lista corrige.
      }
    }
  }

  // Rotas que ainda têm ação na fila não enviam rastro: o servidor recusaria
  // os pontos de uma rota cuja saída ele ainda não conhece.
  const comAcaoPendente = new Set(
    (await store.listOutbox('pending')).map((item) => item.route_id),
  );

  for (let batch = 0; batch < MAX_PING_BATCHES_PER_RUN; batch += 1) {
    const pings = await store.takePings(PING_BATCH_SIZE, [...comAcaoPendente]);
    if (pings.length === 0) break;

    const routeId = pings[0].route_id;
    const ids = pings.map((ping) => ping.id);

    try {
      await deps.sendPings(routeId, pings);
      await store.deletePings(ids);
      outcome.pingsSent += pings.length;
    } catch (error) {
      const failure = deps.classify(error);

      if (failure.kind === 'auth') {
        outcome.authLost = true;
        break;
      }
      if (failure.kind === 'retry') {
        outcome.deferred = true;
        break;
      }
      // Rota cancelada ou que não é mais deste motorista: o rastro não tem destino.
      await store.deletePings(ids);
    }
  }

  return outcome;
}
