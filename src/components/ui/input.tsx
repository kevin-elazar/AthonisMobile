import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './text';

export interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, style, multiline, secureTextEntry, testID, ...rest },
  ref,
) {
  const theme = useTheme();
  // Campo de senha ganha o botão de olho: digitar no celular, de luva ou com
  // o veículo parado na rua, erra fácil e o motorista precisa conferir.
  const [visible, setVisible] = useState(false);
  const secret = !!secureTextEntry && !visible;

  return (
    <View style={styles.field}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={theme.muted}
          multiline={multiline}
          secureTextEntry={secret}
          testID={testID}
          {...rest}
          style={[
            styles.input,
            multiline ? styles.multiline : null,
            secureTextEntry ? styles.withToggle : null,
            {
              color: theme.foreground,
              backgroundColor: theme.surface,
              borderColor: error ? theme.danger : theme.border,
            },
            style,
          ]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setVisible((atual) => !atual)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityState={{ selected: visible }}
            hitSlop={8}
            style={styles.toggle}
            testID={testID ? `${testID}-toggle` : undefined}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={theme.muted}
            />
          </Pressable>
        ) : null}
      </View>
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
  withToggle: {
    paddingRight: MIN_TOUCH,
  },
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
});
