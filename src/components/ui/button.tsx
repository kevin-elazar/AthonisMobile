import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { MIN_TOUCH, radius, spacing, type Palette } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** Botão da ação principal da tela: mais alto, para acertar sem olhar. */
  large?: boolean;
  testID?: string;
}

function colors(theme: Palette, variant: Variant) {
  switch (variant) {
    case 'secondary':
      return { bg: theme.secondary, pressed: theme.secondaryActive, fg: theme.secondaryForeground };
    case 'success':
      return { bg: theme.success, pressed: theme.success, fg: theme.successForeground };
    case 'danger':
      return { bg: theme.danger, pressed: theme.danger, fg: theme.dangerForeground };
    case 'ghost':
      return { bg: 'transparent', pressed: theme.surfaceActive, fg: theme.primary };
    default:
      return { bg: theme.primary, pressed: theme.primaryActive, fg: theme.primaryForeground };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  large = false,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const palette = colors(theme, variant);
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        large ? styles.large : null,
        { backgroundColor: pressed ? palette.pressed : palette.bg },
        pressed && (variant === 'success' || variant === 'danger') ? styles.dimmed : null,
        inactive ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={large ? 24 : 20} color={palette.fg} /> : null}
          <Text
            variant={large ? 'bodyLg' : 'body'}
            weight="semibold"
            style={{ color: palette.fg }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  large: {
    minHeight: 60,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dimmed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
