import { mergePending } from '@/features/sync/apply';
import { localDay } from '@/lib/format';
import { fetchRoute, fetchRoutes, fetchRoutesInRange } from '@/services/api/driver';
import { isNetworkError } from '@/services/api/errors';
import { store } from '@/services/store';
import type { DriverRoute } from './model';

export interface RoutesView {
  routes: DriverRoute[];
  /** Quando a lista foi buscada no servidor pela última vez. */
  fetchedAt: string | null;
  /** A última tentativa de atualizar falhou por falta de rede; a lista é a cópia local. */
  offline: boolean;
}

/**
 * Lê as rotas do banco local.
 *
 * Uma cópia de outro dia não é mostrada como "rotas de hoje" — exceto a rota
 * em andamento, que o entregador precisa conseguir terminar mesmo que o dia
 * tenha virado sem rede.
 */
async function readLocal(): Promise<Pick<RoutesView, 'routes' | 'fetchedAt'>> {
  const cached = await store.getRoutes();
  const routes =
    cached.day === localDay()
      ? cached.routes
      : cached.routes.filter((route) => route.status === 'active');

  return {
    routes: routes
      .filter((route) => route.status !== 'cancelled')
      .sort((a, b) => a.route_id - b.route_id),
    fetchedAt: cached.fetchedAt,
  };
}

/**
 * Atualiza a cópia local a partir do servidor e devolve o que há para
 * mostrar. Sem rede, devolve a cópia local e avisa que está offline; outros
 * erros (sessão, servidor) sobem para a tela.
 */
export async function loadRoutes(): Promise<RoutesView> {
  let offline = false;

  try {
    const server = await fetchRoutes();
    // As ações ainda na fila são reaplicadas por cima do que veio do
    // servidor: ele ainda não sabe delas, e a tela não pode "desfazê-las".
    // Ler a fila e gravar acontecem de uma vez só, no próprio banco local.
    await store.replaceServerRoutes(localDay(), server, new Date().toISOString(), mergePending);
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    offline = true;
  }

  return { ...(await readLocal()), offline };
}

/**
 * Rota aberta só para consulta: veio do servidor e não está no aparelho
 * (outro dia, vista em "Minhas rotas"). Sem cópia local não há fila offline,
 * então a tela não oferece as ações.
 */
export type LoadedRoute = DriverRoute & { preview?: boolean };

/**
 * A rota do aparelho; se não estiver nele (rota de outro dia), busca no
 * servidor para consulta.
 */
export async function loadRoute(routeId: number): Promise<LoadedRoute | null> {
  const local = await store.getRoute(routeId);
  if (local) return local;

  try {
    const remote = await fetchRoute(routeId);
    return remote ? { ...remote, preview: true } : null;
  } catch (error) {
    if (isNetworkError(error)) return null;
    throw error;
  }
}

/** Período da lista "Minhas rotas": 14 dias para trás e 14 para a frente. */
export const MY_ROUTES_PAST_DAYS = 14;
export const MY_ROUTES_NEXT_DAYS = 14;

/** Rotas do período, direto do servidor (a lista precisa de rede). */
export async function loadRoutesInRange(from: string, to: string): Promise<DriverRoute[]> {
  return fetchRoutesInRange(from, to);
}
