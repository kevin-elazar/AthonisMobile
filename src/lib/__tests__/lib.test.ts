import { AxiosError, AxiosHeaders } from 'axios';
import {
  formatDateTime,
  formatDay,
  formatDistance,
  formatDuration,
  formatTime,
  localDay,
  minutesBetween,
  plural,
} from '@/lib/format';
import { formatAddress, navigationUrl } from '@/lib/maps';
import {
  classifyFailure,
  errorMessage,
  httpStatus,
  isNetworkError,
  SessionExpiredError,
} from '@/services/api/errors';
import {
  isFinalStop,
  nextStop,
  routeProgress,
  stopStatusLabel,
  type DriverRoute,
  type DriverStop,
} from '@/features/routes/model';
import { loginSchema } from '@/features/auth/model';

const parada = (orderId: number, status: string, extra: Partial<DriverStop> = {}): DriverStop => ({
  order_id: orderId,
  stop_sequence: orderId,
  status,
  title: `Entrega ${orderId}`,
  description: null,
  invoice_number: null,
  quantity: 1,
  urgency: 'normal',
  delivery_window: null,
  client_name: null,
  client_phone: null,
  address: {
    street: 'Rua das Flores',
    number: '10',
    complement: null,
    district: 'Centro',
    city: 'Jaraguá do Sul',
    state: 'SC',
    zipcode: '89251000',
  },
  latitude: null,
  longitude: null,
  planned_arrival: null,
  arrived_at: null,
  completed_at: null,
  occurrence_type: null,
  notes: null,
  ...extra,
});

function erroHttp(status: number | null, data?: unknown): AxiosError {
  const erro = new AxiosError('falhou');
  if (status !== null) {
    erro.response = {
      status,
      data,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
    };
  }
  return erro;
}

describe('formatação', () => {
  it('dia, hora e data', () => {
    expect(localDay(new Date(2026, 0, 5))).toBe('2026-01-05');
    const iso = new Date(2026, 9, 8, 14, 32).toISOString();
    expect(formatTime(iso)).toBe('14:32');
    expect(formatDateTime(iso)).toBe('08/10 14:32');
    expect(formatTime(null)).toBe('—');
    expect(formatTime('x')).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('x')).toBe('—');
    expect(formatDay('2026-10-08')).toBe('08/10/2026');
    expect(formatDay(null)).toBe('—');
    expect(formatDay('2026')).toBe('2026');
  });

  it('distância, duração e plural', () => {
    expect(formatDistance(null)).toBe('—');
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(12345)).toBe('12,3 km');
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(135)).toBe('2 h 15 min');
    expect(formatDuration(-5)).toBe('0 min');
    expect(minutesBetween('2026-01-01T10:00:00Z', '2026-01-01T10:42:00Z')).toBe(42);
    expect(minutesBetween(null, 'x')).toBeNull();
    expect(plural(1, 'parada', 'paradas')).toBe('1 parada');
    expect(plural(3, 'parada', 'paradas')).toBe('3 paradas');
  });
});

describe('mapas', () => {
  it('endereço por extenso e link de navegação', () => {
    const semCoordenada = parada(1, 'planned', {
      address: { ...parada(1, 'x').address, complement: 'Sala 2' },
    });
    expect(formatAddress(semCoordenada)).toBe(
      'Rua das Flores, 10 — Sala 2 · Centro, Jaraguá do Sul/SC',
    );
    expect(navigationUrl(semCoordenada)).toContain(
      encodeURIComponent('Rua das Flores, 10, Centro'),
    );
    const comCoordenada = parada(2, 'planned', { latitude: -26.48, longitude: -49.07 });
    expect(navigationUrl(comCoordenada)).toContain(encodeURIComponent('-26.48,-49.07'));
    expect(navigationUrl(comCoordenada)).toContain('travelmode=driving');
  });
});

describe('erros da API', () => {
  it('mensagens legíveis', () => {
    expect(errorMessage(new SessionExpiredError())).toBe('Sessão expirada. Entre novamente.');
    expect(errorMessage(erroHttp(null))).toBe('Sem conexão com o servidor.');
    expect(errorMessage(erroHttp(400, { message: ['a', 'b'] }))).toBe('a, b');
    expect(
      errorMessage(
        erroHttp(400, { message: 'Inválido', errors: [{ field: 'x', messages: ['m1', 'm2'] }] }),
      ),
    ).toBe('Inválido m1 · m2');
    expect(errorMessage(erroHttp(403))).toContain('permissão');
    expect(errorMessage(erroHttp(404))).toContain('não encontrado');
    expect(errorMessage(erroHttp(502))).toBe('Erro 502 no servidor.');
    expect(errorMessage(new Error('x'))).toBe('x');
    expect(errorMessage('?')).toBe('Erro inesperado.');
  });

  it('classifica a falha da fila', () => {
    expect(classifyFailure(new SessionExpiredError()).kind).toBe('auth');
    expect(classifyFailure(erroHttp(401)).kind).toBe('auth');
    expect(classifyFailure(erroHttp(null)).kind).toBe('retry');
    expect(classifyFailure(erroHttp(429)).kind).toBe('retry');
    expect(classifyFailure(erroHttp(503)).kind).toBe('retry');
    expect(classifyFailure(erroHttp(422)).kind).toBe('reject');
    expect(classifyFailure(erroHttp(408)).kind).toBe('retry');
    expect(isNetworkError(erroHttp(null))).toBe(true);
    expect(httpStatus(new Error('x'))).toBeNull();
  });

  it('erro fora da rede e do HTTP é definitivo, para não travar a fila', () => {
    // Ex.: a resposta 2xx não passou na validação do esquema.
    const zod = loginSchema.safeParse({ email: '', password: '' });
    expect(zod.success).toBe(false);
    expect(classifyFailure(zod.error).kind).toBe('reject');
    expect(classifyFailure(new Error('quebrou')).kind).toBe('reject');
    expect(classifyFailure('?').kind).toBe('reject');
  });
});

describe('modelo da rota', () => {
  const rota = {
    route_id: 1,
    status: 'active',
    stops: [
      parada(1, 'delivered'),
      parada(2, 'failed'),
      parada(3, 'in_route'),
      parada(4, 'planned'),
    ],
  } as unknown as DriverRoute;

  it('progresso e próxima parada', () => {
    expect(routeProgress(rota)).toEqual({ total: 4, delivered: 1, failed: 1, open: 2 });
    expect(nextStop(rota)?.order_id).toBe(3);
    expect(nextStop({ ...rota, stops: [parada(1, 'delivered')] })).toBeNull();
    expect(isFinalStop({ status: 'failed' })).toBe(true);
  });

  it('rótulo da parada', () => {
    expect(stopStatusLabel({ status: 'delivered', arrived_at: null })).toBe('Entregue');
    expect(stopStatusLabel({ status: 'failed', arrived_at: null })).toBe('Não entregue');
    expect(stopStatusLabel({ status: 'in_route', arrived_at: 'x' })).toBe('No local');
    expect(stopStatusLabel({ status: 'in_route', arrived_at: null })).toBe('A caminho');
    expect(stopStatusLabel({ status: 'planned', arrived_at: null })).toBe('Aguardando saída');
  });

  it('valida o login', () => {
    expect(loginSchema.safeParse({ email: 'm@x.com', password: '1' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'm', password: '' }).success).toBe(false);
  });
});
