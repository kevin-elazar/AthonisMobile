import * as SQLite from 'expo-sqlite';
import type { DriverRoute } from '@/features/routes/model';
import type {
  NewOutboxItem,
  OutboxItem,
  OutboxKind,
  OutboxStatus,
  PingRow,
} from '@/features/sync/model';
import type { CachedRoutes, LocalStore, OutboxPatch } from './types';

const DATABASE_NAME = 'athonis.db';

/**
 * Cada posição é uma migração, aplicada em ordem e uma única vez. Para
 * mudar o esquema, acrescente um item ao fim — nunca edite um já publicado,
 * porque os aparelhos em campo já o aplicaram.
 */
const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS route (
    route_id INTEGER PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    route_id INTEGER NOT NULL,
    order_id INTEGER,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS outbox_status ON outbox (status, seq);
  CREATE TABLE IF NOT EXISTS ping (
    id TEXT PRIMARY KEY NOT NULL,
    route_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy_m REAL,
    speed_mps REAL,
    recorded_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ping_order ON ping (recorded_at);
  `,
];

interface OutboxRecord {
  seq: number;
  id: string;
  route_id: number;
  order_id: number | null;
  kind: string;
  payload: string;
  status: string;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  created_at: string;
}

const toOutboxItem = (row: OutboxRecord): OutboxItem => ({
  seq: row.seq,
  id: row.id,
  route_id: row.route_id,
  order_id: row.order_id,
  kind: row.kind as OutboxKind,
  payload: JSON.parse(row.payload),
  status: row.status as OutboxStatus,
  attempts: row.attempts,
  next_attempt_at: row.next_attempt_at,
  last_error: row.last_error,
  created_at: row.created_at,
});

const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');

/** Banco local em SQLite, usado no Android e no iOS. */
export class SqliteStore implements LocalStore {
  private opening: Promise<SQLite.SQLiteDatabase> | null = null;

  /**
   * Abre o banco uma vez. A tarefa de localização em segundo plano e a tela
   * podem pedir o banco ao mesmo tempo; as duas recebem a mesma conexão.
   */
  private db(): Promise<SQLite.SQLiteDatabase> {
    if (!this.opening) {
      this.opening = (async () => {
        const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
        await db.execAsync('PRAGMA journal_mode = WAL;');

        const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        const applied = row?.user_version ?? 0;
        for (let version = applied; version < MIGRATIONS.length; version += 1) {
          await db.execAsync(MIGRATIONS[version]);
          await db.execAsync(`PRAGMA user_version = ${version + 1}`);
        }
        return db;
      })();
    }
    return this.opening;
  }

  async getRoutes(): Promise<CachedRoutes> {
    const db = await this.db();
    const rows = await db.getAllAsync<{ payload: string }>(
      'SELECT payload FROM route ORDER BY route_id',
    );
    return {
      routes: rows.map((row) => JSON.parse(row.payload) as DriverRoute),
      day: await this.getValue('routes.day'),
      fetchedAt: await this.getValue('routes.fetchedAt'),
    };
  }

  async replaceRoutes(day: string, routes: DriverRoute[], fetchedAt: string): Promise<void> {
    const db = await this.db();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM route');
      for (const route of routes) {
        await db.runAsync(
          'INSERT INTO route (route_id, payload) VALUES (?, ?)',
          route.route_id,
          JSON.stringify(route),
        );
      }
      await db.runAsync(
        'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?), (?, ?)',
        'routes.day',
        day,
        'routes.fetchedAt',
        fetchedAt,
      );
    });
  }

  async getRoute(routeId: number): Promise<DriverRoute | null> {
    const db = await this.db();
    const row = await db.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM route WHERE route_id = ?',
      routeId,
    );
    return row ? (JSON.parse(row.payload) as DriverRoute) : null;
  }

  async saveRoute(route: DriverRoute): Promise<void> {
    const db = await this.db();
    await db.runAsync(
      'INSERT OR REPLACE INTO route (route_id, payload) VALUES (?, ?)',
      route.route_id,
      JSON.stringify(route),
    );
  }

  async removeRoute(routeId: number): Promise<void> {
    const db = await this.db();
    await db.runAsync('DELETE FROM route WHERE route_id = ?', routeId);
  }

  async enqueue(item: NewOutboxItem, updatedRoute: DriverRoute): Promise<OutboxItem> {
    const db = await this.db();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO outbox (id, route_id, order_id, kind, payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        item.id,
        item.route_id,
        item.order_id,
        item.kind,
        JSON.stringify(item.payload),
        item.payload.occurred_at,
      );
      await db.runAsync(
        'INSERT OR REPLACE INTO route (route_id, payload) VALUES (?, ?)',
        updatedRoute.route_id,
        JSON.stringify(updatedRoute),
      );
    });

    const row = await db.getFirstAsync<OutboxRecord>('SELECT * FROM outbox WHERE id = ?', item.id);
    if (!row) throw new Error('A ação não foi gravada na fila');
    return toOutboxItem(row);
  }

  async listOutbox(status?: OutboxStatus): Promise<OutboxItem[]> {
    const db = await this.db();
    const rows = status
      ? await db.getAllAsync<OutboxRecord>(
          'SELECT * FROM outbox WHERE status = ? ORDER BY seq',
          status,
        )
      : await db.getAllAsync<OutboxRecord>('SELECT * FROM outbox ORDER BY seq');
    return rows.map(toOutboxItem);
  }

  async updateOutbox(id: string, patch: OutboxPatch): Promise<void> {
    const columns = Object.keys(patch) as (keyof OutboxPatch)[];
    if (columns.length === 0) return;

    const db = await this.db();
    await db.runAsync(
      `UPDATE outbox SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((column) => patch[column] ?? null), id],
    );
  }

  async deleteOutbox(id: string): Promise<void> {
    const db = await this.db();
    await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
  }

  async addPings(pings: PingRow[]): Promise<void> {
    if (pings.length === 0) return;
    const db = await this.db();
    await db.withTransactionAsync(async () => {
      for (const ping of pings) {
        await db.runAsync(
          `INSERT OR IGNORE INTO ping (id, route_id, latitude, longitude, accuracy_m, speed_mps, recorded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ping.id,
          ping.route_id,
          ping.latitude,
          ping.longitude,
          ping.accuracy_m,
          ping.speed_mps,
          ping.recorded_at,
        );
      }
    });
  }

  async takePings(limit: number, excludeRouteIds: number[] = []): Promise<PingRow[]> {
    const db = await this.db();
    const exclude = excludeRouteIds.length
      ? `WHERE route_id NOT IN (${placeholders(excludeRouteIds.length)})`
      : '';

    const oldest = await db.getFirstAsync<{ route_id: number }>(
      `SELECT route_id FROM ping ${exclude} ORDER BY recorded_at LIMIT 1`,
      excludeRouteIds,
    );
    if (!oldest) return [];

    return db.getAllAsync<PingRow>(
      'SELECT * FROM ping WHERE route_id = ? ORDER BY recorded_at LIMIT ?',
      oldest.route_id,
      limit,
    );
  }

  async deletePings(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await this.db();
    await db.runAsync(`DELETE FROM ping WHERE id IN (${placeholders(ids.length)})`, ids);
  }

  async countPings(): Promise<number> {
    const db = await this.db();
    const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM ping');
    return row?.total ?? 0;
  }

  async getValue(key: string): Promise<string | null> {
    const db = await this.db();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM kv WHERE key = ?',
      key,
    );
    return row?.value ?? null;
  }

  async setValue(key: string, value: string | null): Promise<void> {
    const db = await this.db();
    if (value == null) await db.runAsync('DELETE FROM kv WHERE key = ?', key);
    else await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
  }

  async clear(): Promise<void> {
    const db = await this.db();
    await db.execAsync('DELETE FROM route; DELETE FROM outbox; DELETE FROM ping; DELETE FROM kv;');
  }
}
