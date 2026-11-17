import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Erros do aplicativo no Sentry (observabilidade do lado do aparelho).
 *
 * Só liga com DSN (perfis preview e production do eas.json) e fora do
 * navegador, que serve apenas para desenvolver as telas. Sem dados pessoais:
 * nada de IP, e-mail ou corpo de requisição nos eventos (LGPD).
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!dsn && Platform.OS !== 'web';

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
    release: `athonis-entregas@${Constants.expoConfig?.version ?? '0'}`,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

/** Envolve o layout raiz para capturar erros de renderização. Sem Sentry, devolve o próprio componente. */
export function withSentry(
  Component: React.ComponentType<Record<string, unknown>>,
): React.ComponentType<Record<string, unknown>> {
  return sentryEnabled ? Sentry.wrap(Component) : Component;
}

export { Sentry };
