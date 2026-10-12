# ATHONIS MOBILE — Spec de Execução

> Plano operacional do app do entregador e das mudanças que ele exige no backend e no web.
> Mesmo formato do `athonis-front-end/SPEC.md`: execute as fases **em ordem** e feche os critérios de aceite antes de avançar.
> Sem datas: a ordem das fases é o que importa.
> Todo o trabalho acontece na branch `desenvMobile`, criada nos três repositórios.

---

## Estado atual (12/10/2026)

| Parte | Situação |
|---|---|
| Backend — Fases 1, 3, 4 e 5 | Feito. 148 testes unitários e 42 e2e passando |
| Mobile — Fases 2 e 3 | Feito e conferido rodando no navegador: login, rotas do dia, saída, chegada, entrega, ocorrência, encerramento, sincronização e logout |
| Mobile — fila offline | Conferida com o backend desligado: três ações ficaram pendentes e subiram sozinhas quando ele voltou, em ordem e com a hora original |
| Mobile — Fase 4 (GPS) | Código escrito e coberto pelos testes da fila, mas **não testado em aparelho**: o navegador não tem rastreamento. Exige o APK de desenvolvimento |
| Web — acesso do motorista, situação "não entregue", painel de execução em campo | Feito e conferido no navegador com os dados da rota executada pelo app |
| Fases 6 a 9 | Não iniciadas |

Para rodar tudo localmente: `npm run start:dev` no backend, `node scripts/seed-driver-demo.js` no backend (a rota é criada para o dia de hoje; rode de novo a cada dia), `npm run web` no mobile e `npm run dev` no front-end.

Diferenças em relação ao plano abaixo, decididas durante a implementação:

- A tabela de eventos se chama `route_event` (não `stop_event`) e guarda também a saída e o encerramento da rota.
- O "concluir" do sistema web continua dando o resto como entregue; quem exige baixa em toda parada é o `finish` do aplicativo.
- O app usa `app.json`, não `app.config.ts`.
- No navegador o app usa `localStorage` no lugar do SQLite e não tem rastreamento; serve só para desenvolver e conferir as telas.

---

## 0. Ponto de partida

| Projeto | Estado | Observação |
|---|---|---|
| `AthonisBackend` | NestJS 11 + TypeORM + SQLite, multiempresa (`id_company`), JWT de 1h | Stack mantida. SQLite segue até o fim dos testes; PostgreSQL vem depois (Fase 7) |
| `athonis-front-end` | Next.js 16, TanStack Query, RHF, Zod, design tokens próprios | Tela `analytics` existe, mas soma listas no navegador |
| `AthonisMobile` | README + artigo | README corrigido para refletir o backend real |
| Google | Route Optimization, Geocoding e Street View, via conta de serviço | É o único uso do Google. A hospedagem é em VM própria |

### Lacunas do backend que bloqueiam o app

1. **Motorista não faz login.** `user` e `driver` não têm vínculo, e os papéis são só `admin`/`user`.
2. **Rotas não são filtradas por motorista.** `GET /routes` devolve todas as rotas da empresa a qualquer usuário autenticado.
3. **Não existe ocorrência.** `POST /routes/:id/orders/:orderId/deliver` não recebe corpo, e `complete` marca como entregue tudo que sobrou. Falta o status de "não entregue".
4. **Nenhum dado de execução é guardado**: sem GPS, sem hora de chegada, sem observação.
5. **Token de 1h sem renovação**: o entregador seria deslogado no meio da rota.

### O que já ajuda

- `route` já tem ciclo de vida (`planned → active → completed`), `started_at` e `finished_at`.
- `order` já tem `stop_sequence`, `delivery_latitude/longitude` e `delivered_at`.
- `optimized_route_history.optimization_result` guarda o planejado por parada (`estimatedArrivalTime`, `estimatedDuration`), e `route` guarda `total_distance_m` e `total_duration_min`. É a metade "planejada" da análise comparativa.

---

## 1. Decisões técnicas

