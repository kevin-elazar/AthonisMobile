# Arquitetura (modelo C4)

## Nível 1 — Contexto

```mermaid
flowchart LR
  motorista((Motorista))
  operador((Operador / Admin))
  athonis[Athonis<br/>roteirização e execução de entregas]
  google[[Google Maps Platform<br/>Route Optimization · Geocoding · Street View]]
  maps[[App Google Maps<br/>no celular]]
  viacep[[ViaCEP]]
  sentry[[Sentry]]

  motorista -- "executa rotas pelo app" --> athonis
  operador -- "planeja e analisa pelo painel" --> athonis
  athonis -- "otimiza rotas, geocodifica" --> google
  athonis -- "abre navegação por link" --> maps
  athonis -- "consulta CEP" --> viacep
  athonis -- "erros" --> sentry
```

## Nível 2 — Contêineres

```mermaid
flowchart TB
  subgraph cel[Celular do motorista]
    app["App Athonis<br/>Expo / React Native<br/>SQLite local + fila offline"]
  end
  subgraph nav[Navegador]
    web_cli["Painel (cliente)<br/>React 19 + TanStack Query"]
  end
  subgraph vps["VPS Linux (Docker Compose)"]
    proxy["Traefik<br/>HTTPS / Let's Encrypt"]
    web["Painel web<br/>Next.js 16 (Server Actions)"]
    api["API<br/>NestJS 11 + TypeORM"]
    db[("PostgreSQL 17<br/>athonis / athonis_staging")]
    prom["Prometheus"]
    graf["Grafana"]
  end
  google[[Google Maps Platform]]

  app -- "HTTPS + JWT<br/>/driver/*" --> proxy
  web_cli -- HTTPS --> proxy
  proxy --> web
  proxy --> api
  web -- "HTTP interno + JWT<br/>(token em cookie httpOnly)" --> api
  api --> db
  api -- "conta de serviço" --> google
  prom -- "/metrics" --> api
  graf --> prom
  proxy --> graf
```

Produção e staging rodam lado a lado na mesma VPS (`api` / `api-staging`, `web` / `web-staging`), com bancos separados. Detalhes em [[Deploy e Infraestrutura|Deploy-e-Infraestrutura]].

## Nível 3 — Componentes da API

```mermaid
flowchart LR
  subgraph api[API NestJS]
    auth["auth<br/>login, refresh, logout, guards"]
    driver["driver-app<br/>/driver/* (rotas, eventos, pings)"]
    routes["routes<br/>ciclo de vida da rota"]
    opt["optimization-routes<br/>Google Route Optimization"]
    analytics["analytics<br/>indicadores, comparação, ao vivo"]
    calc["route-metrics.calculator<br/>planejado × executado"]
    cad["clients · orders · drivers<br/>vehicles · company · order-imports"]
    geo["geocoding<br/>cache de coordenadas"]
    obs["observability<br/>/health, /metrics, Sentry"]
  end
  driver --> routes
  driver -- "ao encerrar" --> calc
  analytics --> calc
  opt --> geo
  cad --> geo
```

## Nível 3 — Componentes do aplicativo (MVC)

O artigo propõe MVC; no aplicativo o mapeamento é:

| Papel | Pasta | Conteúdo |
|---|---|---|
| **Model** | `src/features/*/model.ts` | Tipos e schemas Zod: Rota, Parada, Ocorrência, item da fila |
| **Controller** | `src/features/*/hooks.ts`, `actions.ts`, `src/services/*` | Chamadas à API, fila offline, sincronização, rastreamento, sessão |
| **View** | `src/app/**`, `src/components/**` | Telas e componentes de interface |

```mermaid
flowchart LR
  telas["Telas (View)<br/>src/app"] --> hooks["hooks / actions<br/>(Controller)"]
  hooks --> repo["repository<br/>leitura local"]
  hooks --> fila["fila (outbox)"]
  repo --> store[("SQLite<br/>route, outbox, ping, kv")]
  fila --> store
  worker["worker de sincronização"] --> store
  worker -- HTTPS --> api[(API)]
  gps["tracking<br/>expo-location + task-manager"] --> store
```

A tela **nunca** lê da rede: lê do banco local, que a sincronização mantém atualizado. Isso é o que permite o app funcionar sem sinal.
