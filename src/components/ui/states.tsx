import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Button } from './button';
import { Text } from './text';

interface StateProps {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  icon = 'file-tray-outline',
  actionLabel,
  onAction,
}: StateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={theme.muted} />
      <Text variant="heading4" align="center">
        {title}
      </Text>
      {description ? (
        <Text tone="muted" align="center">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}

export function ErrorState({
  title,
  description,
  icon = 'alert-circle-outline',
  actionLabel,
  onAction,
}: StateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Ionicons name={icon} size={48} color={theme.danger} />
      <Text variant="heading4" align="center">
        {title}
      </Text>
      {description ? (
        <Text tone="muted" align="center">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text tone="muted">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
});
