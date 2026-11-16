import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  privacyPolicyUrl,
  resolveConsentDecision,
  saveLocationConsent,
} from '@/features/consent/location-consent';
import { requestTrackingPermissions } from '@/services/location/tracking';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const ITENS: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  {
    icon: 'navigate-outline',
    title: 'O que é registrado',
    text: 'Sua posição (latitude, longitude, precisão e velocidade) a cada 15 segundos ou 50 metros.',
  },
  {
    icon: 'time-outline',
    title: 'Quando',
    text: 'Só enquanto há uma rota em andamento: começa em "Iniciar rota" e para em "Encerrar rota". Uma notificação fixa avisa enquanto está ligado.',
  },
  {
    icon: 'analytics-outline',
    title: 'Para quê',
    text: 'Para a empresa acompanhar a entrega e comparar a rota planejada com a executada. Não é usado para publicidade nem vendido.',
  },
  {
    icon: 'hand-left-outline',
    title: 'Você decide',
    text: 'Recusar não impede o trabalho: a rota segue, só sem o trajeto. Dá para mudar a qualquer momento nas permissões do aparelho.',
  },
];

/**
 * Explica a coleta de localização antes do diálogo do sistema (exigência da
 * LGPD e das regras do Google Play para localização em segundo plano).
 * Abre uma vez, antes da primeira rota, e pode ser revista em "Minha conta".
 */
export default function LocationConsentScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const decided = useRef(false);

  // Fechar a tela sem escolher vale como "agora não" para quem está esperando.
  useEffect(
    () => () => {
      if (!decided.current) resolveConsentDecision(false);
    },
    [],
  );

  const decide = async (accepted: boolean) => {
    setBusy(true);
    decided.current = true;
    await saveLocationConsent(accepted);
    if (accepted) await requestTrackingPermissions();
    resolveConsentDecision(accepted);
    if (router.canGoBack()) router.back();
  };

  const openPolicy = () => {
    const url = privacyPolicyUrl();
    void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button
            label="Permitir registro do trajeto"
            icon="checkmark"
            onPress={() => void decide(true)}
            loading={busy}
            large
            testID="consent-accept"
          />
          <Button
            label="Agora não"
            variant="ghost"
            onPress={() => void decide(false)}
            disabled={busy}
            testID="consent-decline"
          />
        </View>
      }
    >
      <Text variant="heading3">Registro do trajeto da rota</Text>
      <Text tone="muted">
        Antes de pedir a permissão de localização, veja o que o Athonis faz com ela.
      </Text>

      {ITENS.map((item) => (
        <Card key={item.title}>
          <View style={styles.item}>
            <Ionicons name={item.icon} size={24} color={theme.primary} />
            <View style={styles.itemText}>
              <Text weight="semibold">{item.title}</Text>
              <Text variant="bodySm" tone="muted">
                {item.text}
              </Text>
            </View>
          </View>
        </Card>
      ))}

      <Text variant="bodySm" tone="muted">
        Na próxima tela do sistema, escolha &quot;Permitir o tempo todo&quot; para o trajeto
        continuar registrado com a tela apagada.
      </Text>

      <Button
        label="Ler a política de privacidade"
        icon="document-text-outline"
        variant="secondary"
        onPress={openPolicy}
        testID="consent-policy"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  item: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  itemText: { flex: 1, gap: spacing.xs },
});
