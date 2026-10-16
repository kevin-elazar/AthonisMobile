import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { RouteStatusBadge, StopStatusBadge } from '@/components/domain/status-badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useRoute, useRouteAction } from '@/features/routes/hooks';
import {
  isFinalStop,
  nextStop,
  routeProgress,
  type DriverRoute,
  type DriverStop,
} from '@/features/routes/model';
import { confirm } from '@/lib/confirm';
import {
  formatDay,
  formatDistance,
  formatDuration,
  formatTime,
  minutesBetween,
  plural,
} from '@/lib/format';
import { formatAddress } from '@/lib/maps';
import { errorMessage } from '@/services/api/errors';
import { grantedTrackingMode, requestTrackingPermissions } from '@/services/location/tracking';
import { store } from '@/services/store';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const PERMISSION_ASKED_KEY = 'tracking.permissionAsked';

/**
 * Explica o motivo antes de o sistema mostrar o diálogo de permissão, uma
 * única vez. Recusar não impede a rota: ela segue sem medição de trajeto.
 */
async function askTrackingPermissionOnce(): Promise<void> {
  if (Platform.OS === 'web') return;
  if ((await grantedTrackingMode()) === 'background') return;
  if (await store.getValue(PERMISSION_ASKED_KEY)) return;

  await store.setValue(PERMISSION_ASKED_KEY, '1');

  const aceitou = await confirm({
    title: 'Registrar o trajeto da rota?',
    message:
      'Com a rota em andamento, o Athonis registra por onde o veículo passou, mesmo com a tela apagada, para comparar a rota planejada com a executada.\n\nA localização só é lida enquanto há uma rota em andamento. Na próxima tela, escolha "Permitir o tempo todo".',
    confirmLabel: 'Continuar',
    cancelLabel: 'Agora não',
  });

  if (aceitou) await requestTrackingPermissions();
}

