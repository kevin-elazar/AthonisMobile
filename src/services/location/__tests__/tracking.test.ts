import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { store } from '@/services/store';
import { requestSync } from '@/services/sync';
import { getLocationConsent } from '@/features/consent/location-consent';
import {
  grantedTrackingMode,
  lastKnownPosition,
  reconcileTracking,
  requestTrackingPermissions,
  startTracking,
  stopTracking,
  trackingMode,
} from '../tracking';

/**
 * O GPS só pode ser lido durante uma rota e com o consentimento do motorista
 * logado (LGPD). Estes testes garantem as duas travas e a queda para o modo
 * possível quando o sistema nega o segundo plano.
 */

jest.mock('@/services/store', () => {
  const { MemoryStore } = jest.requireActual('@/services/store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('@/services/sync', () => ({ requestSync: jest.fn(async () => undefined) }));
jest.mock('@/features/consent/location-consent', () => ({ getLocationConsent: jest.fn() }));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  isBackgroundLocationAvailableAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));

const loc = jest.mocked(Location);
const consent = jest.mocked(getLocationConsent);

// A tarefa de segundo plano é registrada ao carregar o módulo.
const [, backgroundTask] = jest.mocked(TaskManager.defineTask).mock.calls[0] as unknown as [
  string,
  (body: { data?: { locations: Location.LocationObject[] }; error?: unknown }) => Promise<void>,
];

const granted = { granted: true } as Location.LocationPermissionResponse;
const denied = { granted: false } as Location.LocationPermissionResponse;

const leitura = (latitude: number, extra: Partial<Location.LocationObjectCoords> = {}) =>
  ({
    timestamp: Date.parse('2026-11-17T12:00:00Z'),
    coords: {
      latitude,
      longitude: -49,
      accuracy: 8,
      speed: 3,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      ...extra,
    },
  }) as Location.LocationObject;

let started = false;
const remove = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  await store.clear();
  started = false;
  consent.mockResolvedValue({ version: 1, accepted: true, decidedAt: '2026-11-17T08:00:00Z' });
  loc.getForegroundPermissionsAsync.mockResolvedValue(granted);
  loc.getBackgroundPermissionsAsync.mockResolvedValue(granted);
  loc.hasStartedLocationUpdatesAsync.mockImplementation(async () => started);
  loc.startLocationUpdatesAsync.mockImplementation(async () => {
    started = true;
  });
  loc.stopLocationUpdatesAsync.mockImplementation(async () => {
    started = false;
  });
  loc.watchPositionAsync.mockResolvedValue({ remove } as Location.LocationSubscription);
});

afterEach(async () => {
  await stopTracking();
});

describe('consentimento', () => {
  it.each([
    ['sem decisão', null],
    ['recusado', { version: 1, accepted: false, decidedAt: 'x' }],
  ])('%s: não liga o GPS nem lê a posição', async (_caso, decisao) => {
    consent.mockResolvedValue(decisao);
    expect(await startTracking(5)).toBe('off');
    expect(await lastKnownPosition()).toBeUndefined();
    expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(loc.getLastKnownPositionAsync).not.toHaveBeenCalled();
  });

  it('falha ao ler o consentimento vale como recusa', async () => {
    consent.mockRejectedValue(new Error('banco'));
    expect(await startTracking(5)).toBe('off');
  });
});

describe('ligar e desligar', () => {
  it('com permissão de segundo plano usa o serviço com notificação', async () => {
    expect(await startTracking(5)).toBe('background');
    expect(loc.startLocationUpdatesAsync).toHaveBeenCalledWith(
      'athonis-route-tracking',
      expect.objectContaining({
        foregroundService: expect.objectContaining({ notificationTitle: 'Rota em andamento' }),
      }),
    );
    expect(await trackingMode()).toBe('background');
    expect(await store.getValue('tracking.routeId')).toBe('5');

    // Já ligado: não registra de novo.
    await startTracking(5);
    expect(loc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);

    await stopTracking();
    expect(loc.stopLocationUpdatesAsync).toHaveBeenCalled();
    expect(await trackingMode()).toBe('off');
    expect(await store.getValue('tracking.routeId')).toBeNull();
  });

  it('só "durante o uso": acompanha com o app aberto e grava as leituras', async () => {
    loc.getBackgroundPermissionsAsync.mockResolvedValue(denied);
    expect(await startTracking(5)).toBe('foreground');
    expect(await trackingMode()).toBe('foreground');

    const onLocation = loc.watchPositionAsync.mock.calls[0][1];
    onLocation(leitura(-26.4));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await store.countPings()).toBe(1);
    expect(requestSync).toHaveBeenCalledWith({ minIntervalMs: 60_000 });

    await stopTracking();
    expect(remove).toHaveBeenCalled();
  });

  it('serviço de segundo plano recusado pelo sistema cai para o app aberto', async () => {
    loc.startLocationUpdatesAsync.mockRejectedValue(new Error('foreground service'));
    expect(await startTracking(5)).toBe('foreground');
  });

  it('sem permissão nenhuma, ou sem GPS, a rota segue sem trajeto', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(denied);
    expect(await startTracking(5)).toBe('off');

    loc.getForegroundPermissionsAsync.mockResolvedValue(granted);
    loc.getBackgroundPermissionsAsync.mockResolvedValue(denied);
    loc.watchPositionAsync.mockRejectedValue(new Error('gps'));
    expect(await startTracking(5)).toBe('off');
  });

  it('parar quando o sistema já parou não dá erro', async () => {
    loc.hasStartedLocationUpdatesAsync.mockRejectedValue(new Error('sem tarefa'));
    await expect(stopTracking()).resolves.toBeUndefined();
    expect(await trackingMode()).toBe('off');
  });
});

