import { zodResolver } from '@hookform/resolvers/zod';
import * as Device from 'expo-device';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type TextInput } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { loginSchema, type LoginForm } from '@/features/auth/model';
import { login } from '@/services/api/client';
import { errorMessage, httpStatus } from '@/services/api/errors';
import { useSession } from '@/services/session';
import { spacing } from '@/theme/tokens';

function deviceName(): string {
  return [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || Platform.OS;
}

export default function LoginScreen() {
  const { expired } = useSession();
  const passwordRef = useRef<TextInput>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async ({ email, password }) => {
    setFailure(null);
    try {
      // Com a sessão gravada, o guarda de rotas troca sozinho para as telas do app.
      await login(email, password, deviceName());
    } catch (error) {
      setFailure(
        httpStatus(error) === 401 ? 'E-mail ou senha incorretos.' : errorMessage(error),
      );
    }
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen contentStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="heading2">Athonis Entregas</Text>
          <Text tone="muted">Entre com o acesso criado pelo escritório.</Text>
        </View>

        {expired && !failure ? (
          <Notice tone="warning">Sua sessão expirou. Entre novamente para continuar.</Notice>
        ) : null}
        {failure ? <Notice tone="danger">{failure}</Notice> : null}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="E-mail"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              testID="login-email"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              ref={passwordRef}
              label="Senha"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={submit}
              testID="login-password"
            />
          )}
        />

        <Button label="Entrar" onPress={submit} loading={isSubmitting} large testID="login-submit" />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
});
