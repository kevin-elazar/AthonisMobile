import { zodResolver } from '@hookform/resolvers/zod';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, Platform, StyleSheet, View, type TextInput } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { loginSchema, type LoginForm } from '@/features/auth/model';
import { confirm } from '@/lib/confirm';
import { login } from '@/services/api/client';
import { errorMessage, httpStatus } from '@/services/api/errors';
import { discardMessage, prepareLocalDataFor } from '@/services/local-owner';
import { useSession } from '@/services/session';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const LOGO = require('../../../assets/images/logo-mark.png');

function deviceName(): string {
  return [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || Platform.OS;
}

export default function LoginScreen() {
  const { expired } = useSession();
  const theme = useTheme();
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
      // Antes disso, se o aparelho guarda dados de outro motorista, eles são
      // apagados (com aviso, se ainda não foram enviados).
      await login(email, password, deviceName(), {
        beforeSave: (session) =>
          prepareLocalDataFor(session.user.id, (unsent) =>
            confirm({
              title: 'Dados de outro motorista',
              message: discardMessage(unsent),
              confirmLabel: 'Entrar e apagar',
              destructive: true,
            }),
          ),
      });
    } catch (error) {
      setFailure(httpStatus(error) === 401 ? 'E-mail ou senha incorretos.' : errorMessage(error));
    }
  });

  return (
    <Screen contentStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: theme.primary }]}>
        <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text variant="heading2" style={styles.heroTitle}>
          Athonis Entregas
        </Text>
        <Text style={styles.heroSubtitle}>Suas rotas do dia, mesmo sem sinal.</Text>
      </View>

      <Card style={styles.form}>
        <Text variant="heading4">Entrar</Text>
        <Text tone="muted">Use o acesso criado pelo escritório.</Text>

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

        <Button
          label="Entrar"
          onPress={submit}
          loading={isSubmitting}
          large
          testID="login-submit"
        />
      </Card>

      <Text variant="caption" tone="muted" align="center" style={styles.footer}>
        versão {Constants.expoConfig?.version ?? '—'} · TCC de Engenharia de Software · Católica SC
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 0,
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl * 1.5,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.xl * 2,
    borderBottomRightRadius: radius.xl * 2,
  },
  logo: {
    width: 88,
    height: 88,
    marginBottom: spacing.sm,
    // Borda clara: no tema claro o logo azul se confundiria com o cabeçalho.
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  heroTitle: {
    color: '#ffffff',
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  form: {
    marginHorizontal: spacing.lg,
    marginTop: -spacing.xxl,
    gap: spacing.md,
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
