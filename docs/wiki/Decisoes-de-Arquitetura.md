# Decisões de arquitetura (ADRs)

Formato curto: contexto, decisão, consequências. As decisões que mudaram em relação ao artigo (PAC 7) estão marcadas.

---

## ADR-01 — Estender o backend existente, em NestJS (muda o artigo)

**Contexto.** O artigo cita "Node.js + Express". O backend que já existia no sistema web, na verdade, é **NestJS** (que roda sobre Express) com TypeORM.
**Decisão.** Estender esse backend com os módulos `driver-app` e `analytics`, sem criar outro servidor.
**Consequências.** Um só lugar para regras de negócio, autenticação e isolamento por empresa. Os módulos e a injeção de dependência do NestJS facilitaram os testes (221 testes no backend).

## ADR-02 — PostgreSQL no lugar do SQLite (muda o artigo)

**Contexto.** O sistema usava SQLite em arquivo. O app traz escrita concorrente (pontos de GPS de vários motoristas) e o Portfólio pede um banco gerenciável em produção.
**Decisão.** PostgreSQL 17, com o esquema em migrations do TypeORM (`synchronize` desligado fora dos testes) e colunas de data como `timestamptz`.
**Consequências.** Testes e2e rodam contra um PostgreSQL de verdade no CI. Backup diário com `pg_dump` (14 dias).

## ADR-03 — Offline first com fila local e eventos idempotentes

**Contexto.** O motorista roda em área com sinal ruim; uma baixa perdida é um problema de negócio.
**Decisão.** O app grava tudo em SQLite e sincroniza por uma fila. Cada ação leva um UUID do aparelho (`client_event_id`), único no servidor.
**Alternativas.** Chamadas diretas com nova tentativa (perde dado se o app fecha); sincronização de banco completo (complexa demais para o escopo).
**Consequências.** A tela responde na hora e nada duplica. O custo é a lógica de reconciliação (`mergePending`), coberta por testes. Ver [[Fila Offline|Fila-Offline]].

## ADR-04 — Navegação por link para o Google Maps, sem mapa embutido

**Contexto.** O artigo prevê "abertura de rotas diretamente no aplicativo".
**Decisão.** O app abre o Google Maps por link universal (`google.com/maps/dir/?api=1&destination=lat,lng`).
**Consequências.** O app não carrega chave do Google (todas as chaves ficam no servidor) e o motorista usa o navegador que já conhece, com trânsito em tempo real. O mapa com o trajeto fica no painel web.

## ADR-05 — Métricas consolidadas no encerramento da rota

**Contexto.** Comparar planejado × executado exige percorrer centenas de pontos de GPS por rota.
**Decisão.** Calcular uma vez, no `finish`, e gravar em `route_execution_metrics` (distância por haversine descartando leituras com precisão pior que 50 m, paradas fora de ordem, atraso, atendimento, tempo ocioso).
**Consequências.** O painel lê números prontos e responde rápido com 30 dias de dados. O cálculo é uma função pura, testada com rastros fixos.

## ADR-06 — Hospedagem numa VPS com Docker Compose (muda o plano)

**Contexto.** O plano inicial usava uma VM no Azure for Students. Em novembro/2026 surgiu uma VPS da Hostinger (2 vCPU, 8 GB), cedida por um colega, que já roda o Coolify.
**Decisão.** Manter a infraestrutura como Docker Compose (portável) e ligá-la ao Traefik do Coolify por labels; produção e staging na mesma máquina, com bancos separados. A VM do Azure foi apagada.
**Alternativas.** PaaS (Render, Railway, Fly): menos operação, mas com hibernação, limites de banco no plano gratuito e custo para manter dois ambientes com Postgres e Grafana.
**Consequências.** Custo zero e controle total; a operação (backup, atualização do sistema) é responsabilidade do projeto. O dono da VPS tem acesso root, o que está declarado na política de privacidade e no termo do piloto.

## ADR-07 — Deploy por runner self-hosted, sem SSH

**Contexto.** O Portfólio veta deploy por SSH/FTP manual e pede CI/CD.
**Decisão.** Um runner do GitHub Actions roda na VPS, num usuário sem senha e fora do grupo `docker`, que só pode executar `infra/deploy.sh` via sudo. O workflow troca a tag da imagem (GHCR), sobe o serviço e confere `/health` de fora.
**Consequências.** Nenhuma chave SSH guardada no GitHub e nenhuma porta extra aberta; o runner só conecta para fora. Push em `desenvMobile` → staging; release → produção.

## ADR-08 — MVC no aplicativo

**Contexto.** O artigo promete MVC.
**Decisão.** Model = `features/*/model.ts` (schemas Zod); Controller = hooks, actions e services (API, fila, rastreamento); View = telas do Expo Router e componentes.
**Consequências.** Telas finas e regras testáveis sem renderizar nada. Ver [[Arquitetura (C4)|Arquitetura]].

## ADR-09 — Token curto com refresh rotativo

**Contexto.** Um JWT de 1 h deslogaria o motorista no meio da rota; um token longo é arriscado num celular.
**Decisão.** Access token de 1 h + refresh token de 30 dias, guardado no SecureStore, trocado a cada uso e gravado no servidor só como hash SHA-256. Logout revoga.
**Consequências.** Sessão contínua durante a rota; um token vazado deixa de valer na próxima renovação legítima.

## ADR-10 — Token do painel no servidor (Server Actions)

**Contexto.** O painel guardava o token no navegador.
**Decisão.** As chamadas à API passam por Server Actions do Next.js; o token fica num cookie httpOnly e nunca chega ao JavaScript da página.
**Consequências.** Um XSS não consegue ler o token. O proxy do Next faz a checagem otimista de sessão; a verificação real continua na API.
