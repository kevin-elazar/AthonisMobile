import { applyAction } from '@/features/sync/apply';
import type { NewOutboxItem, OutboxKind, OutboxPayload } from '@/features/sync/model';
import { uuid } from '@/lib/uuid';
import { lastKnownPosition, startTracking, stopTracking } from '@/services/location/tracking';
import { store } from '@/services/store';
import { refreshSyncCounts, requestSync } from '@/services/sync';
import { isFinalStop, type DriverRoute, type OccurrenceType } from './model';

export interface RouteActionInput {
  kind: OutboxKind;
  routeId: number;
  orderId?: number;
  notes?: string;
  occurrenceType?: OccurrenceType;
}

/**
 * Confere, com a cópia local, o que o servidor também vai conferir. Recusar
 * aqui evita pôr na fila uma ação que só seria rejeitada horas depois,
 * quando o entregador já não está na frente do cliente.
 */
function validate(route: DriverRoute, input: RouteActionInput): void {
  const stop = input.orderId
    ? route.stops.find((item) => item.order_id === input.orderId)
    : undefined;

  switch (input.kind) {
    case 'route_start':
      if (route.status !== 'planned') throw new Error('Esta rota já foi iniciada.');
      if (route.stops.length === 0) throw new Error('A rota não tem paradas.');
      return;

    case 'route_finish': {
      if (route.status !== 'active') throw new Error('A rota não está em andamento.');
      const abertas = route.stops.filter((item) => !isFinalStop(item)).length;
      if (abertas > 0) {
        throw new Error(
          `Ainda há ${abertas} parada(s) sem baixa. Registre a entrega ou a ocorrência de cada uma.`,
        );
      }
      return;
    }

    default:
      if (route.status !== 'active') throw new Error('Inicie a rota antes de registrar paradas.');
      if (!stop) throw new Error('Esta parada não faz parte da rota.');
      if (isFinalStop(stop)) throw new Error('Esta parada já foi encerrada.');
      if (input.kind === 'stop_fail' && !input.occurrenceType) {
        throw new Error('Informe o motivo da ocorrência.');
      }
  }
}

/**
 * Registra uma ação do entregador.
 *
 * Grava primeiro no aparelho — fila e rota já atualizada, na mesma transação
 * — e só então tenta a rede. A tela não espera o servidor: sem sinal, a ação
 * fica na fila e sobe sozinha depois, com a hora em que foi feita.
 */
export async function performRouteAction(input: RouteActionInput): Promise<DriverRoute> {
  const route = await store.getRoute(input.routeId);
  if (!route) throw new Error('Rota não encontrada neste aparelho. Atualize a lista.');

  validate(route, input);

  // A hora é a do toque; a posição, a última conhecida, sem esperar o GPS.
  const occurredAt = new Date().toISOString();
  const position = await lastKnownPosition();

  const payload: OutboxPayload = {
    occurred_at: occurredAt,
    ...position,
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.kind === 'stop_fail' ? { occurrence_type: input.occurrenceType } : {}),
  };

  const item: NewOutboxItem = {
    id: uuid(),
    route_id: input.routeId,
    order_id: input.orderId ?? null,
    kind: input.kind,
    payload,
  };

  const updated = applyAction(route, item);
  await store.enqueue(item, updated);

  if (input.kind === 'route_start') await startTracking(input.routeId);
  if (input.kind === 'route_finish') await stopTracking();

  await refreshSyncCounts();
  void requestSync();

  return updated;
}
