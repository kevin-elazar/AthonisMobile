import { MemoryStore } from '@/services/store/memory-store';

import { store } from '@/services/store';
import {
  CONSENT_VERSION,
  consentKey,
  formatConsentDate,
  getLocationConsent,
  needsLocationConsent,
  privacyPolicyUrl,
  resolveConsentDecision,
  saveLocationConsent,
  waitForConsentDecision,
} from '../location-consent';

jest.mock('@/services/store', () => {
  const { MemoryStore: Store } = jest.requireActual('@/services/store/memory-store');
  return { store: new Store() };
});

let mockUserId: number | null = 7;
jest.mock('@/services/session', () => ({
  getSession: () => (mockUserId == null ? null : { user: { id: mockUserId } }),
}));

/**
 * O consentimento da localização é o que a LGPD e o Google Play cobram de um
 * app que lê GPS em segundo plano: precisa ser explicado antes, registrado e
 * reversível. Estes testes garantem o registro e a releitura da decisão.
 */

beforeEach(async () => {
  mockUserId = 7;
  await store.clear();
});

describe('registro do consentimento', () => {
  it('começa sem decisão e pede consentimento', async () => {
    expect(store).toBeInstanceOf(MemoryStore);
    expect(await getLocationConsent()).toBeNull();
    expect(await needsLocationConsent()).toBe(true);
  });

  it('grava aceite e recusa com data e versão', async () => {
    const quando = new Date('2026-11-16T13:05:00Z');
    expect(await saveLocationConsent(true, quando)).toEqual({
      version: CONSENT_VERSION,
      accepted: true,
      decidedAt: '2026-11-16T13:05:00.000Z',
    });
    expect(await needsLocationConsent()).toBe(false);

    await saveLocationConsent(false);
    expect((await getLocationConsent())?.accepted).toBe(false);
    // Recusar também é uma decisão: não pergunta de novo a cada rota.
    expect(await needsLocationConsent()).toBe(false);
  });

  it('pergunta de novo quando o texto muda de versão', async () => {
    await store.setValue(
      'consent.location',
      JSON.stringify({
        version: CONSENT_VERSION - 1,
        accepted: true,
        decidedAt: '2026-01-01T00:00:00Z',
      }),
    );
    expect(await needsLocationConsent()).toBe(true);
  });

  it('a decisão de um motorista não vale para outro no mesmo aparelho', async () => {
    await saveLocationConsent(true);
    expect(await store.getValue('consent.location.7')).not.toBeNull();

    mockUserId = 8;
    expect(consentKey()).toBe('consent.location.8');
    expect(await getLocationConsent()).toBeNull();
    expect(await needsLocationConsent()).toBe(true);

    await saveLocationConsent(false);
    mockUserId = 7;
    expect((await getLocationConsent())?.accepted).toBe(true);
  });

  it('sem sessão, usa a chave genérica', async () => {
    mockUserId = null;
    expect(consentKey()).toBe('consent.location');
    await saveLocationConsent(true);
    expect(await store.getValue('consent.location')).not.toBeNull();
  });

  it('ignora registro corrompido', async () => {
    await store.setValue('consent.location.7', '{quebrado');
    expect(await getLocationConsent()).toBeNull();
    await store.setValue('consent.location.7', JSON.stringify({ accepted: 'sim' }));
    expect(await getLocationConsent()).toBeNull();
  });
});

describe('decisão vinda da tela', () => {
  it('quem abriu a tela recebe a escolha', async () => {
    const decisao = waitForConsentDecision();
    resolveConsentDecision(true);
    await expect(decisao).resolves.toBe(true);
  });

  it('uma espera anterior pendurada vira recusa', async () => {
    const antiga = waitForConsentDecision();
    const nova = waitForConsentDecision();
    await expect(antiga).resolves.toBe(false);
    resolveConsentDecision(true);
    await expect(nova).resolves.toBe(true);
    // Sem ninguém esperando, resolver não faz nada.
    expect(() => resolveConsentDecision(false)).not.toThrow();
  });
});

describe('endereço da política de privacidade', () => {
  it.each([
    ['https://api.athonis.com.br', 'https://app.athonis.com.br/privacidade'],
    ['https://staging-api.athonis.com.br/', 'https://staging-app.athonis.com.br/privacidade'],
    ['http://10.0.2.2:8080', 'http://10.0.2.2:3000/privacidade'],
    ['http://localhost:8080', 'http://localhost:3000/privacidade'],
  ])('%s → %s', (api, esperado) => {
    expect(privacyPolicyUrl(api, undefined)).toBe(esperado);
  });

  it('a variável de ambiente sobrepõe a regra', () => {
    expect(privacyPolicyUrl('https://api.x.com', 'https://outro.com/p')).toBe(
      'https://outro.com/p',
    );
  });

  it('endereço inválido cai no próprio endereço', () => {
    expect(privacyPolicyUrl('nao-e-url', undefined)).toBe('nao-e-url/privacidade');
  });
});

describe('data exibida no perfil', () => {
  it('formata dia e hora locais', () => {
    const texto = formatConsentDate({
      version: 1,
      accepted: true,
      decidedAt: new Date(2026, 10, 16, 9, 5).toISOString(),
    });
    expect(texto).toBe('16/11/2026 às 09:05');
    expect(formatConsentDate(null)).toBeNull();
    expect(formatConsentDate({ version: 1, accepted: true, decidedAt: 'x' })).toBeNull();
  });
});
