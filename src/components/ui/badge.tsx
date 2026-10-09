import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { radius, spacing, type Palette } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './text';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof Ionicons.glyphMap;
}

function toneColor(theme: Palette, tone: BadgeTone): string {
  switch (tone) {
    case 'primary':
      return theme.primary;
    case 'success':
      return theme.success;
    case 'warning':
      return theme.warning;
    case 'danger':
      return theme.danger;
    case 'info':
      return theme.info;
    default:
      return theme.muted;
  }
}

/**
 * Selo de situação. A cor nunca vem sozinha: o texto (e o ícone, quando há)
 * diz a mesma coisa, para quem não distingue as cores ou lê a tela no sol.
 */
export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  const theme = useTheme();
  const color = toneColor(theme, tone);

  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: theme.surface }]}>
      {icon ? <Ionicons name={icon} size={14} color={color} /> : null}
      <Text variant="label" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
