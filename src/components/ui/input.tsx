import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './text';

export interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, style, multiline, ...rest },
  ref,
) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={theme.muted}
        multiline={multiline}
        {...rest}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          {
            color: theme.foreground,
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : theme.border,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="bodySm" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="bodySm" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  input: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
  },
  multiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
});