| Tema | Escolha | Motivo |
|---|---|---|
| Framework | Expo (SDK estável atual, via `create-expo-app@latest`) + TypeScript strict | Definido no artigo |
| Navegação | Expo Router | Padrão atual do Expo; espelha o App Router do web |
| Plataforma | **Android primeiro; iOS sem custo extra de código** (seção 1.1) | Um código só serve aos dois |
| Server state | TanStack Query + axios | Igual ao web |
| Formulários / validação | React Hook Form + Zod | Igual ao web |
| Sessão | `expo-secure-store` (access + refresh token) | Nunca AsyncStorage para token |
| Localização | `expo-location` + `expo-task-manager` | Coleta com a tela apagada |
| Banco local | `expo-sqlite` | Fila offline e cópia da rota do dia (seção 3) |
| Rede | `@react-native-community/netinfo` | Dispara a sincronização quando o sinal volta |
| Mapa | **Link para o app de mapas**, sem mapa embutido | Definido no artigo; o app não carrega chave do Google |
| Estilo | `StyleSheet` + `src/theme/tokens.ts` portado de `athonis-front-end/src/styles/tokens.css` | Mesma identidade, sem dependência extra |
| Build | Expo Go até a Fase 3; **development build** a partir da Fase 4 | Localização em segundo plano não funciona de forma confiável no Expo Go |
| Distribuição | EAS Build → APK por link | Sem loja |
| Hospedagem | VM própria, Docker Compose, HTTPS na frente | Decisão do projeto |

### 1.1 iOS

O código nasce multiplataforma, então o iPhone sai quase de graça **até** o rastreamento em segundo plano:

- Nada de API exclusiva do Android nas telas; diferenças ficam isoladas em `src/lib/platform.ts`.
- `app.config.ts` já declara os textos de permissão do iOS (`NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`) e `UIBackgroundModes: ["location"]`.
- O link de navegação usa o formato universal `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`, que abre o Google Maps no iOS se instalado, e o navegador se não.
- Fases 1 a 3 rodam no iPhone pelo Expo Go, sem conta paga.
- A Fase 4 em iPhone exige build próprio: conta Apple Developer (paga) e EAS Build na nuvem, já que não há Mac. Fica como **Fase 8, opcional**.

### 1.2 MVC no mobile

O artigo promete MVC. O mapeamento é este, e vale levá-lo ao texto final:

- **Model** → `src/features/*/model.ts`: tipos e schemas Zod de `Rota`, `Parada`, `Ocorrência`, `Métrica`.
- **Controller** → `src/features/*/hooks.ts` e `src/services/*`: API, estado, fila offline, rastreamento.
- **View** → `src/app/**` (telas) e `src/components/**`.

### 1.3 Estrutura de pastas

```text
AthonisMobile/
├── app.config.ts               # nome, pacote, permissões, plugin do expo-location
├── eas.json                    # perfis development / preview / production
├── src/
│   ├── app/
│   │   ├── _layout.tsx         # providers, guarda de rota, início do worker de sincronização
│   │   ├── (auth)/login.tsx
│   │   └── (app)/
│   │       ├── index.tsx                   # rotas do dia
│   │       ├── route/[id].tsx              # sequência de paradas
│   │       ├── stop/[orderId].tsx          # detalhe + ações
│   │       ├── stop/[orderId]/occurrence.tsx
│   │       ├── sync.tsx                    # pendências e itens rejeitados
│   │       └── profile.tsx
│   ├── features/{auth,routes,stops,tracking,sync}/{model,hooks}.ts
│   ├── services/
│   │   ├── api/{client,errors}.ts          # axios + renovação de token
│   │   ├── db/{schema,migrations}.ts       # expo-sqlite
│   │   ├── outbox/{queue,worker}.ts        # fila offline
│   │   └── location/task.ts                # tarefa em segundo plano
│   ├── components/ui/
│   ├── theme/tokens.ts
│   └── lib/{maps,format,env,platform}.ts
└── docs/
```

---

## 2. Contrato novo do backend

### 2.1 Banco de dados

| Tabela / coluna | Campos | Papel |
|---|---|---|
| `user.driver_id` | FK opcional para `driver` | Liga o login ao motorista |
| `user.role` | acrescenta `driver` | Papel do app |
| `order.status` | acrescenta `failed` | Parada visitada e não entregue |
| `refresh_token` | `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`, `device` | Sessão longa no celular |
| `stop_event` | `id`, `id_company`, `route_id`, `order_id`, `type` (`arrived`/`delivered`/`failed`), `occurrence_type`, `notes`, `latitude`, `longitude`, `accuracy_m`, `occurred_at`, `received_at`, `client_event_id` (único) | Entrega e Ocorrência do artigo |
| `route_location_ping` | `id`, `id_company`, `route_id`, `latitude`, `longitude`, `accuracy_m`, `speed_mps`, `recorded_at`, `client_ping_id` (único) | Rota executada (bruta) |
| `route_execution_metrics` | `route_id`, distância e duração planejadas × reais, paradas fora de ordem, tempo ocioso, ETA × chegada por parada | Métrica consolidada ao encerrar a rota |

