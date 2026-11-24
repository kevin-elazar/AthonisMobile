import { isFinalStop, routeProgress, type DriverRoute } from './model';

/**
 * Contas das telas de resumo: o painel do dia na tela inicial, a lista
 * "Minhas rotas" e o resumo da semana. Só leem as rotas; nada aqui grava.
 */

/** Soma `dias` a um dia AAAA-MM-DD, sem passar por fuso horário. */
export function addDays(day: string, dias: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, date + dias));
  return result.toISOString().slice(0, 10);
}

export interface DaySummary {
  routes: number;
  stops: number;
  delivered: number;
  failed: number;
  open: number;
  /** Fração das paradas já resolvidas (entregue ou não entregue), de 0 a 1. */
  done: number;
  distanceM: number | null;
  durationMin: number | null;
  /** Fim previsto da rota em andamento: saída + duração planejada. */
  expectedEnd: string | null;
}

export function daySummary(routes: DriverRoute[]): DaySummary {
  let stops = 0;
  let delivered = 0;
  let failed = 0;
  let distance = 0;
  let duration = 0;
  let hasDistance = false;
  let hasDuration = false;
  let expectedEnd: string | null = null;

  for (const route of routes) {
    const progress = routeProgress(route);
    stops += progress.total;
    delivered += progress.delivered;
    failed += progress.failed;
    if (route.total_distance_m != null) {
      distance += route.total_distance_m;
      hasDistance = true;
    }
    if (route.total_duration_min != null) {
      duration += route.total_duration_min;
      hasDuration = true;
    }
    if (route.status === 'active' && route.started_at && route.total_duration_min != null) {
      const fim = new Date(route.started_at).getTime() + route.total_duration_min * 60_000;
      if (Number.isFinite(fim)) expectedEnd = new Date(fim).toISOString();
    }
  }

  return {
    routes: routes.length,
    stops,
    delivered,
    failed,
    open: stops - delivered - failed,
    done: stops === 0 ? 0 : (delivered + failed) / stops,
    distanceM: hasDistance ? distance : null,
    durationMin: hasDuration ? duration : null,
    expectedEnd,
  };
}

export interface RoutesOfDay {
  day: string;
  routes: DriverRoute[];
}

export interface GroupedRoutes {
  today: DriverRoute[];
  /** Próximos dias, do mais perto ao mais longe. */
  upcoming: RoutesOfDay[];
  /** Dias anteriores, do mais recente ao mais antigo. */
  past: RoutesOfDay[];
}

/**
 * Separa as rotas em hoje, próximas e anteriores, agrupadas por dia. A rota
 * em andamento fica sempre em hoje, mesmo planejada para outro dia.
 */
export function groupRoutesByDay(routes: DriverRoute[], today: string): GroupedRoutes {
  const porDia = new Map<string, DriverRoute[]>();
  for (const route of routes) {
    const dia = route.status === 'active' ? today : (route.planned_date?.slice(0, 10) ?? today);
    const lista = porDia.get(dia) ?? [];
    lista.push(route);
    porDia.set(dia, lista);
  }

  const dias = [...porDia.entries()].map(([day, lista]) => ({
    day,
    routes: lista.sort((a, b) => a.route_id - b.route_id),
  }));

  return {
    today: porDia.get(today) ?? [],
    upcoming: dias.filter((item) => item.day > today).sort((a, b) => a.day.localeCompare(b.day)),
    past: dias.filter((item) => item.day < today).sort((a, b) => b.day.localeCompare(a.day)),
  };
}

export interface WeekStats {
  routesDone: number;
  delivered: number;
  failed: number;
  /** Entregues sobre as paradas resolvidas, de 0 a 1; null sem nenhuma. */
  deliveryRate: number | null;
}

/** Resumo dos últimos 7 dias, hoje incluído. */
export function weekStats(routes: DriverRoute[], today: string): WeekStats {
  const inicio = addDays(today, -6);
  let routesDone = 0;
  let delivered = 0;
  let failed = 0;

  for (const route of routes) {
    const dia = route.planned_date?.slice(0, 10);
    if (!dia || dia < inicio || dia > today) continue;
    if (route.status === 'completed') routesDone += 1;
    for (const stop of route.stops) {
      if (!isFinalStop(stop)) continue;
      if (stop.status === 'delivered') delivered += 1;
      else failed += 1;
    }
  }

  const resolvidas = delivered + failed;
  return {
    routesDone,
    delivered,
    failed,
    deliveryRate: resolvidas === 0 ? null : delivered / resolvidas,
  };
}
