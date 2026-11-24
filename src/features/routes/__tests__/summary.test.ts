import type { DriverRoute } from '../model';
import { addDays, daySummary, groupRoutesByDay, weekStats } from '../summary';

const rota = (
  id: number,
  day: string | null,
  statuses: string[],
  extra: Partial<DriverRoute> = {},
): DriverRoute =>
  ({
    route_id: id,
    status: 'planned',
    planned_date: day,
    total_distance_m: 10000,
    total_duration_min: 60,
    started_at: null,
    stops: statuses.map((status, index) => ({ order_id: id * 10 + index, status })),
    ...extra,
  }) as unknown as DriverRoute;

describe('addDays', () => {
  it('atravessa mês e ano', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('resumo do dia', () => {
  it('soma paradas, distância e duração, e prevê o fim da rota em andamento', () => {
    const resumo = daySummary([
      rota(1, '2026-11-20', ['delivered', 'failed', 'planned'], {
        status: 'active',
        started_at: '2026-11-20T11:00:00.000Z',
        total_duration_min: 90,
      }),
      rota(2, '2026-11-20', ['planned'], { total_distance_m: null }),
    ]);
    expect(resumo).toMatchObject({
      routes: 2,
      stops: 4,
      delivered: 1,
      failed: 1,
      open: 2,
      done: 0.5,
      distanceM: 10000,
      durationMin: 150,
      expectedEnd: '2026-11-20T12:30:00.000Z',
    });
  });

  it('sem rotas, sem números', () => {
    expect(daySummary([])).toMatchObject({ stops: 0, done: 0, distanceM: null, expectedEnd: null });
  });
});

describe('agrupamento por dia', () => {
  it('separa hoje, próximas (em ordem) e anteriores (mais recente primeiro)', () => {
    const grupos = groupRoutesByDay(
      [
        rota(5, '2026-11-22', []),
        rota(3, '2026-11-18', []),
        rota(4, '2026-11-20', []),
        rota(2, '2026-11-21', []),
        rota(1, '2026-11-15', []),
        rota(6, null, []),
        rota(7, '2026-11-17', [], { status: 'active' }),
      ],
      '2026-11-20',
    );
    expect(grupos.today.map((r) => r.route_id)).toEqual([4, 6, 7]);
    expect(grupos.upcoming.map((g) => g.day)).toEqual(['2026-11-21', '2026-11-22']);
    expect(grupos.past.map((g) => g.day)).toEqual(['2026-11-18', '2026-11-15']);
  });
});

describe('resumo da semana', () => {
  it('conta só os últimos 7 dias, hoje incluído', () => {
    const stats = weekStats(
      [
        rota(1, '2026-11-20', ['delivered', 'delivered', 'failed'], { status: 'completed' }),
        rota(2, '2026-11-14', ['delivered'], { status: 'completed' }),
        rota(3, '2026-11-13', ['delivered'], { status: 'completed' }),
        rota(4, '2026-11-21', ['planned']),
      ],
      '2026-11-20',
    );
    expect(stats).toEqual({ routesDone: 2, delivered: 3, failed: 1, deliveryRate: 0.75 });
  });

  it('sem paradas resolvidas, a taxa fica vazia', () => {
    expect(weekStats([rota(1, '2026-11-20', ['planned'])], '2026-11-20').deliveryRate).toBeNull();
  });
});
