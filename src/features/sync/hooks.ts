import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { store } from '@/services/store';
import { refreshSyncCounts, useSyncState } from '@/services/sync';
import type { OutboxItem } from './model';

export interface OutboxEntry extends OutboxItem {
  /** Nome do cliente ou título do pedido, para o entregador reconhecer a ação. */
  stopLabel: string | null;
}

async function loadOutbox(): Promise<OutboxEntry[]> {
  const [items, cached] = await Promise.all([store.listOutbox(), store.getRoutes()]);

  return items.map((item) => {
    const stop = cached.routes
      .find((route) => route.route_id === item.route_id)
      ?.stops.find((entry) => entry.order_id === item.order_id);

    return { ...item, stopLabel: stop ? (stop.client_name ?? stop.title) : null };
  });
}

const outboxKey = ['outbox'] as const;

/** Itens da fila para a tela de sincronização, relidos sempre que os contadores mudam. */
export function useOutbox() {
  const queryClient = useQueryClient();
  const { pending, rejected, syncing } = useSyncState();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: outboxKey });
  }, [queryClient, pending, rejected, syncing]);

  return useQuery({ queryKey: outboxKey, queryFn: loadOutbox, networkMode: 'always' });
}

/** Tira da fila uma ação recusada, depois que o entregador tomou conhecimento dela. */
export async function dismissRejected(id: string): Promise<void> {
  await store.deleteOutbox(id);
  await refreshSyncCounts();
}
