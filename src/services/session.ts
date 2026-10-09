import { useSyncExternalStore } from 'react';
import type { Session } from '@/features/auth/model';
import { secureStorage } from './storage/secure';

const SESSION_KEY = 'athonis.session';

interface SessionState {
  /** Falso até a leitura do armazenamento terminar; evita piscar a tela de login. */
  hydrated: boolean;
  session: Session | null;
  /** A sessão caiu sozinha (token recusado), e não por logout. A tela de login avisa. */
  expired: boolean;
}

let state: SessionState = { hydrated: false, session: null, expired: false };
const listeners = new Set<() => void>();

function update(next: SessionState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getSession(): Session | null {
  return state.session;
}

/** Lê a sessão guardada. Chamado uma vez, ao abrir o aplicativo. */
export async function hydrateSession(): Promise<void> {
  let session: Session | null = null;
  try {
    const saved = await secureStorage.get(SESSION_KEY);
    session = saved ? (JSON.parse(saved) as Session) : null;
  } catch {
    session = null;
  }
  update({ hydrated: true, session, expired: false });
}

export async function saveSession(session: Session): Promise<void> {
  await secureStorage.set(SESSION_KEY, JSON.stringify(session));
  update({ hydrated: true, session, expired: false });
}

export async function clearSession(options: { expired?: boolean } = {}): Promise<void> {
  await secureStorage.remove(SESSION_KEY);
  update({ hydrated: true, session: null, expired: !!options.expired });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
