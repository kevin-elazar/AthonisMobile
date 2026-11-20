/**
 * Versão do navegador: sem rastreamento. O GPS em segundo plano só existe no
 * aplicativo instalado; a versão web serve para conferir as telas.
 */

export type TrackingMode = 'background' | 'foreground' | 'off';

export async function trackingMode(): Promise<TrackingMode> {
  return 'off';
}

export async function requestTrackingPermissions(): Promise<TrackingMode> {
  return 'off';
}

export async function grantedTrackingMode(): Promise<TrackingMode> {
  return 'off';
}

export async function startTracking(_routeId: number): Promise<TrackingMode> {
  return 'off';
}

export async function stopTracking(): Promise<void> {}

export async function reconcileTracking(_activeRouteId: number | null): Promise<void> {}

export async function lastKnownPosition(): Promise<
  { latitude: number; longitude: number; accuracy_m?: number } | undefined
> {
  return undefined;
}
