// Registra a tarefa de GPS em segundo plano. Precisa acontecer na carga do
// aplicativo, antes de qualquer tela: é só isto que roda quando o sistema
// acorda o app para entregar uma leitura.
import { stopTracking } from '@/services/location/tracking';
// Sentry antes das telas, para capturar erros desde a abertura.
import { withSentry } from '@/services/observability/sentry';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingState } from '@/components/ui/states';
import { hydrateSession, useSession } from '@/services/session';
import { useTheme } from '@/theme/use-theme';

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

  // Sessão recusada pelo servidor: ninguém está logado, então o GPS para. A
  // fila e o rastro ficam guardados para quando o mesmo motorista entrar de novo.
  useEffect(() => {
    if (!session && expired) void stopTracking();
  }, [session, expired]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}>
        <LoadingState label="Abrindo…" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}

export default withSentry(RootLayout);
