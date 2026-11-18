import { plural } from '@/lib/format';
import { stopTracking } from '@/services/location/tracking';
import { store } from '@/services/store';
import { refreshSyncCounts, stopSync } from '@/services/sync';

/**
 * Dono dos dados locais.
 *
 * O aparelho pode ser compartilhado entre motoristas. Quando a sessão expira,
 * o banco local continua com a fila e o rastro de quem estava logado, para
 * que essa pessoa entre de novo e envie tudo. Se quem entra é outra pessoa,
 * esses dados não podem subir com o login dela: o aplicativo avisa e, com o
 * aceite, apaga tudo antes de gravar a nova sessão.
 */

const OWNER_KEY = 'local.owner';

export async function getLocalOwner(): Promise<string | null> {
  return store.getValue(OWNER_KEY);
}

export async function setLocalOwner(userId: number): Promise<void> {
  await store.setValue(OWNER_KEY, String(userId));
}

/**
 * Sessões abertas antes de existir o registro do dono: assume o usuário
 * logado, para que um próximo login de outra pessoa seja reconhecido.
 */
export async function adoptLocalOwner(userId: number): Promise<void> {
  if ((await getLocalOwner()) == null) await setLocalOwner(userId);
}

export interface UnsentData {
  actions: number;
  pings: number;
}

export async function unsentData(): Promise<UnsentData> {
  const [outbox, pings] = await Promise.all([store.listOutbox('pending'), store.countPings()]);
  return { actions: outbox.length, pings };
}

export function discardMessage({ actions, pings }: UnsentData): string {
  const partes = [
    actions > 0 ? plural(actions, 'ação', 'ações') : null,
    pings > 0 ? plural(pings, 'ponto de trajeto', 'pontos de trajeto') : null,
  ].filter(Boolean);
  return `Há ${partes.join(' e ')} não enviados de outro motorista neste aparelho. Entrar apaga esses dados.`;
}

export class LoginCancelledError extends Error {
  constructor() {
    super('Entrada cancelada. Os dados do outro motorista continuam neste aparelho.');
    this.name = 'LoginCancelledError';
  }
}

/**
 * Prepara o banco local para o usuário que está entrando. Chamado antes de a
 * sessão ser gravada.
 *
 * - Mesmo dono: mantém tudo.
 * - Outro dono (ou dono desconhecido), com dados não enviados: pergunta.
 *   Recusar lança `LoginCancelledError` e nada é apagado.
 * - Outro dono, aceito ou sem pendências: desliga GPS e sincronização,
 *   apaga o banco (rotas em cache incluídas) e registra o novo dono.
 */
export async function prepareLocalDataFor(
  userId: number,
  confirmDiscard: (unsent: UnsentData) => Promise<boolean>,
): Promise<void> {
  const owner = await getLocalOwner();
  if (owner === String(userId)) return;

  const unsent = await unsentData();
  if (unsent.actions > 0 || unsent.pings > 0) {
    if (!(await confirmDiscard(unsent))) throw new LoginCancelledError();
  }

  await stopTracking();
  await stopSync();
  await store.clear();
  await refreshSyncCounts();
  await setLocalOwner(userId);
}
