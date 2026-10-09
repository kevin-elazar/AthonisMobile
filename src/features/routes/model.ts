import { z } from 'zod';

/**
 * Model de Rota e Parada: o contrato de `GET /driver/routes`.
 *
 * Validado com Zod na entrada porque o mesmo objeto vai para o banco local e
 * é lido de volta sem rede — um campo fora do formato precisa falhar na
 * hora em que chega, e não dias depois numa tela offline.
 */

export const ROUTE_STATUSES = ['planned', 'active', 'completed', 'cancelled'] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export const OCCURRENCE_TYPES = [
  'customer_absent',
  'address_not_found',
  'refused',
  'damaged_goods',
  'closed_establishment',
  'access_restricted',
  'traffic',
  'other',
] as const;
export type OccurrenceType = (typeof OCCURRENCE_TYPES)[number];

export const OCCURRENCE_LABELS: Record<OccurrenceType, string> = {
  customer_absent: 'Cliente ausente',
  address_not_found: 'Endereço não encontrado',
  refused: 'Recusado pelo cliente',
  damaged_goods: 'Mercadoria avariada',
  closed_establishment: 'Estabelecimento fechado',
  access_restricted: 'Acesso restrito',
  traffic: 'Trânsito ou via bloqueada',
  other: 'Outro motivo',
};

export const driverStopSchema = z.object({
  order_id: z.number(),
  stop_sequence: z.number().nullable(),
  status: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  invoice_number: z.string().nullable(),
  quantity: z.number(),
  urgency: z.string(),
  delivery_window: z.string().nullable(),
  client_name: z.string().nullable(),
  client_phone: z.string().nullable(),
  address: z.object({
    street: z.string(),
    number: z.string(),
    complement: z.string().nullable(),
    district: z.string(),
    city: z.string(),
    state: z.string(),
    zipcode: z.string(),
  }),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  planned_arrival: z.string().nullable(),
  arrived_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  occurrence_type: z.string().nullable(),
  notes: z.string().nullable(),
});
export type DriverStop = z.infer<typeof driverStopSchema>;

export const driverRouteSchema = z.object({
  route_id: z.number(),
  status: z.enum(ROUTE_STATUSES),
  planned_date: z.string().nullable(),
  region: z.string().nullable(),
  simulated: z.boolean(),
  total_distance_m: z.number().nullable(),
  total_duration_min: z.number().nullable(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  vehicle: z
    .object({ vehicle_id: z.number(), name: z.string(), plate: z.string().nullable() })
    .nullable(),
  stops: z.array(driverStopSchema),
});
export type DriverRoute = z.infer<typeof driverRouteSchema>;

export const driverRoutesSchema = z.array(driverRouteSchema);

/** A parada não espera mais nenhuma ação do entregador. */
export function isFinalStop(stop: Pick<DriverStop, 'status'>): boolean {
  return stop.status === 'delivered' || stop.status === 'failed';
}

export interface RouteProgress {
  total: number;
  delivered: number;
  failed: number;
  open: number;
}

export function routeProgress(route: DriverRoute): RouteProgress {
  const delivered = route.stops.filter((stop) => stop.status === 'delivered').length;
  const failed = route.stops.filter((stop) => stop.status === 'failed').length;
  return {
    total: route.stops.length,
    delivered,
    failed,
    open: route.stops.length - delivered - failed,
  };
}

/** Próxima parada a visitar: a primeira ainda sem baixa, na ordem planejada. */
export function nextStop(route: DriverRoute): DriverStop | null {
  return route.stops.find((stop) => !isFinalStop(stop)) ?? null;
}

export const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  planned: 'Planejada',
  active: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export function stopStatusLabel(stop: Pick<DriverStop, 'status' | 'arrived_at'>): string {
  if (stop.status === 'delivered') return 'Entregue';
  if (stop.status === 'failed') return 'Não entregue';
  if (stop.arrived_at) return 'No local';
  if (stop.status === 'in_route') return 'A caminho';
  return 'Aguardando saída';
}
