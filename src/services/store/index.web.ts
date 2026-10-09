import { MemoryStore } from './memory-store';
import type { LocalStore } from './types';

const STORAGE_KEY = 'athonis.store';

/**
 * No navegador não há SQLite nativo. A versão web existe para desenvolver e
 * conferir as telas no computador; o banco local dela é o `localStorage`.
 */
export const store: LocalStore = new MemoryStore({
  load: () => {
    try {
      return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  },
  save: (serialized) => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, serialized);
    } catch {
      // Sem armazenamento disponível, o estado vive só até recarregar a página.
    }
  },
});

export type { LocalStore } from './types';
