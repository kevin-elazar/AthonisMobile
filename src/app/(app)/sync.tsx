import { StyleSheet, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { dismissRejected, useOutbox, type OutboxEntry } from '@/features/sync/hooks';
import { OUTBOX_KIND_LABELS } from '@/features/sync/model';
import { formatDateTime, plural } from '@/lib/format';
import { requestSync, useSyncState } from '@/services/sync';
import { spacing } from '@/theme/tokens';

function OutboxCard({ item }: { item: OutboxEntry }) {
  const rejected = item.status === 'rejected';

  return (
    <Card testID={`outbox-${item.status}`}>
      <View style={styles.cardHeader}>
        <Text weight="semibold" style={styles.flex}>
          {OUTBOX_KIND_LABELS[item.kind]}
        </Text>
        <Badge
          label={rejected ? 'Recusada' : 'Aguardando envio'}
          tone={rejected ? 'danger' : 'warning'}
          icon={rejected ? 'alert-circle' : 'time-outline'}
        />
      </View>

      <Text variant="bodySm" tone="muted">
        {[`Rota #${item.route_id}`, item.stopLabel, formatDateTime(item.payload.occurred_at)]
          .filter(Boolean)
          .join(' · ')}
      </Text>

      {rejected ? (
        <>
          <Text tone="danger">{item.last_error ?? 'O servidor recusou esta ação.'}</Text>
          <Text variant="bodySm" tone="muted">
            Esta ação não foi registrada. Confira a rota e, se precisar, avise o escritório.
          </Text>
          <Button
            label="Entendi, dispensar"
            variant="secondary"
            onPress={() => void dismissRejected(item.id)}
            testID="outbox-dismiss"
          />
        </>
      ) : item.attempts > 0 ? (
        <Text variant="bodySm" tone="muted">
          {plural(item.attempts, 'tentativa', 'tentativas')} · {item.last_error}
        </Text>
      ) : null}
    </Card>
  );
}

export default function SyncScreen() {
  const state = useSyncState();
  const { data: items = [] } = useOutbox();

  const rejected = items.filter((item) => item.status === 'rejected');
  const pending = items.filter((item) => item.status === 'pending');
  const tudoEnviado = pending.length === 0 && rejected.length === 0 && state.pings === 0;

  return (
    <Screen
      footer={
        <Button
          label={state.syncing ? 'Sincronizando…' : 'Sincronizar agora'}
          icon="sync"
          onPress={() => void requestSync()}
          loading={state.syncing}
          disabled={!state.online}
          large
          testID="sync-now"
        />
      }
    >
      <Card>
        <Text variant="heading4">{state.online ? 'Conectado' : 'Sem conexão'}</Text>
        <Text tone="muted">
          {state.lastSyncAt
            ? `Última sincronização completa: ${formatDateTime(state.lastSyncAt)}`
            : 'Ainda não houve sincronização nesta sessão.'}
        </Text>
        <Text>
          {plural(state.pending, 'ação pendente', 'ações pendentes')} ·{' '}
          {plural(state.pings, 'ponto de trajeto', 'pontos de trajeto')} a enviar
        </Text>
      </Card>

      {!state.online ? (
        <Notice tone="warning">
          Pode continuar trabalhando. Tudo o que você registrar fica guardado neste aparelho e é
          enviado sozinho quando o sinal voltar, com a hora em que foi feito.
        </Notice>
      ) : null}

      {tudoEnviado ? (
        <EmptyState
          icon="cloud-done-outline"
          title="Tudo enviado"
          description="Não há nada aguardando neste aparelho."
        />
      ) : null}

      {rejected.length > 0 ? <Text variant="heading4">Recusadas pelo servidor</Text> : null}
      {rejected.map((item) => (
        <OutboxCard key={item.id} item={item} />
      ))}

      {pending.length > 0 ? <Text variant="heading4">Aguardando envio</Text> : null}
      {pending.map((item) => (
        <OutboxCard key={item.id} item={item} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
