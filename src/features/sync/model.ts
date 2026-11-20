import type { OccurrenceType } from '@/features/routes/model';

/**
 * Fila offline: o que o entregador fez e ainda não chegou ao servidor.
 *
 * Cada item é uma chamada da API esperando para acontecer. O `id` é o
 * `client_event_id` enviado ao backend, que o usa para reconhecer um
 * reenvio e não registrar duas vezes.
 */

export const OUTBOX_KINDS = [
  'route_start',
  'stop_arrive',
  'stop_deliver',
  'stop_fail',
  'route_finish',
  'route_cancel',
] as const;
export type OutboxKind = (typeof OUTBOX_KINDS)[number];

/**
 * pending  → aguardando envio (ou nova tentativa)
 * rejected → o servidor recusou em definitivo; fica visível para o entregador
 *
 * Item enviado com sucesso é apagado: o que vale passa a ser o servidor.
 */
export type OutboxStatus = 'pending' | 'rejected';

export interface OutboxPayload {
  /** Hora do aparelho no momento do toque. Não é a hora do envio. */
  occurred_at: string;
  latitude?: number;
  longitude?: number;
  accuracy_m?: number;
  notes?: string;
  occurrence_type?: OccurrenceType;
  /** Motivo do cancelamento da rota. */
  reason?: string;
}

export interface OutboxItem {
  /** UUID gerado no aparelho; é o `client_event_id` da API. */
  id: string;
  /** Ordem de criação. A fila de uma rota é enviada estritamente nesta ordem. */
  seq: number;
  route_id: number;
  order_id: number | null;
  kind: OutboxKind;
  payload: OutboxPayload;
  status: OutboxStatus;
  attempts: number;
  /** Epoch em ms antes do qual o item não deve ser reenviado. */
  next_attempt_at: number;
  last_error: string | null;
  created_at: string;
}

export type NewOutboxItem = Pick<OutboxItem, 'id' | 'route_id' | 'order_id' | 'kind' | 'payload'>;

/** Um ponto do rastro de GPS aguardando envio. */
export interface PingRow {
  id: string;
  route_id: number;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  recorded_at: string;
}

export const OUTBOX_KIND_LABELS: Record<OutboxKind, string> = {
  route_start: 'Saída para a rota',
  stop_arrive: 'Chegada à parada',
  stop_deliver: 'Entrega',
  stop_fail: 'Ocorrência',
  route_finish: 'Encerramento da rota',
  route_cancel: 'Cancelamento da rota',
};
