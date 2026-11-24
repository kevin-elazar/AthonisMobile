import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { onRoutesChanged } from '@/services/sync';
import { performRouteAction, type RouteActionInput } from './actions';
import { localDay } from '@/lib/format';
import {
  loadRoute,
  loadRoutes,
  loadRoutesInRange,
  MY_ROUTES_NEXT_DAYS,
  MY_ROUTES_PAST_DAYS,
} from './repository';
import { addDays } from './summary';

/**
 * Controllers das telas de rota.
 *
 * As consultas rodam mesmo sem rede (`networkMode: 'always'`): quem responde
 * é o banco local, e a rede só o atualiza quando está disponível.
 */

export const routeKeys = {
  all: ['routes'] as const,
  detail: (routeId: number) => ['routes', routeId] as const,
  range: (from: string, to: string) => ['routes', 'range', from, to] as const,
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

/**
 * Rotas de 14 dias para trás a 14 para a frente, para a lista "Minhas
 * rotas". Precisa de rede: sem ela, a consulta falha e a tela avisa.
 */
export function useMyRoutes(today: string = localDay()) {
  const from = addDays(today, -MY_ROUTES_PAST_DAYS);
  const to = addDays(today, MY_ROUTES_NEXT_DAYS);
  return useQuery({
    queryKey: routeKeys.range(from, to),
    queryFn: () => loadRoutesInRange(from, to),
    retry: false,
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
