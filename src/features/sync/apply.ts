import type { DriverRoute, DriverStop } from '@/features/routes/model';
import type { OutboxItem } from './model';

type Action = Pick<OutboxItem, 'kind' | 'order_id' | 'payload'>;

/**
 * Aplica uma ação do entregador sobre a cópia local da rota.
 *
 * É a mesma regra que o servidor aplica ao receber a ação. Fica aqui, como
 * função pura, por dois motivos: a tela responde na hora, sem esperar a
 * rede; e, quando chega uma versão nova da rota do servidor, as ações que
 * ainda estão na fila são reaplicadas por cima dela (`mergePending`), para
 * que uma baixa feita sem sinal não "desapareça" da tela ao sincronizar.
 */
export function applyAction(route: DriverRoute, action: Action): DriverRoute {
  const at = action.payload.occurred_at;

  const updateStop = (change: (stop: DriverStop) => DriverStop): DriverRoute => ({
    ...route,
    stops: route.stops.map((stop) => (stop.order_id === action.order_id ? change(stop) : stop)),
  });

  switch (action.kind) {
    case 'route_start':
      if (route.status !== 'planned') return route;
      return {
        ...route,
        status: 'active',
        started_at: at,
        stops: route.stops.map((stop) =>
          stop.status === 'planned' || stop.status === 'pending'
            ? { ...stop, status: 'in_route' }
            : stop,
        ),
      };

    case 'stop_arrive':
      return updateStop((stop) => (stop.arrived_at ? stop : { ...stop, arrived_at: at }));

    case 'stop_deliver':
      return updateStop((stop) => ({
        ...stop,
        status: 'delivered',
        completed_at: at,
        occurrence_type: null,
        notes: action.payload.notes ?? null,
      }));

    case 'stop_fail':
      return updateStop((stop) => ({
        ...stop,
        status: 'failed',
        completed_at: at,
        occurrence_type: action.payload.occurrence_type ?? 'other',
        notes: action.payload.notes ?? null,
      }));

    case 'route_finish':
      if (route.status !== 'active') return route;
      return { ...route, status: 'completed', finished_at: at };

    case 'route_cancel':
      // As paradas em aberto voltam para o escritório; a rota sai da lista do entregador.
      if (route.status !== 'active') return route;
      return { ...route, status: 'cancelled' };
  }
}

/**
 * Rota vinda do servidor, com as ações pendentes desta rota reaplicadas na
 * ordem em que foram feitas.
 */
export function mergePending(route: DriverRoute, pending: OutboxItem[]): DriverRoute {
  return pending
    .filter((item) => item.route_id === route.route_id && item.status === 'pending')
    .sort((a, b) => a.seq - b.seq)
    .reduce(applyAction, route);
}