`occurrence_type` (em `shared/domain/enums.ts`): `customer_absent`, `address_not_found`, `refused`, `damaged_goods`, `closed_establishment`, `access_restricted`, `traffic`, `other`.

Os tipos de coluna devem ser escolhidos já pensando no PostgreSQL (nada de recurso exclusivo do SQLite), para a Fase 7 ser só troca de driver e migrations.

### 2.2 Endpoints

Tudo sob `/driver/*` exige papel `driver` e filtra pelo `driver_id` do token — o app nunca informa de quem é a rota.

| Método | Rota | Uso |
|---|---|---|
| POST | `/auth/login` (existe) | passa a devolver também `refresh_token` |
| POST | `/auth/refresh` | troca o refresh token por um novo par |
| POST | `/auth/logout` | revoga o refresh token |
| GET | `/driver/me` | motorista, veículo, empresa |
| GET | `/driver/routes?date=YYYY-MM-DD` | rotas do motorista no dia, com paradas em ordem |
| GET | `/driver/routes/:id` | detalhe com ETA planejado por parada |
| POST | `/driver/routes/:id/start` | reaproveita `RoutesService.start` |
| POST | `/driver/routes/:id/stops/:orderId/arrive` | grava chegada |
| POST | `/driver/routes/:id/stops/:orderId/deliver` | conclui, com observação e posição |
| POST | `/driver/routes/:id/stops/:orderId/fail` | ocorrência, com tipo e observação |
| POST | `/driver/routes/:id/locations` | lote de pings (até 200 por chamada) |
| POST | `/driver/routes/:id/finish` | encerra e dispara a consolidação |
| GET | `/analytics/overview?from&to` | conclusão, tempo médio, ocorrências |
| GET | `/analytics/drivers?from&to` | índice de conclusão por motorista |
| GET | `/analytics/regions?from&to` | tempo médio por região e faixa de horário |
| GET | `/analytics/occurrences?from&to` | frequência por tipo |
| GET | `/analytics/routes/:id/comparison` | planejado × executado de uma rota |

Todos os `POST` de `/driver/*` recebem `client_event_id` (UUID do aparelho) e `occurred_at` (hora do aparelho). Repetir um `client_event_id` responde 200 com o resultado original, sem criar nada.

Regra a corrigir junto: `complete`/`finish` deixa de marcar como entregue o que sobrou. Parada sem evento impede o encerramento, ou vira `failed` com ocorrência informada.

### 2.3 Análise comparativa

Calculada em `finish`, a partir de `stop_event` + `route_location_ping`:

| Indicador | Planejado | Executado |
|---|---|---|
| Distância total | `route.total_distance_m` | soma haversine dos pings (descartando `accuracy_m` > 50) |
| Duração total | `route.total_duration_min` | `finished_at − started_at` |
| Ordem das paradas | `order.stop_sequence` | ordem dos eventos `arrived` |
| Pontualidade por parada | `estimatedArrivalTime` do histórico | `occurred_at` do `arrived` |
| Tempo de atendimento | — | `delivered/failed − arrived` |
| Tempo ocioso | — | trechos com velocidade ≈ 0 fora de parada |

---

## 3. Fila offline

Objetivo: nenhuma ação do entregador depende de sinal. A tela responde na hora; o envio acontece quando der.

### 3.1 Tabelas locais (`expo-sqlite`)

| Tabela | Campos | Papel |
|---|---|---|
| `route_cache` | `route_id`, `payload` (JSON), `fetched_at` | Cópia da rota do dia, para abrir o app sem rede |
| `outbox` | `id` (UUID = `client_event_id`), `route_id`, `kind`, `payload`, `occurred_at`, `status`, `attempts`, `next_attempt_at`, `last_error`, `created_at` | Ações pendentes |
| `ping_buffer` | `id` (UUID), `route_id`, `latitude`, `longitude`, `accuracy_m`, `speed_mps`, `recorded_at`, `sent` | Pontos de GPS |

`kind`: `route_start`, `stop_arrive`, `stop_deliver`, `stop_fail`, `route_finish`.
`status`: `pending` → `sending` → `done`, ou `rejected` quando o servidor recusa de vez.

### 3.2 Regras