function StopRow({ stop, route, isNext }: { stop: DriverStop; route: DriverRoute; isNext: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  const done = isFinalStop(stop);

  return (
    <Card
      onPress={() =>
        router.push({
          pathname: '/stop/[orderId]',
          params: { orderId: stop.order_id, routeId: route.route_id },
        })
      }
      accessibilityLabel={`Parada ${stop.stop_sequence}: ${stop.client_name ?? stop.title}`}
      style={isNext ? { borderColor: theme.primary, borderWidth: 2 } : undefined}
      testID={`stop-row-${stop.order_id}`}
    >
      <View style={styles.stopHeader}>
        <View
          style={[
            styles.sequence,
            { backgroundColor: done ? theme.surfaceMuted : theme.primary },
          ]}
        >
          <Text
            weight="semibold"
            style={{ color: done ? theme.muted : theme.primaryForeground }}
          >
            {stop.stop_sequence ?? '–'}
          </Text>
        </View>
        <View style={styles.stopTitle}>
          <Text weight="semibold" numberOfLines={1}>
            {stop.client_name ?? stop.title}
          </Text>
          <Text variant="bodySm" tone="muted" numberOfLines={2}>
            {formatAddress(stop)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.muted} />
      </View>

      <View style={styles.stopFooter}>
        <StopStatusBadge stop={stop} />
        <Text variant="bodySm" tone="muted">
          {done
            ? `às ${formatTime(stop.completed_at)}`
            : (stop.delivery_window ??
              (stop.planned_arrival ? `previsto ${formatTime(stop.planned_arrival)}` : ''))}
        </Text>
      </View>
    </Card>
  );
}

function Summary({ route }: { route: DriverRoute }) {
  const progress = routeProgress(route);
  const duracao = minutesBetween(route.started_at, route.finished_at);

  return (
    <Card testID="route-summary">
      <Text variant="heading4">Resumo da rota</Text>
      <Text>
        {plural(progress.delivered, 'entrega concluída', 'entregas concluídas')}
        {progress.failed > 0 ? ` · ${plural(progress.failed, 'ocorrência', 'ocorrências')}` : ''}
      </Text>
      <Text tone="muted">
        Saída {formatTime(route.started_at)} · Encerramento {formatTime(route.finished_at)}
        {duracao != null ? ` · ${formatDuration(duracao)}` : ''}
      </Text>
    </Card>
  );
}

export default function RouteScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const routeId = Number(params.id);
  const router = useRouter();
  const { data: route, isPending } = useRoute(routeId);
  const action = useRouteAction();
  const [failure, setFailure] = useState<string | null>(null);

  const run = async (kind: 'route_start' | 'route_finish') => {
    setFailure(null);
    try {
      if (kind === 'route_start') await askTrackingPermissionOnce();
      await action.mutateAsync({ kind, routeId });
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  const finish = async () => {
    const ok = await confirm({
      title: 'Encerrar a rota?',
      message: 'Depois de encerrar, não é possível alterar as paradas.',
      confirmLabel: 'Encerrar',
    });
    if (ok) await run('route_finish');
  };

  if (isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (!route) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Rota indisponível"
          description="Esta rota não está mais atribuída a você ou foi cancelada pelo escritório."
          actionLabel="Voltar para as rotas"
          onAction={() => router.replace('/')}
        />
      </Screen>
    );
  }

  const progress = routeProgress(route);
  const proxima = route.status === 'active' ? nextStop(route) : null;

  const footer =
    route.status === 'planned' ? (
      <Button
        label="Iniciar rota"
        icon="play"
        onPress={() => void run('route_start')}
        loading={action.isPending}
        large
        testID="route-start"
      />
    ) : route.status === 'active' && progress.open === 0 ? (
      <Button
        label="Encerrar rota"
        icon="flag"
        variant="success"
        onPress={() => void finish()}
        loading={action.isPending}
        large
        testID="route-finish"
      />
    ) : proxima ? (
      <Button
        label={`Abrir parada ${proxima.stop_sequence ?? ''}`.trim()}
        icon="arrow-forward"
        onPress={() =>
          router.push({
            pathname: '/stop/[orderId]',
            params: { orderId: proxima.order_id, routeId: route.route_id },
          })
        }
        large
        testID="route-next-stop"
      />
    ) : undefined;

  return (
    <Screen footer={footer}>
      <Stack.Screen options={{ title: `Rota #${route.route_id}` }} />

      <Card>
        <View style={styles.routeHeader}>
          <Text variant="heading4">{route.region ?? 'Rota de entrega'}</Text>
          <RouteStatusBadge status={route.status} />
        </View>
        <Text tone="muted">
          {[
            formatDay(route.planned_date),
            route.vehicle ? (route.vehicle.plate ?? route.vehicle.name) : null,
            formatDistance(route.total_distance_m),
            formatDuration(route.total_duration_min),
          ]
            .filter((item) => item && item !== '—')
            .join(' · ')}
        </Text>
        <Text weight="medium">
          {progress.delivered + progress.failed} de {plural(progress.total, 'parada', 'paradas')}
          {progress.failed > 0 ? ` · ${plural(progress.failed, 'ocorrência', 'ocorrências')}` : ''}
        </Text>
      </Card>

      {route.simulated ? (
        <Notice tone="info">
          Rota estimada, sem a otimização do Google: distância e horários são aproximados.
        </Notice>
      ) : null}
      {failure ? <Notice tone="danger">{failure}</Notice> : null}
      {route.status === 'completed' ? <Summary route={route} /> : null}

      {route.stops.map((stop) => (
        <StopRow
          key={stop.order_id}
          stop={stop}
          route={route}
          isNext={proxima?.order_id === stop.order_id}
        />
      ))}

      {/* No fim da lista, longe do polegar: cancelar é exceção, não o próximo passo. */}
      {route.status === 'active' ? (
        <Button
          label="Cancelar rota"
          icon="close-circle-outline"
          variant="ghost"
          onPress={() =>
            router.push({ pathname: '/cancel-route', params: { routeId: route.route_id } })
          }
          disabled={action.isPending}
          testID="route-cancel"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sequence: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopTitle: {
    flex: 1,
    gap: spacing.xs,
  },
  stopFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
