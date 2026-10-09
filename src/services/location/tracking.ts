import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { PingRow } from '@/features/sync/model';
import { uuid } from '@/lib/uuid';
import { store } from '@/services/store';
import { requestSync } from '@/services/sync';

/**
 * Rastreamento de GPS de uma rota em andamento.
 *
 * Liga na saída e desliga no encerramento: fora de uma rota ativa o
 * aplicativo não lê a posição de ninguém. No Android o rastreamento roda
 * como serviço em primeiro plano, com notificação fixa, que é o que o
 * sistema exige para continuar lendo o GPS com a tela apagada.
 */

const TASK_NAME = 'athonis-route-tracking';
const ROUTE_KEY = 'tracking.routeId';

/** Uma leitura a cada 15 s ou 50 m, o que vier primeiro. */
const TIME_INTERVAL_MS = 15_000;
const DISTANCE_INTERVAL_M = 50;

/** A tarefa de GPS pede sincronização a cada leitura; o envio em si acontece no máximo uma vez por minuto. */
const SYNC_MIN_INTERVAL_MS = 60_000;

export type TrackingMode =
  /** Serviço em segundo plano: continua com a tela apagada. */
  | 'background'
  /** Só com o aplicativo aberto (permissão "sempre" negada, ou Expo Go). */
  | 'foreground'
  /** Sem permissão de localização: a rota segue, sem medição de trajeto. */
  | 'off';

function toPing(routeId: number, location: Location.LocationObject): PingRow {
  const { coords, timestamp } = location;
  return {
    id: uuid(),
    route_id: routeId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy_m: coords.accuracy ?? null,
    speed_mps: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
    recorded_at: new Date(timestamp).toISOString(),
  };
}

async function record(locations: Location.LocationObject[]): Promise<void> {
  const routeId = Number(await store.getValue(ROUTE_KEY));
  if (!routeId || locations.length === 0) return;

  await store.addPings(locations.map((location) => toPing(routeId, location)));
  void requestSync({ minIntervalMs: SYNC_MIN_INTERVAL_MS });
}

/**
 * Precisa ser definida no escopo do módulo: quando o sistema acorda o
 * aplicativo em segundo plano só para entregar uma leitura, nenhuma tela é
 * montada — só os módulos são carregados.
 */
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  TASK_NAME,
  async ({ data, error }) => {
    if (error || !data?.locations) return;
    await record(data.locations);
  },
);

let foregroundWatch: Location.LocationSubscription | null = null;

async function backgroundRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  } catch {
    return false;
  }
}

export async function trackingMode(): Promise<TrackingMode> {
  if (await backgroundRunning()) return 'background';
  return foregroundWatch ? 'foreground' : 'off';
}

/**
 * Pede as permissões em duas etapas, como o Android e o iOS exigem: primeiro
 * "durante o uso", depois "o tempo todo". Chamar só depois de explicar ao
 * entregador por que o aplicativo quer a localização.
 */
export async function requestTrackingPermissions(): Promise<TrackingMode> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return 'off';

  try {
    if (!(await Location.isBackgroundLocationAvailableAsync())) return 'foreground';
    const background = await Location.requestBackgroundPermissionsAsync();
    return background.granted ? 'background' : 'foreground';
  } catch {
    // No Expo Go o módulo de segundo plano não está disponível.
    return 'foreground';
  }
}

/** O que já foi concedido, sem abrir nenhum diálogo. */
export async function grantedTrackingMode(): Promise<TrackingMode> {
  try {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (!foreground.granted) return 'off';
    const background = await Location.getBackgroundPermissionsAsync();
    return background.granted ? 'background' : 'foreground';
  } catch {
    return 'off';
  }
}

/**
 * Liga o rastreamento da rota no melhor modo que as permissões permitem.
 * Nunca lança erro: sem GPS a rota continua, apenas sem trajeto medido.
 */
export async function startTracking(routeId: number): Promise<TrackingMode> {
  await store.setValue(ROUTE_KEY, String(routeId));
  const granted = await grantedTrackingMode();
  if (granted === 'off') return 'off';

  if (granted === 'background') {
    try {
      if (!(await backgroundRunning())) {
        await Location.startLocationUpdatesAsync(TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: TIME_INTERVAL_MS,
          distanceInterval: DISTANCE_INTERVAL_M,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Rota em andamento',
            notificationBody: 'O Athonis está registrando o trajeto desta rota.',
            notificationColor: '#2f5de3',
          },
        });
      }
      return 'background';
    } catch {
      // Cai para o modo com o aplicativo aberto.
    }
  }

  try {
    if (!foregroundWatch) {
      foregroundWatch = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: TIME_INTERVAL_MS,
          distanceInterval: DISTANCE_INTERVAL_M,
        },
        (location) => void record([location]),
      );
    }
    return 'foreground';
  } catch {
    return 'off';
  }
}

export async function stopTracking(): Promise<void> {
  foregroundWatch?.remove();
  foregroundWatch = null;

  try {
    if (await backgroundRunning()) {
      await Location.stopLocationUpdatesAsync(TASK_NAME);
    }
  } catch {
    // Já estava parado.
  }

  await store.setValue(ROUTE_KEY, null);
}

/**
 * Ao abrir o aplicativo: se há uma rota em andamento, garante que o
 * rastreamento está ligado (o sistema pode tê-lo encerrado); se não há,
 * garante que está desligado.
 */
export async function reconcileTracking(activeRouteId: number | null): Promise<void> {
  if (activeRouteId == null) {
    if ((await trackingMode()) !== 'off' || (await store.getValue(ROUTE_KEY))) {
      await stopTracking();
    }
    return;
  }
  await startTracking(activeRouteId);
}

/**
 * Posição para anexar a uma baixa. Usa a última leitura conhecida e nunca
 * segura a tela esperando o GPS: a baixa vale mais do que a coordenada.
 */
export async function lastKnownPosition(): Promise<
  { latitude: number; longitude: number; accuracy_m?: number } | undefined
> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return undefined;

    const location = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    if (!location) return undefined;

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      ...(location.coords.accuracy != null ? { accuracy_m: location.coords.accuracy } : {}),
    };
  } catch {
    return undefined;
  }
}
