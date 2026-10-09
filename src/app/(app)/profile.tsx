import { useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { confirm } from '@/lib/confirm';
import { API_URL } from '@/lib/env';
import { plural } from '@/lib/format';
import { logoutRemote } from '@/services/api/client';
import { fetchProfile } from '@/services/api/driver';
import { stopTracking, trackingMode, type TrackingMode } from '@/services/location/tracking';
import { clearSession, useSession } from '@/services/session';
import { store } from '@/services/store';
import { refreshSyncCounts, useSyncState } from '@/services/sync';

const TRACKING_LABELS: Record<TrackingMode, string> = {
  background: 'Ligado, inclusive com a tela apagada',
  foreground: 'Ligado apenas com o aplicativo aberto',
  off: 'Desligado',
};

export default function ProfileScreen() {
  const { session } = useSession();
  const sync = useSyncState();
  const queryClient = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const [tracking, setTracking] = useState<TrackingMode>('off');

  // A empresa vem do servidor; sem rede, a tela mostra só o que está na sessão.
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
    retry: false,
  });

  useEffect(() => {
    void trackingMode().then(setTracking);
  }, []);

  const naoEnviado = sync.pending + sync.pings;

  const logout = async () => {
    const ok = await confirm(
      naoEnviado > 0
        ? {
            title: 'Sair e perder o que não foi enviado?',
            message: `Há ${plural(sync.pending, 'ação', 'ações')} e ${plural(sync.pings, 'ponto de trajeto', 'pontos de trajeto')} que ainda não chegaram ao servidor. Ao sair, eles são apagados deste aparelho.\n\nSe puder, conecte-se e sincronize antes.`,
            confirmLabel: 'Sair assim mesmo',
            destructive: true,
          }
        : { title: 'Sair do aplicativo?', confirmLabel: 'Sair' },
    );
    if (!ok || !session) return;

    setLeaving(true);
    await stopTracking();
    await logoutRemote(session.refreshToken);
    await store.clear();
    await refreshSyncCounts();
    queryClient.clear();
    // Por último: é isto que devolve o aplicativo à tela de login.
    await clearSession();
  };

  return (
    <Screen
      footer={
        <Button
          label="Sair"
          icon="log-out-outline"
          variant="secondary"
          onPress={() => void logout()}
          loading={leaving}
          testID="profile-logout"
        />
      }
    >
      <Card>
        <Text variant="heading4">{profile?.driver.name ?? session?.user.name}</Text>
        <Text tone="muted">{session?.user.email}</Text>
        {profile?.company.name ? <Text>{profile.company.name}</Text> : null}
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Registro de trajeto
        </Text>
        <Text>{TRACKING_LABELS[tracking]}</Text>
        <Text variant="bodySm" tone="muted">
          A localização só é lida enquanto há uma rota em andamento.
        </Text>
      </Card>

      {naoEnviado > 0 ? (
        <Notice tone="warning">
          {`Há ${plural(sync.pending, 'ação', 'ações')} e ${plural(sync.pings, 'ponto de trajeto', 'pontos de trajeto')} aguardando envio.`}
        </Notice>
      ) : null}

      <Text variant="caption" tone="muted" align="center">
        Versão {Constants.expoConfig?.version ?? '—'} · {API_URL}
      </Text>
    </Screen>
  );
}
