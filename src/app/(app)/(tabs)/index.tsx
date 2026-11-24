import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteStatusBadge } from '@/components/domain/status-badges';
import { SyncBadge } from '@/components/domain/sync-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useMyRoutes, useRoutes } from '@/features/routes/hooks';
import {
  nextStop,
  previousAttemptLabel,
  routeProgress,
  type DriverRoute,
} from '@/features/routes/model';
import { daySummary, groupRoutesByDay } from '@/features/routes/summary';
import {
  formatDateTime,
  formatDistance,
  formatDuration,
  formatTime,
  localDay,
  plural,
} from '@/lib/format';
import { formatAddress, openNavigation, openPhone } from '@/lib/maps';
import { errorMessage } from '@/services/api/errors';
import { useSession } from '@/services/session';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Cores da faixa do topo: o azul da marca nos dois temas, como na tela de
 * login, com texto branco. O resto da tela segue o tema.
 */
const BRAND = '#2F5DE3';
const BRAND_DEEP = '#1F3A9C';
const ON_BRAND = '#FFFFFF';
const ON_BRAND_MUTED = 'rgba(255,255,255,0.78)';
const ON_BRAND_TRACK = 'rgba(255,255,255,0.25)';
const ON_BRAND_CHIP = 'rgba(255,255,255,0.14)';

const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const SHORT_MONTHS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