1. **Escreve local primeiro.** A ação grava no `outbox` e atualiza `route_cache` na mesma transação; só depois tenta a rede. A tela lê sempre do banco local.
2. **Ordem por rota.** Itens da mesma rota sobem em ordem de `created_at`, um por vez. Um `stop_deliver` nunca passa na frente do `route_start` que o precede.
3. **Idempotência.** O `id` do item é o `client_event_id`. Reenviar depois de queda de sinal não duplica.
4. **Hora do aparelho.** `occurred_at` é capturado no toque, não no envio. O servidor guarda também `received_at`.
5. **Nova tentativa.** Falha de rede ou 5xx → espera crescente (5 s, 15 s, 1 min, 5 min, teto de 15 min). 401 → renova o token e repete.
6. **Recusa definitiva.** 4xx (exceto 401/408/429) → `rejected`, guarda a mensagem e libera os próximos itens da rota. O motorista vê o item na tela de sincronização.
7. **Gatilhos do worker:** novo item na fila, rede voltou (NetInfo), app voltou ao primeiro plano e a cada disparo da tarefa de localização.
8. **Pings em lote.** `ping_buffer` sobe em blocos de até 200, mais antigos primeiro; confirmados são apagados. Eventos de parada têm prioridade sobre pings.
9. **Conflito com o escritório.** Se a rota foi cancelada no web, o servidor responde 409; o app marca os itens como `rejected`, avisa o motorista e atualiza a rota.
10. **Sair com pendências.** O logout pede confirmação e mostra quantos itens ainda não subiram. O banco local é apagado só no logout confirmado.
11. **Visibilidade.** Selo permanente no topo: "Sincronizado" ou "N pendentes". A tela `sync` lista pendentes e rejeitados.

### 3.3 Leitura offline

`GET /driver/routes` alimenta `route_cache`. Sem rede, as telas abrem a última cópia e mostram quando foi atualizada. Mudanças vindas do servidor não sobrescrevem paradas com item pendente no `outbox`.

---

## Fase 0 — Ambiente

- [x] Branch `desenvMobile` nos três repositórios
- [x] README do mobile corrigido (backend NestJS, SQLite agora e PostgreSQL depois)
- [x] Back e front alinhados com a `master` remota
- [x] `ANDROID_HOME` e `Path` de usuário corrigidos para `C:\Android` — ver `docs/ambiente-android.md`
- [ ] Conta Expo e `eas-cli`
- [ ] Skills instaladas (seção 5)

Critérios de aceite:
- `adb devices` lista o emulador ou o aparelho
- `npx expo --version` responde

## Fase 1 — Backend: motorista autenticado

- [ ] Papel `driver` em `USER_ROLES`; coluna `user.driver_id`
- [ ] Endpoint para o admin criar o acesso de um motorista; web: ação "Criar acesso ao app" na tela de motoristas
- [ ] `refresh_token` + `/auth/refresh` + `/auth/logout`
- [ ] Módulo `driver-app`: `GET /driver/me`, `GET /driver/routes`, `GET /driver/routes/:id`, `POST .../start`
- [ ] Guard que impede motorista de ler ou alterar rota de outro
- [ ] Papel `driver` bloqueado nos endpoints administrativos existentes
- [ ] `seed-demo-data.js` cria um motorista com login e uma rota para hoje

Critérios de aceite:
- Teste e2e: motorista A recebe 404 na rota do motorista B
- Teste e2e: token de `driver` recebe 403 em `GET /orders`
- `npm run test:all` verde

## Fase 2 — Mobile: base, login e rotas do dia

- [ ] `create-expo-app`, TypeScript strict, ESLint + Prettier, estrutura da seção 1.3
- [ ] `theme/tokens.ts` e componentes base (`Button`, `Input`, `Card`, `StatusBadge`, `EmptyState`, `ErrorState`)
- [ ] Cliente axios com renovação automática de token (uma renovação por vez, demais requisições aguardam)
- [ ] Login (RHF + Zod), sessão no SecureStore, guarda de rota no `_layout`
- [ ] `services/db`: esquema local e `route_cache`
- [ ] Telas "Rotas do dia" e "Sequência de paradas", somente leitura, com pull-to-refresh
- [ ] `EXPO_PUBLIC_API_URL` por perfil (dev: IP da máquina na rede local)

Critérios de aceite:
- Login no Expo Go contra o backend local mostra a rota do seed
- App aberto 2h depois do login continua autenticado
- Em modo avião, a rota já carregada abre normalmente
- `npx tsc --noEmit` e `npm run lint` limpos

## Fase 3 — Execução da parada e fila offline

