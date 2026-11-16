import { API_URL } from '@/lib/env';
import { store } from '@/services/store';

/**
 * Consentimento para o registro de trajeto (LGPD, art. 8º).
 *
 * Antes de o sistema mostrar o diálogo de permissão, o aplicativo explica o
 * que é coletado, quando e para quê, numa tela própria com link para a
 * política de privacidade. A decisão fica gravada com data e versão do
 * texto: se o texto mudar (nova versão), o motorista é perguntado de novo.
 *
 * Recusar não impede o trabalho: a rota segue, só sem trajeto medido.
 */

export const CONSENT_VERSION = 1;
const CONSENT_KEY = 'consent.location';

export interface LocationConsent {
  version: number;
  accepted: boolean;
  /** ISO 8601, no relógio do aparelho. */
  decidedAt: string;
}

export async function getLocationConsent(): Promise<LocationConsent | null> {
  const raw = await store.getValue(CONSENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocationConsent>;
    if (typeof parsed.version !== 'number' || typeof parsed.accepted !== 'boolean') return null;
    return {
      version: parsed.version,
      accepted: parsed.accepted,
      decidedAt: String(parsed.decidedAt ?? ''),
    };
  } catch {
    return null;
  }
}

export async function saveLocationConsent(
  accepted: boolean,
  now: Date = new Date(),
): Promise<LocationConsent> {
  const consent: LocationConsent = {
    version: CONSENT_VERSION,
    accepted,
    decidedAt: now.toISOString(),
  };
  await store.setValue(CONSENT_KEY, JSON.stringify(consent));
  return consent;
}

/** Ainda não decidiu sobre o texto atual? Então a tela de consentimento abre. */
export async function needsLocationConsent(): Promise<boolean> {
  const consent = await getLocationConsent();
  return !consent || consent.version < CONSENT_VERSION;
}

// ------------------------------------------------- decisão vinda da tela

/**
 * A tela de consentimento é uma rota do Expo Router. Quem a abre (o botão
 * "Iniciar rota") espera a decisão por esta promessa; a tela resolve ao
 * escolher ou ao ser fechada sem escolha (vale como "agora não").
 */
let pending: ((accepted: boolean) => void) | null = null;

export function waitForConsentDecision(): Promise<boolean> {
  // Uma espera anterior que ficou pendurada é encerrada como recusa.
  pending?.(false);
  return new Promise((resolve) => {
    pending = resolve;
  });
}

export function resolveConsentDecision(accepted: boolean): void {
  const resolve = pending;
  pending = null;
  resolve?.(accepted);
}

// ---------------------------------------------- política de privacidade

/**
 * A política fica no painel web, no mesmo domínio da API:
 * api.<domínio> → app.<domínio>, staging-api.<domínio> → staging-app.<domínio>.
 * EXPO_PUBLIC_PRIVACY_URL sobrepõe a regra.
 */
export function privacyPolicyUrl(
  apiUrl: string = API_URL,
  override: string | undefined = process.env.EXPO_PUBLIC_PRIVACY_URL,
): string {
  if (override) return override;
  try {
    const url = new URL(apiUrl);
    url.hostname = url.hostname.replace(
      /^(staging-)?api\./,
      (_match, staging: string | undefined) => (staging ? 'staging-app.' : 'app.'),
    );
    if (url.hostname === 'localhost' || url.hostname === '10.0.2.2') url.port = '3000';
    url.pathname = '/privacidade';
    url.search = '';
    return url.toString();
  } catch {
    return `${apiUrl.replace(/\/+$/, '')}/privacidade`;
  }
}

export function formatConsentDate(consent: LocationConsent | null): string | null {
  if (!consent?.decidedAt) return null;
  const date = new Date(consent.decidedAt);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
