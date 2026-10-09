import * as SecureStore from 'expo-secure-store';

/**
 * Armazenamento cifrado do aparelho (Keystore no Android, Keychain no iOS).
 * É onde ficam os tokens da sessão — nunca em armazenamento comum.
 */
export const secureStorage = {
  get: (key: string): Promise<string | null> => SecureStore.getItemAsync(key),
  set: (key: string, value: string): Promise<void> => SecureStore.setItemAsync(key, value),
  remove: (key: string): Promise<void> => SecureStore.deleteItemAsync(key),
};