describe('tarefa de segundo plano', () => {
  it('grava as leituras na rota em andamento', async () => {
    await store.setValue('tracking.routeId', '5');
    await backgroundTask({
      data: { locations: [leitura(-26.4), leitura(-26.41, { speed: -1, accuracy: null })] },
    });

    const pontos = await store.takePingsForRoute(5, 10);
    expect(pontos).toHaveLength(2);
    expect(pontos[0]).toMatchObject({
      latitude: -26.4,
      accuracy_m: 8,
      speed_mps: 3,
      recorded_at: '2026-11-17T12:00:00.000Z',
    });
    // Velocidade negativa é "desconhecida" no Android.
    expect(pontos[1]).toMatchObject({ accuracy_m: null, speed_mps: null });
  });

  it('ignora erro, lote vazio e leitura sem rota ativa', async () => {
    await backgroundTask({ error: new Error('x') });
    await backgroundTask({ data: { locations: [leitura(-26.4)] } });
    await store.setValue('tracking.routeId', '5');
    await backgroundTask({ data: { locations: [] } });
    expect(await store.countPings()).toBe(0);
    expect(requestSync).not.toHaveBeenCalled();
  });
});

describe('permissões', () => {
  it('pede "durante o uso" e depois "o tempo todo"', async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue(granted);
    loc.isBackgroundLocationAvailableAsync.mockResolvedValue(true);
    loc.requestBackgroundPermissionsAsync.mockResolvedValue(granted);
    expect(await requestTrackingPermissions()).toBe('background');

    loc.requestBackgroundPermissionsAsync.mockResolvedValue(denied);
    expect(await requestTrackingPermissions()).toBe('foreground');

    loc.isBackgroundLocationAvailableAsync.mockResolvedValue(false);
    expect(await requestTrackingPermissions()).toBe('foreground');

    loc.isBackgroundLocationAvailableAsync.mockRejectedValue(new Error('Expo Go'));
    expect(await requestTrackingPermissions()).toBe('foreground');

    loc.requestForegroundPermissionsAsync.mockResolvedValue(denied);
    expect(await requestTrackingPermissions()).toBe('off');
  });

  it('lê o que já foi concedido sem abrir diálogo', async () => {
    expect(await grantedTrackingMode()).toBe('background');
    loc.getBackgroundPermissionsAsync.mockResolvedValue(denied);
    expect(await grantedTrackingMode()).toBe('foreground');
    loc.getForegroundPermissionsAsync.mockRejectedValue(new Error('x'));
    expect(await grantedTrackingMode()).toBe('off');
  });
});

describe('ao abrir o aplicativo', () => {
  it('religa a rota em andamento e desliga o que sobrou', async () => {
    await reconcileTracking(5);
    expect(await trackingMode()).toBe('background');

    await reconcileTracking(null);
    expect(await trackingMode()).toBe('off');
    expect(loc.stopLocationUpdatesAsync).toHaveBeenCalledTimes(1);

    // Nada ligado e nada gravado: não mexe em nada.
    await reconcileTracking(null);
    expect(loc.stopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  });
});

describe('posição para a baixa', () => {
  it('usa a última leitura conhecida', async () => {
    loc.getLastKnownPositionAsync.mockResolvedValue(leitura(-26.4));
    expect(await lastKnownPosition()).toEqual({ latitude: -26.4, longitude: -49, accuracy_m: 8 });

    loc.getLastKnownPositionAsync.mockResolvedValue(leitura(-26.4, { accuracy: null }));
    expect(await lastKnownPosition()).toEqual({ latitude: -26.4, longitude: -49 });
  });

  it('sem permissão, sem leitura ou com erro, a baixa sai sem coordenada', async () => {
    loc.getLastKnownPositionAsync.mockResolvedValue(null);
    expect(await lastKnownPosition()).toBeUndefined();

    loc.getLastKnownPositionAsync.mockRejectedValue(new Error('x'));
    expect(await lastKnownPosition()).toBeUndefined();

    loc.getForegroundPermissionsAsync.mockResolvedValue(denied);
    expect(await lastKnownPosition()).toBeUndefined();
  });
});