function greeting(now: Date): string {
  const hora = now.getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** "quinta-feira, 20 de novembro". */
function longDate(now: Date): string {
  return `${WEEKDAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}`;
}

function initials(name: string | undefined): string {
  const partes = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '';
  return `${primeira}${ultima}`.toUpperCase();
}

// ----------------------------------------------------------------- topo

function HeroStat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.heroStat}>
      <Ionicons name={icon} size={16} color={ON_BRAND} />
      <View>
        <Text weight="semibold" style={{ color: ON_BRAND }}>
          {value}
        </Text>
        <Text variant="caption" style={{ color: ON_BRAND_MUTED }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Faixa azul do topo: saudação, sincronização e o andamento do dia. */
function Hero({ routes, loaded }: { routes: DriverRoute[]; loaded: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useSession();
  const agora = new Date();
  const resumo = daySummary(routes);
  const feitas = resumo.delivered + resumo.failed;
  const primeiroNome = session?.user.name.split(' ')[0];

  return (
    <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]} testID="home-hero">
      {/* Círculos de fundo, só decoração. */}
      <View pointerEvents="none" style={[styles.blob, styles.blobOne]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobTwo]} />

      <View style={styles.heroTop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir minha conta"
          onPress={() => router.push('/profile')}
          style={styles.avatar}
          testID="home-avatar"
        >
          <Text weight="semibold" style={{ color: ON_BRAND }}>
            {initials(session?.user.name)}
          </Text>
        </Pressable>
        <View style={styles.heroGreeting}>
          <Text variant="heading4" numberOfLines={1} style={{ color: ON_BRAND }}>
            {greeting(agora)}
            {primeiroNome ? `, ${primeiroNome}` : ''}
          </Text>
          <Text variant="bodySm" style={{ color: ON_BRAND_MUTED }}>
            {longDate(agora)}
          </Text>
        </View>
        <SyncBadge />
      </View>

      {loaded && resumo.stops > 0 ? (
        <View style={styles.heroProgress} testID="today-summary">
          <Text variant="label" style={{ color: ON_BRAND_MUTED }}>
            SEU DIA
          </Text>
          <View style={styles.heroCount}>
            <Text variant="heading2" style={{ color: ON_BRAND }}>
              {feitas}
            </Text>
            <Text variant="bodyLg" style={{ color: ON_BRAND_MUTED }}>
              {` de ${plural(resumo.stops, 'parada', 'paradas')}`}
            </Text>
          </View>
          <View
            style={[styles.track, { backgroundColor: ON_BRAND_TRACK }]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(resumo.done * 100) }}
          >
            <View
              style={[
                styles.fill,
                { width: `${Math.round(resumo.done * 100)}%`, backgroundColor: ON_BRAND },
              ]}
            />
          </View>
          <View style={styles.heroStats}>
            <HeroStat icon="checkmark-circle" value={String(resumo.delivered)} label="entregues" />
            <HeroStat icon="close-circle" value={String(resumo.failed)} label="não entregues" />
            <HeroStat icon="map" value={formatDistance(resumo.distanceM)} label="previstos" />
            {resumo.expectedEnd ? (
              <HeroStat icon="flag" value={formatTime(resumo.expectedEnd)} label="término" />
            ) : (
              <HeroStat icon="time" value={formatDuration(resumo.durationMin)} label="de rota" />
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// -------------------------------------------------------------- cartões

function SectionTitle({
  title,
  action,
  onAction,
  testID,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text variant="heading4">{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={12} testID={testID}>
          <Text variant="bodySm" weight="semibold" style={{ color: theme.primary }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
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
        <View style={styles.routeTitle}>
          <View style={[styles.routeIcon, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="navigate" size={18} color={theme.primary} />
          </View>
          <View style={styles.flex}>
            <Text variant="heading4">Rota #{route.route_id}</Text>
            <Text variant="bodySm" tone="muted" numberOfLines={1}>
              {[route.region, route.vehicle?.plate ?? route.vehicle?.name]
                .filter(Boolean)
                .join(' · ') || 'Sem região definida'}
            </Text>
          </View>
        </View>
        <RouteStatusBadge status={route.status} />
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Ionicons name="cube-outline" size={16} color={theme.muted} />
          <Text variant="bodySm">
            {progress.delivered + progress.failed} de {progress.total}
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

      {route.status !== 'planned' ? (
        <ProgressBar
          value={progress.total ? (progress.delivered + progress.failed) / progress.total : 0}
        />
      ) : null}
    </Card>
  );
}

/** Rota de hoje ainda não iniciada: o próximo passo do dia é sair. */
function ReadyCard({ route }: { route: DriverRoute }) {
  const router = useRouter();
  const theme = useTheme();
  const primeira = route.stops[0];

  return (
    <Card style={{ borderColor: theme.primary, borderWidth: 2 }} testID="ready-card">
      <View style={styles.readyHeader}>
        <View style={[styles.readyIcon, { backgroundColor: theme.primary }]}>
          <Ionicons name="play" size={18} color={theme.primaryForeground} />
        </View>
        <View style={styles.flex}>
          <Text variant="label" tone="primary" weight="semibold">
            PRONTO PARA SAIR
          </Text>
          <Text variant="heading4">
            Rota #{route.route_id} · {plural(route.stops.length, 'parada', 'paradas')}
          </Text>
        </View>
      </View>
      <Text tone="muted" numberOfLines={2}>
        {[
          formatDistance(route.total_distance_m),
          formatDuration(route.total_duration_min),
          primeira ? `primeira: ${primeira.client_name ?? primeira.title}` : null,
        ]
          .filter((item) => item && item !== '—')
          .join(' · ')}
      </Text>
      <Button
        label="Ver rota e iniciar"
        icon="arrow-forward"
        onPress={() => router.push({ pathname: '/route/[id]', params: { id: route.route_id } })}
        testID="ready-open"
      />
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
      <View style={styles.readyHeader}>
        <View style={[styles.sequence, { backgroundColor: theme.primary }]}>
          <Text weight="semibold" style={{ color: theme.primaryForeground }}>
            {stop.stop_sequence ?? '–'}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="label" tone="primary" weight="semibold">
            {`PRÓXIMA PARADA · ${stop.stop_sequence ?? '—'} DE ${route.stops.length}`}
          </Text>
          <Text variant="heading4" numberOfLines={1}>
            {stop.client_name ?? stop.title}
          </Text>
        </View>
      </View>
      <Text tone="muted" numberOfLines={2}>
        {formatAddress(stop)}
        {stop.address.complement ? ` · ${stop.address.complement}` : ''}
      </Text>
      <Text variant="bodySm">{detalhes.join(' · ')}</Text>
      {previousAttemptLabel(stop) ? (
        <Text variant="bodySm" tone="warning" weight="medium" testID="next-stop-previous-attempt">
          {previousAttemptLabel(stop)}
        </Text>
      ) : null}
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

/** Próximas rotas: o motorista já vê o que vem amanhã sem trocar de aba. */
function UpcomingRoutes() {
  const router = useRouter();
  const theme = useTheme();
  const today = localDay();
  const { data } = useMyRoutes(today);
  if (!data) return null;

  const proximas = groupRoutesByDay(data, today)
    .upcoming.flatMap((grupo) => grupo.routes.map((route) => ({ day: grupo.day, route })))
    .slice(0, 3);

  return (
    <View style={styles.section} testID="upcoming-routes">
      <SectionTitle
        title="Próximos dias"
        action="Ver todas"
        onAction={() => router.push('/my-routes')}
        testID="upcoming-see-all"
      />
      {proximas.length === 0 ? (
        <Text tone="muted" variant="bodySm">
          Nenhuma rota marcada para os próximos dias.
        </Text>
      ) : (
        proximas.map(({ day, route }) => {
          const [, month, date] = day.split('-').map(Number);
          return (
            <Card
              key={route.route_id}
              onPress={() =>
                router.push({ pathname: '/route/[id]', params: { id: route.route_id } })
              }
              accessibilityLabel={`Rota ${route.route_id} em ${date}/${month}`}
              testID={`upcoming-${route.route_id}`}
              style={styles.upcomingCard}
            >
              <View style={[styles.dateBox, { backgroundColor: theme.surfaceMuted }]}>
                <Text weight="semibold" tone="primary" style={styles.dateDay}>
                  {String(date).padStart(2, '0')}
                </Text>
                <Text variant="caption" tone="muted">
                  {SHORT_MONTHS[(month ?? 1) - 1]}
                </Text>
              </View>
              <View style={styles.flex}>
                <Text weight="semibold">Rota #{route.route_id}</Text>
                <Text variant="bodySm" tone="muted" numberOfLines={1}>
                  {[
                    plural(route.stops.length, 'parada', 'paradas'),
                    formatDistance(route.total_distance_m),
                    route.region,
                  ]
                    .filter((item) => item && item !== '—')
                    .join(' · ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </Card>
          );
        })
      )}
    </View>
  );
}

// ---------------------------------------------------------------- tela

export default function HomeScreen() {
  const theme = useTheme();
  const { data, error, isPending, isRefetching, refetch } = useRoutes();
  const routes = data?.routes ?? [];
  const activeRoute = routes.find((route) => route.status === 'active');
  const readyRoute = !activeRoute ? routes.find((route) => route.status === 'planned') : undefined;
  // A rota do cartão "Pronto para sair" não se repete na lista logo abaixo.
  const listedRoutes = routes.filter((route) => route !== readyRoute);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={ON_BRAND}
          colors={[BRAND]}
          progressBackgroundColor={theme.surface}
        />
      }
    >
      <Hero routes={routes} loaded={!!data} />

      <View style={styles.body}>
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
        ) : routes.length === 0 ? (
          <Card>
            <EmptyState
              icon="sunny-outline"
              title="Nenhuma rota para hoje"
              description={
                data.offline
                  ? 'Não há rotas salvas neste aparelho. Conecte-se para buscar.'
                  : 'Quando o escritório atribuir uma rota a você, ela aparece aqui.'
              }
              actionLabel="Atualizar"
              onAction={() => void refetch()}
            />
          </Card>
        ) : (
          <>
            {activeRoute ? <NextStopCard route={activeRoute} /> : null}
            {readyRoute ? <ReadyCard route={readyRoute} /> : null}

            {listedRoutes.length > 0 ? (
              <View style={styles.section}>
                <SectionTitle
                  title={
                    readyRoute
                      ? 'Outras rotas de hoje'
                      : listedRoutes.length === 1
                        ? 'Rota de hoje'
                        : 'Rotas de hoje'
                  }
                />
                {listedRoutes.map((route) => (
                  <RouteCard key={route.route_id} route={route} />
                ))}
              </View>
            ) : null}
          </>
        )}

        {!data?.offline ? <UpcomingRoutes /> : null}

        {data?.fetchedAt ? (
          <Text variant="caption" tone="muted" align="center">
            Atualizado em {formatDateTime(data.fetchedAt)} · puxe para atualizar
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  hero: {
    backgroundColor: BRAND,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    gap: spacing.lg,
  },
  blob: {
    position: 'absolute',
    borderRadius: radius.full,
    backgroundColor: BRAND_DEEP,
    opacity: 0.55,
  },
  blobOne: {
    width: 220,
    height: 220,
    right: -70,
    top: -60,
  },
  blobTwo: {
    width: 140,
    height: 140,
    left: -50,
    bottom: -60,
    opacity: 0.35,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: ON_BRAND_CHIP,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGreeting: {
    flex: 1,
    gap: 2,
  },
  heroProgress: {
    gap: spacing.sm,
  },
  heroCount: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: ON_BRAND_CHIP,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: '47%',
    flexGrow: 1,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  routeTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  routeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  readyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sequence: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
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
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH,
  },
  dateBox: {
    width: 48,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  dateDay: {
    fontSize: 18,
    lineHeight: 22,
  },
  flex: {
    flex: 1,
  },
});
