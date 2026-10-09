import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { onRoutesChanged } from '@/services/sync';
import { performRouteAction, type RouteActionInput } from './actions';
import { loadRoute, loadRoutes } from './repository';

/**
 * Controllers das telas de rota.
 *
 * As consultas rodam mesmo sem rede (`networkMode: 'always'`): quem responde
 * é o banco local, e a rede só o atualiza quando está disponível.
 */

export const routeKeys = {
  all: ['routes'] as const,
  detail: (routeId: number) => ['routes', routeId] as const,
};

export function useRoutes() {
  return useQuery({
    queryKey: routeKeys.all,
    queryFn: loadRoutes,
    networkMode: 'always',
    retry: false,
  });
}

export function useRoute(routeId: number) {
  return useQuery({
    queryKey: routeKeys.detail(routeId),
    queryFn: () => loadRoute(routeId),
    networkMode: 'always',
    retry: false,
    enabled: Number.isFinite(routeId),
  });
}

export function useRouteAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RouteActionInput) => performRouteAction(input),
    networkMode: 'always',
    onSuccess: (route) => {
      queryClient.setQueryData(routeKeys.detail(route.route_id), route);
      void queryClient.invalidateQueries({ queryKey: routeKeys.all, exact: true });
    },
  });
}

/**
 * Relê as rotas do banco local quando a sincronização as altera (ação
 * confirmada ou recusada pelo servidor). Montado uma vez, na raiz das telas
 * autenticadas.
 */
export function useRoutesSyncBridge(): void {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      onRoutesChanged(() => {
        void queryClient.invalidateQueries({ queryKey: routeKeys.all });
      }),
    [queryClient],
  );
}
