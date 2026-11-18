import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { SyncBadge } from '@/components/domain/sync-badge';
import { useRoutes, useRoutesSyncBridge } from '@/features/routes/hooks';
import { adoptLocalOwner } from '@/services/local-owner';
import { reconcileTracking } from '@/services/location/tracking';
import { useSession } from '@/services/session';
import { startSyncTriggers } from '@/services/sync';
import { useTheme } from '@/theme/use-theme';

export default function AppLayout() {
  const theme = useTheme();
  const { data } = useRoutes();
  const userId = useSession().session?.user.id;

  useRoutesSyncBridge();

  // Sessão aberta antes de existir o registro do dono dos dados locais.
  useEffect(() => {
    if (userId != null) void adoptLocalOwner(userId);
  }, [userId]);

  // A fila só é enviada com alguém logado: os gatilhos nascem e morrem com estas telas.
  useEffect(() => startSyncTriggers(), []);

  // O sistema pode encerrar o rastreamento em segundo plano (economia de
  // bateria, reinício do aparelho). Sempre que a lista de rotas é carregada,
  // conferimos se ele está no estado que a rota em andamento pede.
  const activeRouteId = data?.routes.find((route) => route.status === 'active')?.route_id ?? null;
  const loaded = !!data;
  useEffect(() => {
    if (loaded) void reconcileTracking(activeRouteId);
  }, [loaded, activeRouteId]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.foreground,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: theme.background },
        headerRight: () => <SyncBadge />,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Rotas de hoje' }} />
      <Stack.Screen name="route/[id]" options={{ title: 'Rota' }} />
      <Stack.Screen name="stop/[orderId]" options={{ title: 'Parada' }} />
      <Stack.Screen name="occurrence" options={{ title: 'Não entregue' }} />
      <Stack.Screen name="cancel-route" options={{ title: 'Cancelar rota' }} />
      <Stack.Screen name="sync" options={{ title: 'Sincronização', headerRight: undefined }} />
      <Stack.Screen name="profile" options={{ title: 'Minha conta' }} />
      <Stack.Screen
        name="location-consent"
        options={{ title: 'Localização', presentation: 'modal', headerRight: undefined }}
      />
    </Stack>
  );
}
