import { renderHook } from '@testing-library/react-native';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { clearSession, getSession, saveSession, useSession } from '@/services/session';
import { api, login, logoutRemote, toSession } from '../client';
import { SessionExpiredError } from '../errors';

/**
 * Sessão do motorista: login só para quem é motorista, renovação do token
 * uma única vez quando várias chamadas recebem 401 juntas, e logout forçado
 * só quando o servidor recusa — sem rede, o motorista continua trabalhando.
 */

type Responder = (config: AxiosRequestConfig) => Promise<Partial<AxiosResponse>>;
let mockResponder: Responder = async () => ({ status: 200, data: {} });

// Todas as instâncias criadas pelo cliente usam este "servidor".
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  const axios = actual.default ?? actual;
  axios.defaults.adapter = async (config: AxiosRequestConfig) => {
    const resposta = await mockResponder(config);
    const status = resposta.status ?? 200;
    const completa = { data: {}, headers: {}, statusText: '', config, ...resposta, status };
    if (status >= 400) {
      throw new axios.AxiosError('falha', String(status), config, null, completa);
    }
    return completa;
  };
  return actual;
});

const mockSecure = new Map<string, string>();
jest.mock('@/services/storage/secure', () => ({
  secureStorage: {
    get: async (key: string) => mockSecure.get(key) ?? null,
    set: async (key: string, value: string) => void mockSecure.set(key, value),
    remove: async (key: string) => void mockSecure.delete(key),
  },
}));

const resposta = (token: string, role = 'driver') => ({
  access_token: `acesso-${token}`,
  refresh_token: `renova-${token}`,
  expires_in: 900,
  user: {
    id: 7,
    email: 'motorista@x.com',
    name: 'João',
    role,
    id_company: 1,
    driver_id: role === 'driver' ? 3 : null,
  },
});

const chamadas: { url?: string; auth?: unknown; body?: unknown }[] = [];
const registrar = (config: AxiosRequestConfig) =>
  chamadas.push({
    url: config.url,
    auth: (config.headers as Record<string, unknown> | undefined)?.Authorization,
    body: config.data ? JSON.parse(config.data as string) : undefined,
  });

beforeEach(async () => {
  chamadas.length = 0;
  mockSecure.clear();
  await saveSession(toSession(resposta('1')));
});

describe('login', () => {
  it('aceita só motorista e grava a sessão', async () => {
    mockResponder = async (config) => {
      registrar(config);
      return { data: resposta('2') };
    };
    const session = await login('motorista@x.com', 'senha', 'Pixel');
    expect(session).toEqual({
      accessToken: 'acesso-2',
      refreshToken: 'renova-2',
      user: { id: 7, email: 'motorista@x.com', name: 'João', driverId: 3, idCompany: 1 },
    });
    expect(chamadas[0]).toMatchObject({
      url: '/auth/login',
      body: { email: 'motorista@x.com', device: 'Pixel' },
    });
    expect(getSession()?.accessToken).toBe('acesso-2');
  });

  it('admin do painel não entra no app', async () => {
    mockResponder = async () => ({ data: resposta('2', 'admin') });
    await expect(login('a@x.com', 's', 'Pixel')).rejects.toThrow('exclusivo para motoristas');
  });

  it('se o preparo local falhar, revoga o token novo e não grava a sessão', async () => {
    mockResponder = async (config) => {
      registrar(config);
      return { data: resposta('2') };
    };
    const falha = new Error('cancelado');
    await expect(
      login('m@x.com', 's', 'Pixel', {
        beforeSave: async () => {
          throw falha;
        },
      }),
    ).rejects.toBe(falha);
    expect(chamadas.map((c) => c.url)).toEqual(['/auth/login', '/auth/logout']);
    expect(chamadas[1].body).toEqual({ refresh_token: 'renova-2' });
    expect(getSession()?.accessToken).toBe('acesso-1');
  });

  it('logout sem rede não prende o motorista', async () => {
    mockResponder = async () => {
      throw new Error('Network Error');
    };
    await expect(logoutRemote('x')).resolves.toBeUndefined();
  });
});

describe('chamadas autenticadas', () => {
  it('mandam o token e, no 401, renovam uma vez só para todas', async () => {
    let renovacoes = 0;
    mockResponder = async (config) => {
      registrar(config);
      if (config.url === '/auth/refresh') {
        renovacoes += 1;
        return { data: resposta('2') };
      }
      const auth = (config.headers as Record<string, unknown>).Authorization;
      return auth === 'Bearer acesso-2' ? { data: { ok: config.url } } : { status: 401 };
    };

    const [a, b] = await Promise.all([api.get('/driver/routes'), api.get('/driver/me')]);
    expect(a.data).toEqual({ ok: '/driver/routes' });
    expect(b.data).toEqual({ ok: '/driver/me' });
    expect(renovacoes).toBe(1);
    expect(chamadas.find((c) => c.url === '/auth/refresh')?.body).toEqual({
      refresh_token: 'renova-1',
    });
    expect(getSession()?.refreshToken).toBe('renova-2');
  });

  it('não tenta de novo um pedido que já foi renovado', async () => {
    mockResponder = async (config) =>
      config.url === '/auth/refresh' ? { data: resposta('2') } : { status: 401 };
    await expect(api.get('/driver/routes')).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('outros erros passam direto, sem renovar', async () => {
    mockResponder = async (config) => {
      registrar(config);
      return { status: 500 };
    };
    await expect(api.get('/driver/routes')).rejects.toMatchObject({ response: { status: 500 } });
    expect(chamadas.map((c) => c.url)).toEqual(['/driver/routes']);
  });

  it('renovação recusada encerra a sessão e avisa a tela de login', async () => {
    mockResponder = async (config) => ({ status: 401, data: { url: config.url } });
    await expect(api.get('/driver/routes')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(getSession()).toBeNull();

    const { result } = renderHook(() => useSession());
    expect(result.current.expired).toBe(true);
  });

  it('renovação sem rede mantém a sessão para tentar depois', async () => {
    mockResponder = async (config) => {
      if (config.url === '/auth/refresh') throw new Error('Network Error');
      return { status: 401 };
    };
    await expect(api.get('/driver/routes')).rejects.toThrow('Network Error');
    expect(getSession()?.refreshToken).toBe('renova-1');
  });

  it('sem sessão, o 401 vira sessão expirada', async () => {
    await clearSession();
    mockResponder = async () => ({ status: 401 });
    await expect(api.get('/driver/routes')).rejects.toBeInstanceOf(SessionExpiredError);
  });
});
