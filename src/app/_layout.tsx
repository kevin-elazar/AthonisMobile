// Registra a tarefa de GPS em segundo plano. Precisa acontecer na carga do
// aplicativo, antes de qualquer tela: é só isto que roda quando o sistema
// acorda o app para entregar uma leitura.
import { stopTracking } from '@/services/location/tracking';
// Sentry antes das telas, para capturar erros desde a abertura.
import { withSentry } from '@/services/observability/sentry';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { hydrateSession, useSession } from '@/services/session';
import { useTheme } from '@/theme/use-theme';

// O splash da marca (app.json) fica na tela até a sessão ser lida: o motorista
// não vê a tela piscar entre "abrindo", login e rotas.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Quem responde é o banco local; refazer a consulta a cada foco só
      // gastaria rede de quem já está com sinal fraco.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function RootLayout() {
  const theme = useTheme();
  const { hydrated, session, expired } = useSession();

  useEffect(() => {
    void hydrateSession();
  }, []);

  useEffect(() => {
    if (hydrated) void SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated]);

  // Sessão recusada pelo servidor: ninguém está logado, então o GPS para. A
  // fila e o rastro ficam guardados para quando o mesmo motorista entrar de novo.
  useEffect(() => {
    if (!session && expired) void stopTracking();
  }, [session, expired]);

  if (!hydrated) {
    return (
      // Coberto pelo splash; se ele já tiver saído, a mesma cor evita um clarão.
      <View style={{ flex: 1, backgroundColor: theme.primary }} />
    );
  }

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={!!session}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>
            <Stack.Protected guard={!session}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
        </QueryClientProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

export default withSentry(RootLayout);
