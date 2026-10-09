import type { DriverRoute } from '@/features/routes/model';
import type { NewOutboxItem, OutboxItem, OutboxStatus, PingRow } from '@/features/sync/model';

export interface CachedRoutes {
  routes: DriverRoute[];
  /** Dia (AAAA-MM-DD, no aparelho) em que a lista foi buscada. */
  day: string | null;
  fetchedAt: string | null;
}

export type OutboxPatch = Partial<
  Pick<OutboxItem, 'status' | 'attempts' | 'next_attempt_at' | 'last_error'>
>;

/**
 * Banco local do aplicativo.
 *
 * Guarda três coisas: a cópia das rotas (para abrir sem rede), a fila de
 * ações a enviar e o rastro de GPS acumulado. As telas leem daqui, nunca
 * direto da rede.
 *
 * Há duas implementações com este mesmo contrato: SQLite no aparelho e
 * memória no navegador e nos testes.
 */
export interface LocalStore {
  // ---- rotas
  getRoutes(): Promise<CachedRoutes>;
  /** Substitui a lista inteira pela que veio do servidor. */
  replaceRoutes(day: string, routes: DriverRoute[], fetchedAt: string): Promise<void>;
  getRoute(routeId: number): Promise<DriverRoute | null>;
  saveRoute(route: DriverRoute): Promise<void>;
  removeRoute(routeId: number): Promise<void>;

  // ---- fila de ações
  /**
   * Põe a ação na fila e grava a rota já com ela aplicada, na mesma
   * transação: se o aplicativo fechar no meio, não sobra uma tela mostrando
   * algo que não está na fila, nem o contrário.
   */
  enqueue(item: NewOutboxItem, updatedRoute: DriverRoute): Promise<OutboxItem>;
  /** Em ordem de criação. */
  listOutbox(status?: OutboxStatus): Promise<OutboxItem[]>;
  updateOutbox(id: string, patch: OutboxPatch): Promise<void>;
  deleteOutbox(id: string): Promise<void>;

  // ---- rastro de GPS
  addPings(pings: PingRow[]): Promise<void>;
  /**
   * Os pontos mais antigos de uma única rota (a do ponto mais antigo que
   * não esteja em `excludeRouteIds`), em ordem de leitura.
   */
  takePings(limit: number, excludeRouteIds?: number[]): Promise<PingRow[]>;
  deletePings(ids: string[]): Promise<void>;
  countPings(): Promise<number>;

  // ---- valores avulsos
  getValue(key: string): Promise<string | null>;
  setValue(key: string, value: string | null): Promise<void>;

  /** Apaga tudo. Chamado no logout confirmado. */
  clear(): Promise<void>;
}
