import { isAxiosError } from 'axios';
import type { Failure } from '@/features/sync/worker';

/** A sessão não pôde ser renovada: é preciso entrar de novo. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Sessão expirada. Entre novamente.');
    this.name = 'SessionExpiredError';
  }
}

interface ApiErrorBody {
  message?: string | string[];
  errors?: { field: string; messages: string[] }[];
}

/** Mensagem legível de qualquer erro vindo da API ou da rede. */
export function errorMessage(error: unknown): string {
  if (error instanceof SessionExpiredError) return error.message;

  if (isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      return 'Sem conexão com o servidor.';
    }

    const { message, errors } = error.response.data ?? {};
    const texto = Array.isArray(message) ? message.join(', ') : message;
    const detalhes = errors?.flatMap((item) => item.messages).join(' · ');

    if (texto && detalhes) return `${texto} ${detalhes}`;
    if (texto) return texto;

    if (error.response.status === 403) return 'Você não tem permissão para esta ação.';
    if (error.response.status === 404) return 'Registro não encontrado.';
    return `Erro ${error.response.status} no servidor.`;
  }

  return error instanceof Error ? error.message : 'Erro inesperado.';
}

/** Não houve resposta do servidor: rede caída, timeout ou servidor fora do ar. */
export function isNetworkError(error: unknown): boolean {
  return isAxiosError(error) && !error.response;
}

export function httpStatus(error: unknown): number | null {
  return isAxiosError(error) ? (error.response?.status ?? null) : null;
}

/**
 * Decide o destino de um envio da fila que falhou.
 *
 * Só é temporário o que repetir depois pode resolver: falha de rede (sem
 * resposta do servidor), 408, 429 e 5xx. Os demais 4xx são a resposta
 * definitiva do servidor para aquela ação. Um erro que não veio da rede nem
 * do HTTP (ex.: a resposta 2xx não passou na validação do esquema) também é
 * definitivo: repetir daria o mesmo erro e travaria a fila da rota para sempre.
 */
export function classifyFailure(error: unknown): Failure {
  const message = errorMessage(error);

  if (error instanceof SessionExpiredError) return { kind: 'auth', message };
  if (isNetworkError(error)) return { kind: 'retry', message };

  const status = httpStatus(error);
  if (status === 401) return { kind: 'auth', message };
  if (status !== null && (status === 408 || status === 429 || status >= 500)) {
    return { kind: 'retry', message };
  }
  return { kind: 'reject', message };
}
