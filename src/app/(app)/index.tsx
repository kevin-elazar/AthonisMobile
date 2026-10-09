import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { RouteStatusBadge } from '@/components/domain/status-badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useRoutes } from '@/features/routes/hooks';
import { nextStop, routeProgress, type DriverRoute } from '@/features/routes/model';
import { formatDateTime, formatDistance, formatDuration, plural } from '@/lib/format';
import { errorMessage } from '@/services/api/errors';
import { useSession } from '@/services/session';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function RouteCard({ route }: { route: DriverRoute }) {
  const router = useRouter();
  const theme = useTheme();
  const progress = routeProgress(route);
  const proxima = nextStop(route);

  return (
    <Card
      onPress={() => router.push({ pathname: '/route/[id]', params: { id: route.route_id } })}
      accessibilityLabel={`Rota ${route.route_id}, ${plural(progress.total, 'parada', 'paradas')}`}
      testID={`route-card-${route.route_id}`}
    >
      <View style={styles.cardHeader}>
        <Text variant="heading4">Rota #{route.route_id}</Text>
        <RouteStatusBadge status={route.status} />
      </View>

      <Text tone="muted">
        {[route.region, route.vehicle?.plate ?? route.vehicle?.name].filter(Boolean).join(' · ') ||
          'Sem região definida'}
      </Text>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Ionicons name="cube-outline" size={18} color={theme.muted} />
          <Text variant="bodySm">
            {progress.delivered + progress.failed} de {plural(progress.total, 'parada', 'paradas')}
          </Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="map-outline" size={18} color={theme.muted} />
          <Text variant="bodySm">{formatDistance(route.total_distance_m)}</Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="time-outline" size={18} color={theme.muted} />
          <Text variant="bodySm">{formatDuration(route.total_duration_min)}</Text>
        </View>
      </View>

      {route.status === 'active' && proxima ? (
        <Text variant="bodySm" tone="primary" weight="medium" numberOfLines={1}>
          Próxima: {proxima.client_name ?? proxima.title}
        </Text>
      ) : null}
      {progress.failed > 0 ? (
        <Text variant="bodySm" tone="danger">
          {plural(progress.failed, 'ocorrência', 'ocorrências')}
        </Text>
      ) : null}
    </Card>
  );
}

export default function RoutesScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { data, error, isPending, isRefetching, refetch } = useRoutes();

  return (
    <Screen refreshing={isRefetching} onRefresh={() => void refetch()}>
      <View style={styles.greeting}>
        <View style={styles.greetingText}>
          <Text variant="heading3" numberOfLines={1}>
            Olá, {session?.user.name.split(' ')[0]}
          </Text>
          <Text variant="bodySm" tone="muted">
            {data?.fetchedAt
              ? `Atualizado em ${formatDateTime(data.fetchedAt)}`
              : 'Puxe para atualizar'}
          </Text>
        </View>
        <Button
          label="Conta"
          icon="person-circle-outline"
          variant="ghost"
          onPress={() => router.push('/profile')}
        />
      </View>

      {data?.offline ? (
        <Notice tone="warning">
          Sem conexão. Você está vendo a última lista salva neste aparelho; o que registrar será
          enviado quando o sinal voltar.
        </Notice>
      ) : null}

      {isPending ? (
        <LoadingState label="Buscando suas rotas…" />
      ) : error ? (
        <ErrorState
          title="Não foi possível carregar as rotas"
          description={errorMessage(error)}
          actionLabel="Tentar de novo"
          onAction={() => void refetch()}
        />
      ) : data.routes.length === 0 ? (
        <EmptyState
          icon="calendar-clear-outline"
          title="Nenhuma rota para hoje"
          description={
            data.offline
              ? 'Não há rotas salvas neste aparelho. Conecte-se para buscar.'
              : 'Quando o escritório atribuir uma rota a você, ela aparece aqui.'
          }
          actionLabel="Atualizar"
          onAction={() => void refetch()}
        />
      ) : (
        data.routes.map((route) => <RouteCard key={route.route_id} route={route} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  greetingText: {
    flex: 1,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
