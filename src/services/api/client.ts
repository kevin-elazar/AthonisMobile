import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { authResponseSchema, type AuthResponse, type Session } from '@/features/auth/model';
import { API_URL } from '@/lib/env';
import { clearSession, getSession, saveSession } from '@/services/session';
import { SessionExpiredError } from './errors';

const TIMEOUT_MS = 15_000;

export const api = axios.create({ baseURL: API_URL, timeout: TIMEOUT_MS });

/** Chamadas de autenticação não levam token nem disparam renovação. */
const authApi = axios.create({ baseURL: API_URL, timeout: TIMEOUT_MS });

export function toSession(response: AuthResponse): Session {
  const { user } = response;
  if (user.role !== 'driver' || !user.driver_id) {
    throw new Error('Este aplicativo é exclusivo para motoristas. Use o sistema web.');
  }
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      driverId: user.driver_id,
      idCompany: user.id_company,
    },
  };
}

export async function login(email: string, password: string, device: string): Promise<Session> {
  const { data } = await authApi.post('/auth/login', { email, password, device });
  const session = toSession(authResponseSchema.parse(data));
  await saveSession(session);
  return session;
}

/** Encerra a sessão no servidor. Sem rede, o logout local acontece do mesmo jeito. */
export async function logoutRemote(refreshToken: string): Promise<void> {
  try {
    await authApi.post('/auth/logout', { refresh_token: refreshToken });
  } catch {
    // O token expira sozinho; não vale prender o usuário na tela por isso.
  }
}

let refreshing: Promise<Session> | null = null;

/**
 * Renova a sessão. Várias chamadas podem receber 401 ao mesmo tempo quando o
 * token expira; todas esperam a mesma renovação, em vez de cada uma gastar o
 * refresh token (que é de uso único).
 */
function refreshSession(): Promise<Session> {
  if (!refreshing) {
    refreshing = exchangeRefreshToken().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function exchangeRefreshToken(): Promise<Session> {
  const current = getSession();
  if (!current) throw new SessionExpiredError();

  try {
    const { data } = await authApi.post('/auth/refresh', {
      refresh_token: current.refreshToken,
    });
    const session = toSession(authResponseSchema.parse(data));
    await saveSession(session);
    return session;
  } catch (error) {
    // Só derruba a sessão quando o servidor a recusou. Falha de rede na
    // renovação não desloga ninguém: o entregador continua trabalhando
    // offline e a renovação é tentada de novo depois.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      await clearSession({ expired: true });
      throw new SessionExpiredError();
    }
    throw error;
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.request.use((config) => {
  const session = getSession();
  if (session) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;

    if (error.response?.status !== 401 || !config || config._retried) {
      throw error;
    }

    config._retried = true;
    const session = await refreshSession();
    config.headers.Authorization = `Bearer ${session.accessToken}`;
    return api.request(config);
  },
);
