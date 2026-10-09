import type { DriverRoute } from '@/features/routes/model';
import type { NewOutboxItem, OutboxItem, OutboxStatus, PingRow } from '@/features/sync/model';
import type { CachedRoutes, LocalStore, OutboxPatch } from './types';

interface State {
  routes: DriverRoute[];
  day: string | null;
  fetchedAt: string | null;
  outbox: OutboxItem[];
  pings: PingRow[];
  values: Record<string, string>;
  seq: number;
}

const emptyState = (): State => ({
  routes: [],
  day: null,
  fetchedAt: null,
  outbox: [],
  pings: [],
  values: {},
  seq: 0,
});

/** Onde o estado é guardado entre recargas. Sem isto, vive só na memória. */
export interface Persistence {
  load(): string | null;
  save(serialized: string): void;
}

/**
 * Implementação em memória do banco local.
 *
 * Usada nos testes da fila offline e na versão web do aplicativo (com
 * `localStorage` como persistência), onde o SQLite nativo não existe.
 */
export class MemoryStore implements LocalStore {
  private state: State;

  constructor(private readonly persistence?: Persistence) {
    this.state = emptyState();
    const saved = persistence?.load();
    if (saved) {
      try {
        this.state = { ...emptyState(), ...(JSON.parse(saved) as State) };
      } catch {
        this.state = emptyState();
      }
    }
  }

  private commit(): void {
    this.persistence?.save(JSON.stringify(this.state));
  }

  async getRoutes(): Promise<CachedRoutes> {
    return {
      routes: structuredClone(this.state.routes),
      day: this.state.day,
      fetchedAt: this.state.fetchedAt,
    };
  }

  async replaceRoutes(day: string, routes: DriverRoute[], fetchedAt: string): Promise<void> {
    this.state.routes = structuredClone(routes);
    this.state.day = day;
    this.state.fetchedAt = fetchedAt;
    this.commit();
  }

  async getRoute(routeId: number): Promise<DriverRoute | null> {
    const route = this.state.routes.find((item) => item.route_id === routeId);
    return route ? structuredClone(route) : null;
  }

  async saveRoute(route: DriverRoute): Promise<void> {
    const index = this.state.routes.findIndex((item) => item.route_id === route.route_id);
    if (index >= 0) this.state.routes[index] = structuredClone(route);
    else this.state.routes.push(structuredClone(route));
    this.commit();
  }

  async removeRoute(routeId: number): Promise<void> {
    this.state.routes = this.state.routes.filter((item) => item.route_id !== routeId);
    this.commit();
  }

  async enqueue(item: NewOutboxItem, updatedRoute: DriverRoute): Promise<OutboxItem> {
    this.state.seq += 1;
    const created: OutboxItem = {
      ...item,
      seq: this.state.seq,
      status: 'pending',
      attempts: 0,
      next_attempt_at: 0,
      last_error: null,
      created_at: item.payload.occurred_at,
    };
    this.state.outbox.push(created);
    await this.saveRoute(updatedRoute);
    return structuredClone(created);
  }

  async listOutbox(status?: OutboxStatus): Promise<OutboxItem[]> {
    return structuredClone(
      this.state.outbox
        .filter((item) => !status || item.status === status)
        .sort((a, b) => a.seq - b.seq),
    );
  }

  async updateOutbox(id: string, patch: OutboxPatch): Promise<void> {
    const item = this.state.outbox.find((entry) => entry.id === id);
    if (item) Object.assign(item, patch);
    this.commit();
  }

  async deleteOutbox(id: string): Promise<void> {
    this.state.outbox = this.state.outbox.filter((entry) => entry.id !== id);
    this.commit();
  }

  async addPings(pings: PingRow[]): Promise<void> {
    const known = new Set(this.state.pings.map((ping) => ping.id));
    this.state.pings.push(...pings.filter((ping) => !known.has(ping.id)));
    this.commit();
  }

  async takePings(limit: number, excludeRouteIds: number[] = []): Promise<PingRow[]> {
    const sorted = this.state.pings
      .filter((ping) => !excludeRouteIds.includes(ping.route_id))
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    if (sorted.length === 0) return [];

    const routeId = sorted[0].route_id;
    return structuredClone(sorted.filter((ping) => ping.route_id === routeId).slice(0, limit));
  }

  async deletePings(ids: string[]): Promise<void> {
    const remove = new Set(ids);
    this.state.pings = this.state.pings.filter((ping) => !remove.has(ping.id));
    this.commit();
  }

  async countPings(): Promise<number> {
    return this.state.pings.length;
  }

  async getValue(key: string): Promise<string | null> {
    return this.state.values[key] ?? null;
  }

  async setValue(key: string, value: string | null): Promise<void> {
    if (value == null) delete this.state.values[key];
    else this.state.values[key] = value;
    this.commit();
  }

  async clear(): Promise<void> {
    this.state = emptyState();
    this.commit();
  }
}
