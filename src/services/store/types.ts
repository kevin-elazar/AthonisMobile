import type { DriverRoute } from '@/features/routes/model';
import type { NewOutboxItem, OutboxItem, OutboxStatus, PingRow } from '@/features/sync/model';

export interface CachedRoutes {
  routes: DriverRoute[];
  /** Dia (AAAA-MM-DD, no aparelho) em que a lista foi buscada. */
  day: string | null;
  fetchedAt: string | null;
}

/** Reaplica as ações pendentes sobre a rota vinda do servidor (`mergePending`). */
export type MergePending = (route: DriverRoute, pending: OutboxItem[]) => DriverRoute;

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
  /**
   * Grava a rota que veio do servidor com as ações ainda pendentes
   * reaplicadas. Ler a fila e gravar a rota acontecem de uma vez só: uma ação
   * enfileirada no meio não pode ficar de fora da cópia local.
   */
  saveServerRoute(route: DriverRoute, merge: MergePending): Promise<void>;
  /** Como `replaceRoutes`, reaplicando as ações pendentes de uma vez só (ver `saveServerRoute`). */
  replaceServerRoutes(
    day: string,
    routes: DriverRoute[],
    fetchedAt: string,
    merge: MergePending,
  ): Promise<void>;

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
  /** Os pontos mais antigos de uma rota específica, em ordem de leitura. */
  takePingsForRoute(routeId: number, limit: number): Promise<PingRow[]>;
  deletePings(ids: string[]): Promise<void>;
  countPings(): Promise<number>;

  // ---- valores avulsos
  getValue(key: string): Promise<string | null>;
  setValue(key: string, value: string | null): Promise<void>;

  /** Apaga tudo. Chamado no logout confirmado. */
  clear(): Promise<void>;
}
