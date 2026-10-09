import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { StopStatusBadge } from '@/components/domain/status-badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useRoute, useRouteAction } from '@/features/routes/hooks';
import { isFinalStop, OCCURRENCE_LABELS, type OccurrenceType } from '@/features/routes/model';
import { confirm } from '@/lib/confirm';
import { formatTime } from '@/lib/format';
import { formatAddress, openNavigation, openPhone } from '@/lib/maps';
import { errorMessage } from '@/services/api/errors';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function Detail({
  icon,
  label,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={20} color={theme.muted} style={styles.detailIcon} />
      <View style={styles.detailText}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        {typeof children === 'string' ? <Text>{children}</Text> : children}
      </View>
    </View>
  );
}

export default function StopScreen() {
  const params = useLocalSearchParams<{ orderId: string; routeId: string }>();
  const routeId = Number(params.routeId);
  const orderId = Number(params.orderId);
  const router = useRouter();
  const { data: route, isPending } = useRoute(routeId);
  const action = useRouteAction();
  const [notes, setNotes] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  const stop = route?.stops.find((item) => item.order_id === orderId);

  if (isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (!route || !stop) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Parada indisponível"
          description="Esta parada não faz mais parte da sua rota."
          actionLabel="Voltar para as rotas"
          onAction={() => router.replace('/')}
        />
      </Screen>
    );
  }

  const done = isFinalStop(stop);
  const canAct = route.status === 'active' && !done;

  const run = async (kind: 'stop_arrive' | 'stop_deliver') => {
    setFailure(null);
    try {
      await action.mutateAsync({ kind, routeId, orderId, notes });
      if (kind === 'stop_deliver') router.back();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  const deliver = async () => {
    const ok = await confirm({
      title: 'Confirmar a entrega?',
      message: `${stop.client_name ?? stop.title}\n${stop.address.street}, ${stop.address.number}`,
      confirmLabel: 'Entregue',
    });
    if (ok) await run('stop_deliver');
  };

  const footer = canAct ? (
    <>
      <Button
        label="Entregue"
        icon="checkmark-circle"
        variant="success"
        onPress={() => void deliver()}
        loading={action.isPending}
        large
        testID="stop-deliver"
      />
      <Button
        label="Não foi possível entregar"
        icon="alert-circle-outline"
        variant="secondary"
        onPress={() =>
          router.push({ pathname: '/occurrence', params: { routeId, orderId, notes } })
        }
        disabled={action.isPending}
        testID="stop-fail"
      />
    </>
  ) : undefined;

  return (
    <Screen footer={footer}>
      <Stack.Screen options={{ title: `Parada ${stop.stop_sequence ?? ''}`.trim() }} />

      <Card>
        <View style={styles.header}>
          <Text variant="heading4" style={styles.flex}>
            {stop.client_name ?? stop.title}
          </Text>
          <StopStatusBadge stop={stop} />
        </View>

        <Detail icon="location-outline" label="Endereço">
          {`${formatAddress(stop)} · CEP ${stop.address.zipcode}`}
        </Detail>
        <Detail icon="cube-outline" label="Entrega">
          {[
            stop.title,
            `${stop.quantity} un.`,
            stop.invoice_number ? `NF ${stop.invoice_number}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Detail>
        {stop.delivery_window || stop.planned_arrival ? (
          <Detail icon="time-outline" label="Horário">
            {[
              stop.delivery_window ? `Janela ${stop.delivery_window}` : null,
              stop.planned_arrival ? `chegada prevista ${formatTime(stop.planned_arrival)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Detail>
        ) : null}
        {stop.description ? (
          <Detail icon="document-text-outline" label="Observações do pedido">
            {stop.description}
          </Detail>
        ) : null}
      </Card>

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            label="Navegar"
            icon="navigate"
            variant="secondary"
            onPress={() => void openNavigation(stop)}
            testID="stop-navigate"
          />
        </View>
        {stop.client_phone ? (
          <View style={styles.flex}>
            <Button
              label="Ligar"
              icon="call"
              variant="secondary"
              onPress={() => void openPhone(stop.client_phone as string)}
            />
          </View>
        ) : null}
      </View>

      {failure ? <Notice tone="danger">{failure}</Notice> : null}

      {route.status === 'planned' ? (
        <Notice tone="info">Inicie a rota para registrar a chegada e a entrega desta parada.</Notice>
      ) : null}

      {canAct ? (
        <>
          {stop.arrived_at ? (
            <Notice tone="success">{`Chegada registrada às ${formatTime(stop.arrived_at)}.`}</Notice>
          ) : (
            <Button
              label="Cheguei ao local"
              icon="location"
              onPress={() => void run('stop_arrive')}
              loading={action.isPending}
              testID="stop-arrive"
            />
          )}
          <Input
            label="Observação (opcional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex.: recebido pelo porteiro"
            multiline
            maxLength={1000}
            testID="stop-notes"
          />
        </>
      ) : null}

      {done ? (
        <Card testID="stop-result">
          <Text variant="heading4">
            {stop.status === 'delivered' ? 'Entrega concluída' : 'Não entregue'}
          </Text>
          <Text tone="muted">
            {stop.arrived_at ? `Chegada ${formatTime(stop.arrived_at)} · ` : ''}
            Baixa {formatTime(stop.completed_at)}
          </Text>
          {stop.occurrence_type ? (
            <Text tone="danger" weight="medium">
              {OCCURRENCE_LABELS[stop.occurrence_type as OccurrenceType] ?? stop.occurrence_type}
            </Text>
          ) : null}
          {stop.notes ? <Text>{stop.notes}</Text> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  detail: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  detailIcon: {
    marginTop: spacing.xs,
  },
  detailText: {
    flex: 1,
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
