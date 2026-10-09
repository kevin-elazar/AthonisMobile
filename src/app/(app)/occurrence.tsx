import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useRouteAction } from '@/features/routes/hooks';
import {
  OCCURRENCE_LABELS,
  OCCURRENCE_TYPES,
  type OccurrenceType,
} from '@/features/routes/model';
import { errorMessage } from '@/services/api/errors';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function OccurrenceScreen() {
  const params = useLocalSearchParams<{ routeId: string; orderId: string; notes?: string }>();
  const routeId = Number(params.routeId);
  const orderId = Number(params.orderId);
  const router = useRouter();
  const theme = useTheme();
  const action = useRouteAction();

  const [type, setType] = useState<OccurrenceType | null>(null);
  const [notes, setNotes] = useState(params.notes ?? '');
  const [failure, setFailure] = useState<string | null>(null);

  // "Outro motivo" sem explicação não diz nada a quem lê o painel depois.
  const notesRequired = type === 'other';
  const canSubmit = !!type && (!notesRequired || notes.trim().length > 0);

  const submit = async () => {
    if (!type) return;
    setFailure(null);
    try {
      await action.mutateAsync({
        kind: 'stop_fail',
        routeId,
        orderId,
        occurrenceType: type,
        notes,
      });
      // Volta para a rota: a tela da parada, logo abaixo, já não tem ação a oferecer.
      router.dismissTo({ pathname: '/route/[id]', params: { id: routeId } });
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Screen
      footer={
        <Button
          label="Registrar ocorrência"
          icon="alert-circle"
          variant="danger"
          onPress={() => void submit()}
          loading={action.isPending}
          disabled={!canSubmit}
          large
          testID="occurrence-submit"
        />
      }
    >
      <Text variant="heading4">O que aconteceu?</Text>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {OCCURRENCE_TYPES.map((option) => {
          const selected = option === type;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setType(option)}
              testID={`occurrence-${option}`}
              style={[
                styles.option,
                {
                  backgroundColor: theme.surface,
                  borderColor: selected ? theme.primary : theme.border,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
            >
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={selected ? theme.primary : theme.muted}
              />
              <Text weight={selected ? 'semibold' : 'regular'}>{OCCURRENCE_LABELS[option]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Input
        label={notesRequired ? 'Descreva o motivo' : 'Detalhes (opcional)'}
        value={notes}
        onChangeText={setNotes}
        placeholder="Ex.: portão fechado, ninguém atendeu o interfone"
        multiline
        maxLength={1000}
        testID="occurrence-notes"
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
