import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { RouteStatusBadge } from '@/components/domain/status-badges';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useMyRoutes } from '@/features/routes/hooks';
import { routeProgress, type DriverRoute } from '@/features/routes/model';
import { groupRoutesByDay, weekStats, type RoutesOfDay } from '@/features/routes/summary';
import { formatDay, formatDistance, formatDuration, localDay, plural } from '@/lib/format';
import { errorMessage, isNetworkError } from '@/services/api/errors';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "hoje · 19/11/2026", "amanhã · 20/11/2026", "sábado · 21/11/2026". */
function dayLabel(day: string, today: string): string {
  const [year, month, date] = day.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, date)).getUTCDay()];
  const [ty, tm, td] = today.split('-').map(Number);
  const diff = Math.round(
    (Date.UTC(year, month - 1, date) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
  );
  const relativo = diff === 0 ? 'hoje' : diff === 1 ? 'amanhã' : diff === -1 ? 'ontem' : weekday;
  return `${relativo} · ${formatDay(day)}`;
}

function MyRouteCard({ route }: { route: DriverRoute }) {
  const router = useRouter();
  const theme = useTheme();
  const progress = routeProgress(route);

  return (
    <Card
      onPress={() => router.push({ pathname: '/route/[id]', params: { id: route.route_id } })}
      accessibilityLabel={`Rota ${route.route_id}, ${plural(progress.total, 'parada', 'paradas')}`}
      testID={`my-route-${route.route_id}`}
    >
      <View style={styles.cardHeader}>
        <Text variant="heading4">Rota #{route.route_id}</Text>
        <RouteStatusBadge status={route.status} />
      </View>
      <Text tone="muted" numberOfLines={1}>
        {[route.region, route.vehicle?.plate ?? route.vehicle?.name].filter(Boolean).join(' · ') ||
          'Sem região definida'}
      </Text>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Ionicons name="cube-outline" size={16} color={theme.muted} />
          <Text variant="bodySm">
            {route.status === 'planned'
              ? plural(progress.total, 'parada', 'paradas')
              : `${progress.delivered + progress.failed} de ${progress.total}`}
          </Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="map-outline" size={16} color={theme.muted} />
          <Text variant="bodySm">{formatDistance(route.total_distance_m)}</Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="time-outline" size={16} color={theme.muted} />
          <Text variant="bodySm">{formatDuration(route.total_duration_min)}</Text>
        </View>
        {progress.failed > 0 ? (
          <Text variant="bodySm" tone="danger">
            {plural(progress.failed, 'ocorrência', 'ocorrências')}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function DaySection({ group, today }: { group: RoutesOfDay; today: string }) {
  return (
    <View style={styles.section} testID={`day-${group.day}`}>
      <Text variant="label" tone="muted" weight="semibold" style={styles.dayLabel}>
        {dayLabel(group.day, today)}
      </Text>
      {group.routes.map((route) => (
        <MyRouteCard key={route.route_id} route={route} />
      ))}
    </View>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
}) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surfaceMuted }]}>
      <Text variant="heading4" tone={tone}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

/**
 * Todas as rotas do motorista: próximos 14 dias e últimos 14. A tela inicial
 * continua mostrando só as de hoje; aqui ele se programa e consulta o que já
 * fez. Precisa de rede.
 */
export default function MyRoutesScreen() {
  const today = localDay();
  const { data, error, isPending, isRefetching, refetch } = useMyRoutes(today);

  if (isPending) {
    return (
      <Screen>
        <LoadingState label="Buscando suas rotas…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen refreshing={isRefetching} onRefresh={() => void refetch()}>
        <ErrorState
          title={isNetworkError(error) ? 'Sem conexão' : 'Não foi possível carregar as rotas'}
          description={
            isNetworkError(error)
              ? 'A lista de todas as rotas precisa de internet. As rotas de hoje continuam na tela inicial.'
              : errorMessage(error)
          }
          actionLabel="Tentar de novo"
          onAction={() => void refetch()}
        />
      </Screen>
    );
  }

  const grupos = groupRoutesByDay(data, today);
  const semana = weekStats(data, today);
  const vazio = data.length === 0;

  return (
    <Screen refreshing={isRefetching} onRefresh={() => void refetch()}>
      <Card>
        <Text variant="label" tone="muted" weight="semibold">
          ÚLTIMOS 7 DIAS
        </Text>
        <View style={styles.stats}>
          <Stat label="rotas concluídas" value={String(semana.routesDone)} />
          <Stat label="entregues" value={String(semana.delivered)} tone="success" />
          <Stat
            label="não entregues"
            value={String(semana.failed)}
            tone={semana.failed ? 'danger' : undefined}
          />
        </View>
        <Text variant="bodySm" tone="muted" testID="week-rate">
          {semana.deliveryRate == null
            ? 'Nenhuma parada resolvida nos últimos 7 dias.'
            : `Taxa de entrega: ${Math.round(semana.deliveryRate * 100)}%`}
        </Text>
      </Card>

      {vazio ? (
        <EmptyState
          icon="calendar-outline"
          title="Nenhuma rota no período"
          description="Rotas dos últimos 14 dias e dos próximos 14 aparecem aqui."
          actionLabel="Atualizar"
          onAction={() => void refetch()}
        />
      ) : null}

      {grupos.today.length > 0 ? (
        <DaySection group={{ day: today, routes: grupos.today }} today={today} />
      ) : null}

      {grupos.upcoming.length > 0 ? (
        <Text variant="heading4" style={styles.heading}>
          Próximas
        </Text>
      ) : null}
      {grupos.upcoming.map((group) => (
        <DaySection key={group.day} group={group} today={today} />
      ))}

      {grupos.past.length > 0 ? (
        <Text variant="heading4" style={styles.heading}>
          Anteriores
        </Text>
      ) : null}
      {grupos.past.map((group) => (
        <DaySection key={group.day} group={group} today={today} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  dayLabel: {
    textTransform: 'capitalize',
  },
  heading: {
    marginTop: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
});
