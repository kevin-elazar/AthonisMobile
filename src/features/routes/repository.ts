import { mergePending } from '@/features/sync/apply';
import { localDay } from '@/lib/format';
import { fetchRoutes } from '@/services/api/driver';
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
    const pending = await store.listOutbox('pending');
    await store.replaceRoutes(
      localDay(),
      server.map((route) => mergePending(route, pending)),
      new Date().toISOString(),
    );
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    offline = true;
  }

  return { ...(await readLocal()), offline };
}

export async function loadRoute(routeId: number): Promise<DriverRoute | null> {
  return store.getRoute(routeId);
}
