import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { radius, spacing, type Palette } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './text';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const ICONS: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle-outline',
  warning: 'warning-outline',
  danger: 'alert-circle-outline',
  success: 'checkmark-circle-outline',
};

function toneColor(theme: Palette, tone: Tone): string {
  if (tone === 'warning') return theme.warning;
  if (tone === 'danger') return theme.danger;
  if (tone === 'success') return theme.success;
  return theme.info;
}

/** Aviso dentro da tela: explica uma situação sem interromper o que o entregador está fazendo. */
export function Notice({ tone = 'info', children }: { tone?: Tone; children: string }) {
  const theme = useTheme();
  const color = toneColor(theme, tone);

  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={[styles.notice, { borderColor: color, backgroundColor: theme.surface }]}
    >
      <Ionicons name={ICONS[tone]} size={20} color={color} />
      <Text variant="bodySm" style={styles.text}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  text: {
    flex: 1,
  },
});