Backend:
- [ ] Tabela `stop_event`, status `failed`, enum de ocorrências
- [ ] `arrive`, `deliver`, `fail`, `finish`, idempotentes por `client_event_id`
- [ ] Regra de encerramento corrigida (seção 2.2)

Mobile:
- [ ] Detalhe da parada: cliente, endereço, janela, nota fiscal, observações
- [ ] Botão "Navegar" (link universal da seção 1.1)
- [ ] "Cheguei", "Entregue" (observação opcional), "Não entregue" (tipo obrigatório + observação)
- [ ] `outbox` + worker conforme a seção 3, com testes unitários das regras 2, 5 e 6
- [ ] Selo de sincronização e tela `sync`
- [ ] Encerrar rota com resumo (entregues, ocorrências, tempo)

Web:
- [ ] Tela de rotas mostra ocorrência e observação de cada parada

Critérios de aceite:
- Em modo avião: iniciar a rota, baixar 3 paradas, fechar e reabrir o app, religar a rede → tudo chega uma única vez, na ordem e com a hora original
- Repetir um `client_event_id` responde 200 e não cria linha
- Rota cancelada no web durante a execução: o app avisa e não trava a fila

## Fase 4 — Rastreamento por GPS

- [ ] `app.config.ts`: permissões Android e iOS, plugin do `expo-location` com foreground service
- [ ] EAS Build perfil `development` → APK no aparelho real
- [ ] Permissão em duas etapas, com tela explicando o motivo antes do diálogo do sistema
- [ ] Tarefa em segundo plano: liga em `start`, desliga em `finish`; ponto a cada ~15 s ou 50 m
- [ ] Pontos vão para `ping_buffer` e sobem em lotes
- [ ] Backend: `route_location_ping` + `POST .../locations`
- [ ] Posição anexada aos eventos `arrived`/`delivered`/`failed`

Critérios de aceite:
- 30 min de trajeto com a tela apagada produzem rastro contínuo no banco
- Rastreamento para sozinho ao encerrar a rota (a notificação some)
- Sem permissão de localização, o app continua baixando paradas e avisa que não está medindo

## Fase 5 — Análise comparativa e painel

- [ ] Consolidação em `finish` → `route_execution_metrics`
- [ ] Endpoints `/analytics/*`, com testes unitários do cálculo sobre rastros fixos
- [ ] Web: `/analytics` consome `/analytics/*` em vez de somar listas no navegador
- [ ] Web: cartões (conclusão, tempo médio, ocorrências) e gráficos por motorista, região/horário e tipo de ocorrência (Recharts, já instalado)
- [ ] Web: comparação de uma rota — planejado × executado por parada, desvios destacados

Critérios de aceite:
- Para um rastro de teste conhecido, distância e duração batem com o esperado (tolerância de 2%)
- Rota com paradas fora de ordem aparece sinalizada
- Painel responde em menos de 2 s com 30 dias de dados de demonstração

## Fase 6 — Publicação na VM e piloto

