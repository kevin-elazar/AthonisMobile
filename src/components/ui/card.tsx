import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Superfície com borda, sem sombra: no Design System a sombra é reservada a elementos flutuantes. */
export function Card({ children, onPress, accessibilityLabel, style, testID }: CardProps) {
  const theme = useTheme();
  const surface = { backgroundColor: theme.surface, borderColor: theme.border };

  if (!onPress) {
    return (
      <View style={[styles.card, surface, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        surface,
        pressed ? { backgroundColor: theme.surfaceActive } : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
