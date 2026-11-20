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
import { daySummary } from '@/features/routes/summary';
import { formatDateTime, formatDistance, formatDuration, formatTime, plural } from '@/lib/format';
import { formatAddress, openNavigation, openPhone } from '@/lib/maps';
import { errorMessage } from '@/services/api/errors';
import { useSession } from '@/services/session';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function RouteCard({ route }: { route: DriverRoute }) {
  const router = useRouter();
  const theme = useTheme();
  const progress = routeProgress(route);

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

      {route.status !== 'planned' ? (
        <ProgressBar
          value={progress.total ? (progress.delivered + progress.failed) / progress.total : 0}
        />
      ) : null}
      {progress.failed > 0 ? (
        <Text variant="bodySm" tone="danger">
          {plural(progress.failed, 'ocorrência', 'ocorrências')}
        </Text>
      ) : null}
    </Card>
  );
}

function ProgressBar({ value }: { value: number }) {
  const theme = useTheme();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      style={[styles.track, { backgroundColor: theme.surfaceMuted }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.success }]} />
    </View>
  );
}

const SUMMARY_TRACK = 'rgba(255,255,255,0.3)';
const SUMMARY_FILL = '#ffffff';

/** Painel do dia: quanto falta, distância e hora prevista para terminar. */
function TodaySummary({ routes }: { routes: DriverRoute[] }) {
  const theme = useTheme();
  const resumo = daySummary(routes);

  return (
    <Card
      style={{ backgroundColor: theme.primary, borderColor: theme.primary }}
      testID="today-summary"
    >
      <Text variant="label" tone="inverse" weight="semibold">
        RESUMO DE HOJE
      </Text>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text variant="heading2" tone="inverse">
            {resumo.open}
          </Text>
          <Text variant="caption" tone="inverse">
            {resumo.open === 1 ? 'parada a fazer' : 'paradas a fazer'}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text variant="heading2" tone="inverse">
            {resumo.delivered}
          </Text>
          <Text variant="caption" tone="inverse">
            {resumo.delivered === 1 ? 'entregue' : 'entregues'}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text variant="heading2" tone="inverse">
            {resumo.failed}
          </Text>
          <Text variant="caption" tone="inverse">
            {resumo.failed === 1 ? 'não entregue' : 'não entregues'}
          </Text>
        </View>
      </View>
      {/* Branco nos dois temas: o fundo do cartão é sempre o azul da marca. */}
      <View style={[styles.track, { backgroundColor: SUMMARY_TRACK }]}>
        <View
          style={[
            styles.fill,
            { width: `${Math.round(resumo.done * 100)}%`, backgroundColor: SUMMARY_FILL },
          ]}
        />
      </View>
      <Text variant="bodySm" tone="inverse">
        {[
          formatDistance(resumo.distanceM),
          formatDuration(resumo.durationMin),
          resumo.expectedEnd ? `término previsto às ${formatTime(resumo.expectedEnd)}` : null,
        ]
          .filter((item) => item && item !== '—')
          .join(' · ')}
      </Text>
    </Card>
  );
}

/** A próxima parada da rota em andamento, com os atalhos que o motorista mais usa. */
function NextStopCard({ route }: { route: DriverRoute }) {
  const router = useRouter();
  const theme = useTheme();
  const stop = nextStop(route);
  if (!stop) return null;

  const detalhes = [
    stop.delivery_window ? `Janela ${stop.delivery_window}` : null,
    stop.planned_arrival ? `previsto ${formatTime(stop.planned_arrival)}` : null,
    stop.invoice_number ? `NF ${stop.invoice_number}` : null,
    `${stop.quantity} ${stop.quantity === 1 ? 'volume' : 'volumes'}`,
  ].filter(Boolean);

  return (
    // Sem onPress no cartão: os botões ficam dentro dele, e botão dentro de
    // botão confunde o toque e o leitor de tela.
    <Card style={{ borderColor: theme.primary, borderWidth: 2 }} testID="next-stop-card">
      <Text variant="label" tone="primary" weight="semibold">
        {`PRÓXIMA PARADA · ${stop.stop_sequence ?? '—'} DE ${route.stops.length}`}
      </Text>
      <Text variant="heading4" numberOfLines={1}>
        {stop.client_name ?? stop.title}
      </Text>
      <Text tone="muted" numberOfLines={2}>
        {formatAddress(stop)}
        {stop.address.complement ? ` · ${stop.address.complement}` : ''}
      </Text>
      <Text variant="bodySm">{detalhes.join(' · ')}</Text>
      <View style={styles.quickActions}>
        <View style={styles.flex}>
          <Button
            label="Abrir"
            icon="arrow-forward"
            onPress={() =>
              router.push({
                pathname: '/stop/[orderId]',
                params: { orderId: stop.order_id, routeId: route.route_id },
              })
            }
            testID="next-stop-open"
          />
        </View>
        <View style={styles.flex}>
          <Button
            label="Navegar"
            icon="navigate"
            variant="secondary"
            onPress={() => void openNavigation(stop)}
            testID="next-stop-navigate"
          />
        </View>
        {stop.client_phone ? (
          <View style={styles.flex}>
            <Button
              label="Ligar"
              icon="call"
              variant="secondary"
              onPress={() => void openPhone(stop.client_phone as string)}
              testID="next-stop-call"
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export default function RoutesScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { data, error, isPending, isRefetching, refetch } = useRoutes();
  const activeRoute = data?.routes.find((route) => route.status === 'active');

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

      {data && data.routes.length > 0 ? <TodaySummary routes={data.routes} /> : null}
      {activeRoute ? <NextStopCard route={activeRoute} /> : null}

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

      <Button
        label="Minhas rotas: próximas e anteriores"
        icon="calendar-outline"
        variant="secondary"
        onPress={() => router.push('/my-routes')}
        testID="open-my-routes"
      />
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
  track: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryItem: {
    flex: 1,
    gap: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