- [ ] `Dockerfile` do backend + `.dockerignore` (sem `.env`, sem `athonis-*.json`, sem `*.sqlite`)
- [ ] `docker-compose.yml`: API + proxy reverso com HTTPS (Caddy ou Nginx com Let's Encrypt)
- [ ] **Domínio com HTTPS.** O Android recusa HTTP puro em build de produção
- [ ] SQLite em volume persistente, com cópia de segurança diária
- [ ] Chave da conta de serviço do Google como arquivo na VM, fora da imagem, com permissão restrita
- [ ] `CORS_ORIGIN`, `JWT_SECRET` e demais variáveis no `.env` da VM
- [ ] `GET /health`
- [ ] EAS Build perfil `preview` apontando para a VM → APK para o motorista
- [ ] Roteiro do piloto em `docs/piloto.md` e execução com rotas reais
- [ ] Ajustes vindos do campo (tamanho de botão, contraste no sol, bateria)

Critérios de aceite:
- APK instalado em aparelho real faz login contra a VM por HTTPS
- Pelo menos 3 rotas reais completas com rastro e eventos
- Nenhuma baixa de parada perdida (conferência com o controle da empresa)

## Fase 7 — PostgreSQL

- [ ] Driver `pg`; `DB_TYPE=postgres` por variável de ambiente
- [ ] Migrations do TypeORM para o esquema inteiro; `synchronize` só em dev
- [ ] Revisar tipos (`datetime` → `timestamptz`) e consultas com SQL específico
- [ ] Script de cópia dos dados do SQLite
- [ ] Serviço `postgres` no `docker-compose.yml`, com volume e backup

Critérios de aceite:
- `npm run test:all` verde contra PostgreSQL
- Dados do piloto presentes e íntegros após a migração

## Fase 8 — iOS (opcional)

- [ ] Conta Apple Developer e credenciais no EAS
- [ ] EAS Build `development` para iOS, instalado em iPhone
- [ ] Revalidar a Fase 4 no iPhone (permissão "Sempre", indicador azul de localização)

## Fase 9 — Entrega acadêmica

- [ ] Resultados com os números do piloto
- [ ] Artigo: stack real (NestJS, VM própria, PostgreSQL) e mapeamento MVC
- [ ] Diagramas: arquitetura, modelo de dados, sequência da baixa offline
- [ ] README final com instruções reais de execução

---

## 4. Arquitetura

```text
 App (Expo)                         Navegador
   │ HTTPS + JWT                        │
   ▼                                    ▼
 ┌──────────────────── VM ────────────────────┐
 │  proxy HTTPS → athonis-api (NestJS)         │
 │  SQLite em volume  (→ PostgreSQL, Fase 7)   │
 └───────────────────┬─────────────────────────┘
                     │ conta de serviço
                     ▼
          Google Maps Platform
   Route Optimization · Geocoding · Street View
```

O app não fala com o Google: abre o app de mapas por link e conversa só com a API do Athonis. Todas as chaves ficam no servidor.

---

## 5. Skills do Claude Code

| Skill | Origem | Para quê | Instalação |
|---|---|---|---|
| `expo` | Oficial (Expo) | Estrutura, Expo Router, data fetching e offline, dev client, EAS; inclui o servidor MCP do Expo | `claude plugin install expo@claude-plugins-official` |
| `google-maps-platform` | Oficial (Google Maps) | Uso correto de Geocoding, Street View e rotas; restrição de chaves | `npx skills add googlemaps/agent-skills` |
| `retrieving-developer-knowledge` | Oficial (Google) | Consulta a documentação atual do Google — útil para a Route Optimization, que a skill do Maps não cita | `npx skills add google/skills` e escolher a skill |
| `google-cloud-recipe-auth` | Oficial (Google) | Autenticação por conta de serviço, que é como o backend chama a Route Optimization | idem |
| `react-native-guidelines` | Oficial (Vercel) | Boas práticas de React Native e Expo: desempenho, layout, APIs de plataforma | `npx skills add vercel-labs/agent-skills` e escolher a skill |
| `react-best-practices` | Oficial (Vercel) | Regras de desempenho de React e Next.js, para o painel no web | idem |
| `composition-patterns` | Oficial (Vercel) | Composição de componentes, útil para a biblioteca `components/ui` do app | idem |
| `react-native-best-practices` | Callstack | Desempenho de listas e re-renderizações | `claude plugin marketplace add callstackincubator/agent-skills` |
| `context7` | Upstash (parceiro) | Documentação atual de NestJS, TypeORM, TanStack Query e Expo — cobre o backend, que não tem skill oficial | diretório de plugins |
| `nestjs-best-practices` | Comunidade (Kadajett) | 40 regras de NestJS, com categoria de banco e ORM. Ler antes de instalar | `npx skills add Kadajett/agent-nestjs-skills` |
| Android Emulator QA | Comunidade | Claude abre o app no emulador, tira print e lê o logcat | diretório de plugins |

Não vale instalar: skills de Cloud Run, Cloud SQL e GKE (a hospedagem é em VM própria), Firebase, Mobile Design System (os tokens já existem no web).

---

## 6. Fora do escopo

- Publicação em loja
- Foto e assinatura como comprovante
- Notificações push e reatribuição de rota em tempo real
- Mapa embutido com a rota desenhada
- Sugestão de desvio por trânsito; modelos preditivos

---

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Android encerra o rastreamento em segundo plano (economia de bateria do fabricante) | Foreground service com notificação; testar cedo no aparelho do piloto; orientar a liberar o app da otimização de bateria |
| Sem sinal em campo | Fila offline (seção 3) |
| VM sem HTTPS | Domínio + certificado antes do primeiro APK de `preview` |
| SQLite com escrita concorrente (pings de vários motoristas) | Lotes de pings em uma transação; PostgreSQL na Fase 7 |
| Perda do arquivo SQLite na VM | Volume persistente + cópia diária |
| LGPD: localização contínua de funcionário | Rastrear só com rota ativa, avisar na tela, termo de ciência do motorista |
| Divergência entre artigo e implementação | Corrigir na Fase 9 |
