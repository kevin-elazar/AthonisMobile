import { driverProfileSchema, type DriverProfile } from '@/features/auth/model';
import {
  driverRouteSchema,
  driverRoutesSchema,
  type DriverRoute,
} from '@/features/routes/model';
import type { OutboxItem, PingRow } from '@/features/sync/model';
import { api } from './client';
import { httpStatus } from './errors';

/** Chamadas da API do aplicativo (`/driver/*`). */

export async function fetchProfile(): Promise<DriverProfile> {
  const { data } = await api.get('/driver/me');
  return driverProfileSchema.parse(data);
}

/** Rotas de hoje. O "hoje" é decidido pelo servidor, no fuso da empresa. */
export async function fetchRoutes(): Promise<DriverRoute[]> {
  const { data } = await api.get('/driver/routes');
  return driverRoutesSchema.parse(data);
}

/** Devolve null quando a rota não existe mais para este motorista. */
export async function fetchRoute(routeId: number): Promise<DriverRoute | null> {
  try {
    const { data } = await api.get(`/driver/routes/${routeId}`);
    return driverRouteSchema.parse(data);
  } catch (error) {
    if (httpStatus(error) === 404) return null;
    throw error;
  }
}

function actionPath(item: OutboxItem): string {
  const route = `/driver/routes/${item.route_id}`;
  switch (item.kind) {
    case 'route_start':
      return `${route}/start`;
    case 'route_finish':
      return `${route}/finish`;
    case 'stop_arrive':
      return `${route}/stops/${item.order_id}/arrive`;
    case 'stop_deliver':
      return `${route}/stops/${item.order_id}/deliver`;
    case 'stop_fail':
      return `${route}/stops/${item.order_id}/fail`;
  }
}

/**
 * Envia uma ação da fila. O `id` do item vai como `client_event_id`: se a
 * resposta se perder e o item for reenviado, o servidor reconhece e não
 * registra de novo.
 */
export async function sendAction(item: OutboxItem): Promise<DriverRoute> {
  const { data } = await api.post(actionPath(item), {
    client_event_id: item.id,
    ...item.payload,
  });
  return driverRouteSchema.parse(data);
}

export async function sendPings(routeId: number, pings: PingRow[]): Promise<void> {
  await api.post(`/driver/routes/${routeId}/locations`, {
    points: pings.map((ping) => ({
      client_ping_id: ping.id,
      recorded_at: ping.recorded_at,
      latitude: ping.latitude,
      longitude: ping.longitude,
      ...(ping.accuracy_m != null ? { accuracy_m: ping.accuracy_m } : {}),
      ...(ping.speed_mps != null ? { speed_mps: ping.speed_mps } : {}),
    })),
  });
}
