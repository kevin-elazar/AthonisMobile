# Athonis Entregas — aplicativo do motorista

[![CI](https://github.com/kevin-elazar/AthonisMobile/actions/workflows/ci.yml/badge.svg?branch=desenvMobile)](https://github.com/kevin-elazar/AthonisMobile/actions/workflows/ci.yml)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=kevin-elazar_AthonisMobile&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=kevin-elazar_AthonisMobile)
[![Release](https://img.shields.io/github/v/release/kevin-elazar/AthonisMobile)](https://github.com/kevin-elazar/AthonisMobile/releases/latest)

> Aplicativo mobile para entregadores, extensão do sistema web Athonis de otimização de rotas.
> **TCC — Engenharia de Software · Centro Universitário Católica de Santa Catarina · 2026**

O sistema web já gerava rotas otimizadas, mas perdia o rastro depois que o caminhão saía. O aplicativo fecha esse ciclo: o motorista vê a sequência de paradas, registra cada entrega ou o motivo de não entregar — **mesmo sem sinal** — e o trajeto é registrado por GPS. O painel web compara a **rota planejada com a executada** para melhorar as próximas.

**Empresa parceira:** Forte Acessórios para Móveis — Jaraguá do Sul, SC.

| | |
|---|---|
| 📱 **Baixar o APK** | [Última release](https://github.com/kevin-elazar/AthonisMobile/releases/latest) |
| 🖥️ **Painel web** | https://app.athonis.seletohub.cloud |
| 📚 **Documentação** | [Wiki do projeto](https://github.com/kevin-elazar/AthonisMobile/wiki) — requisitos, casos de uso, C4, DER, ADRs, deploy, LGPD |
| 🔒 **Privacidade** | https://app.athonis.seletohub.cloud/privacidade |

## Funcionalidades

**Aplicativo (este repositório)**
- Login do motorista com sessão longa (refresh token no armazenamento seguro do aparelho)
- Rotas do dia e sequência de paradas, com a próxima destacada
- Navegação até a parada pelo Google Maps (link universal, sem chave no app)
- Chegada, entrega (com observação) e não entrega (com motivo obrigatório)
- Cancelamento da rota com motivo; encerramento com resumo
- **Offline first:** tudo funciona sem sinal e sincroniza depois, em ordem e sem duplicar
- Rastro de GPS a cada 15 s ou 50 m, inclusive com a tela apagada, **só com a rota ativa**
- Consentimento de localização antes do pedido do sistema e seção de privacidade (LGPD)

**Painel web e API** (repositórios [athonis-front-end](https://github.com/kevin-elazar/athonis-front-end) e [AthonisBackend](https://github.com/kevin-elazar/AthonisBackend))
- Acompanhamento ao vivo: posição do motorista e próxima parada
- Execução em campo: conclusão, pontualidade, ocorrências por tipo, desempenho por motorista e região
- Comparação planejado × executado de cada rota, com o trajeto real no mapa

## Arquitetura

```text
 App (Expo · SQLite)            Navegador (painel)
        │ HTTPS + JWT                  │
        ▼                              ▼
 ┌────────────── VPS Linux · Docker Compose ──────────────┐
 │ Traefik (HTTPS) ─► API NestJS ─► PostgreSQL 17           │
 │                 └► Painel Next.js                        │
 │ Prometheus + Grafana · backup diário · staging/produção  │
 └──────────────────────────┬──────────────────────────────┘
                            ▼
        Google Maps Platform (Route Optimization, Geocoding)
```

No app, o padrão é MVC: **models** em `src/features/*/model.ts` (schemas Zod), **controllers** em `src/features/*/hooks.ts` e `src/services/*` (API, fila offline, rastreamento) e **views** em `src/app/**` (telas do Expo Router) e `src/components/**`. Detalhes e diagramas: [Arquitetura](https://github.com/kevin-elazar/AthonisMobile/wiki/Arquitetura) e [Fila Offline](https://github.com/kevin-elazar/AthonisMobile/wiki/Fila-Offline).

## Stack

| Camada | Tecnologia |
|---|---|
| Aplicativo | Expo SDK 57 (React Native 0.86), Expo Router, TypeScript strict |
| Dados no aparelho | expo-sqlite (fila e cópia das rotas), expo-secure-store (sessão) |
| Localização | expo-location + expo-task-manager (serviço em primeiro plano no Android) |
| Estado e formulários | TanStack Query, React Hook Form + Zod |
| API | NestJS 11 + TypeORM + PostgreSQL 17 |
| Painel | Next.js 16 (React 19) |
| Observabilidade | Sentry (`@sentry/react-native`): erros e travamentos no aparelho |
| Qualidade e entrega | GitHub Actions, SonarCloud, EAS Build (APK na release) |

## Como rodar

Pré-requisitos: Node 22, a [API](https://github.com/kevin-elazar/AthonisBackend) rodando e, para o celular, Android Studio ou um aparelho com o *development build*.

```bash
npm ci
cp .env.example .env    # EXPO_PUBLIC_API_URL=http://<ip-da-maquina>:8080
npm run web             # telas no navegador (sem GPS; armazenamento em localStorage)
npm run android         # emulador ou aparelho
```

O rastreamento em segundo plano não funciona no Expo Go: use o *development build* (`npx eas-cli@latest build --profile development --platform android`). Ambiente Android no Windows: [`docs/ambiente-android.md`](docs/ambiente-android.md).

| Comando | O quê |
|---|---|
| `npx jest` | Testes (fila offline, consentimento, formatação, erros da API, modelo da rota) |
| `npx tsc --noEmit` | Typecheck |
| `npx expo lint` | Lint |

## Entrega contínua

Todo push e PR passa por lint, typecheck, testes e SonarCloud. Em tag `v*`, o CI gera o APK de produção no EAS Build e publica numa GitHub Release — é o link do QR Code do pôster. Perfis em [`eas.json`](eas.json): `development`, `preview` (API de staging) e `production`.

## Documentos do TCC

| Documento | Onde |
|---|---|
| Wiki (fonte em Markdown) | [`docs/wiki/`](docs/wiki) |
| Roteiro do piloto | [`docs/piloto.md`](docs/piloto.md) |
| Modelo do termo de aceite | [`docs/termo-de-aceite.md`](docs/termo-de-aceite.md) |
| Ajustes do artigo para a versão final | [`docs/ajustes-artigo-pac7.md`](docs/ajustes-artigo-pac7.md) |
| Pôster do Demo Day | [`docs/poster/`](docs/poster) |
| Plano de execução e decisões | [`SPEC.md`](SPEC.md) |

## Autor

**Kevin Chedid El Azar** — Engenharia de Software, Católica SC · kevin.azal@catolicasc.edu.br

Licença: [LICENSE](LICENSE).
