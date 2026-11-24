import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useRoute, useRouteAction } from '@/features/routes/hooks';
import { routeProgress } from '@/features/routes/model';
import { confirm } from '@/lib/confirm';
import { plural } from '@/lib/format';
import { errorMessage } from '@/services/api/errors';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Motivos mais comuns, para o entregador não precisar digitar com o veículo parado na rua. */
const REASONS = [
  'Problema mecânico no veículo',
  'Acidente ou ocorrência no trânsito',
  'Mercadoria não foi carregada',
  'Solicitação do escritório',
  'Problema de saúde',
  'Outro motivo',
] as const;

type Reason = (typeof REASONS)[number];

export default function CancelRouteScreen() {
  const params = useLocalSearchParams<{ routeId: string }>();
  const routeId = Number(params.routeId);
  const router = useRouter();
  const theme = useTheme();
  const { data: route } = useRoute(routeId);
  const action = useRouteAction();

  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  // "Outro motivo" sem explicação não diz nada a quem lê depois no escritório.
  const detailsRequired = reason === 'Outro motivo';
  const canSubmit = !!reason && (!detailsRequired || details.trim().length >= 3);
  const abertas = route ? routeProgress(route).open : 0;

  const submit = async () => {
    if (!reason) return;

    const ok = await confirm({
      title: 'Cancelar esta rota?',
      message:
        abertas > 0
          ? `${plural(abertas, 'parada em aberto volta', 'paradas em aberto voltam')} para o escritório, que poderá colocá-las em outra rota. As entregas já feitas continuam registradas.\n\nNão é possível desfazer.`
          : 'As entregas já feitas continuam registradas. Não é possível desfazer.',
      confirmLabel: 'Cancelar rota',
      cancelLabel: 'Voltar',
      destructive: true,
    });
    if (!ok) return;

    setFailure(null);
    try {
      await action.mutateAsync({
        kind: 'route_cancel',
        routeId,
        reason: details.trim() ? `${reason}: ${details.trim()}` : reason,
      });
      // A rota cancelada sai da lista; volta direto para as rotas do dia.
      router.dismissTo('/');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Screen
      footer={
        <Button
          label="Cancelar rota"
          icon="close-circle"
          variant="danger"
          onPress={() => void submit()}
          loading={action.isPending}
          disabled={!canSubmit}
          large
          testID="cancel-route-submit"
        />
      }
    >
      <Text variant="heading4">Por que a rota vai ser cancelada?</Text>
      <Text tone="muted">
        {abertas > 0
          ? `${plural(abertas, 'parada ainda está em aberto e volta', 'paradas ainda estão em aberto e voltam')} para o escritório.`
          : 'Todas as paradas já foram baixadas.'}{' '}
        O motivo fica registrado para o escritório.
      </Text>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {REASONS.map((option) => {
          const selected = option === reason;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setReason(option)}
              style={[
                styles.option,
                {
                  backgroundColor: theme.surface,
                  borderColor: selected ? theme.danger : theme.border,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
            >
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={selected ? theme.danger : theme.muted}
              />
              <Text weight={selected ? 'semibold' : 'regular'}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      <Input
        label={detailsRequired ? 'Descreva o motivo' : 'Detalhes (opcional)'}
        value={details}
        onChangeText={setDetails}
        placeholder="Ex.: pneu furado na BR-280, aguardando socorro"
        multiline
        maxLength={400}
        testID="cancel-route-details"
      />

      {failure ? <Notice tone="danger">{failure}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
});
