import * as Crypto from 'expo-crypto';

/** Identificador dos eventos e pontos gerados no aparelho (o `client_event_id` da API). */
export function uuid(): string {
  return Crypto.randomUUID();
}
