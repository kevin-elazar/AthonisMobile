/**
 * No navegador não existe armazenamento cifrado. A versão web serve para
 * desenvolver e conferir as telas no computador, com `localStorage` no lugar;
 * não é um canal de distribuição do aplicativo.
 */
export const secureStorage = {
  get: async (key: string): Promise<string | null> => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set: async (key: string, value: string): Promise<void> => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Sem armazenamento, a sessão dura até recarregar a página.
    }
  },
  remove: async (key: string): Promise<void> => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Nada a remover.
    }
  },
};
