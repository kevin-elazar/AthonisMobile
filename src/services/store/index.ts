import { SqliteStore } from './sqlite-store';
import type { LocalStore } from './types';

/** Banco local do aparelho (Android e iOS). No navegador, vale `index.web.ts`. */
export const store: LocalStore = new SqliteStore();

export type { LocalStore } from './types';
