# Requisitos

Derivados dos objetivos específicos (OE) do artigo (PAC 7) e refinados durante a implementação. A coluna **Onde** aponta o código que atende cada um.

## Requisitos funcionais

| ID | Requisito | OE | Onde |
|---|---|---|---|
| RF01 | O motorista entra no aplicativo com e-mail e senha criados pelo administrador da empresa | OE1 | `AthonisMobile/src/app/(auth)/login.tsx`, `POST /auth/login` |
| RF02 | O aplicativo mostra as rotas do dia do motorista logado, e só as dele | OE1 | `GET /driver/routes`, `src/app/(app)/index.tsx` |
| RF03 | O aplicativo mostra a sequência de paradas da rota, com cliente, endereço, janela e situação | OE1 | `src/app/(app)/route/[id].tsx` |
| RF04 | O motorista abre a navegação até a parada no Google Maps | OE1 | `src/lib/maps.ts` (link universal) |
| RF05 | O motorista inicia a rota, registra chegada, entrega (com observação) e não entrega (com tipo de ocorrência obrigatório) | OE2 | `POST /driver/routes/:id/start`, `/stops/:orderId/arrive|deliver|fail` |
| RF06 | Cada registro guarda data e hora do aparelho no momento do toque e a posição, quando disponível | OE2 | `route_event.occurred_at`, `latitude`, `longitude` |
| RF07 | O motorista encerra a rota; paradas sem baixa impedem o encerramento | OE2 | `POST /driver/routes/:id/finish` |
| RF08 | O motorista cancela a rota com motivo; as paradas abertas voltam para planejamento | OE2 | `POST /driver/routes/:id/cancel`, `route_returned_stop` |
| RF09 | Com a rota em andamento, o aplicativo registra o trajeto (a cada 15 s ou 50 m), inclusive com a tela apagada | OE3 | `src/services/location/tracking.ts`, `POST /driver/routes/:id/locations` |
| RF10 | Antes de pedir a permissão de localização, o aplicativo explica a coleta e registra o consentimento | OE3 | `src/app/(app)/location-consent.tsx` |
| RF11 | Todas as ações funcionam sem sinal e são enviadas quando a conexão volta, na ordem e sem duplicar | OE2/OE3 | `src/features/sync/worker.ts` ([[Fila Offline|Fila-Offline]]) |
| RF12 | Ao encerrar a rota, o sistema calcula planejado × executado: distância, duração, paradas fora de ordem, atraso, tempo de atendimento e tempo ocioso | OE4 | `route-metrics.calculator.ts`, `route_execution_metrics` |
| RF13 | O painel mostra indicadores do período: conclusão, pontualidade, ocorrências por tipo, desempenho por motorista e por região/horário | OE6 | `GET /analytics/*`, `athonis-front-end/src/app/(app)/analytics` |
| RF14 | O painel mostra a comparação de uma rota parada a parada e o trajeto real no mapa | OE4/OE6 | `GET /analytics/routes/:id/comparison`, `route-comparison-dialog.tsx` |
| RF15 | O painel acompanha ao vivo as rotas em andamento (posição e próxima parada) | OE6 | `GET /analytics/live`, `src/app/(app)/tracking` |
| RF16 | O administrador cria, troca e revoga o acesso do motorista ao aplicativo | OE5 | `PUT/DELETE /drivers/:id/access` |
| RF17 | O painel mantém cadastros de clientes, pedidos (inclusive importação por planilha), motoristas e veículos, e gera rotas otimizadas | — (sistema existente) | módulos `clients`, `orders`, `order-imports`, `optimization-routes` |

## Requisitos não funcionais

| ID | Requisito | Como é atendido |
|---|---|---|
| RNF01 | **Offline first:** nenhuma ação do motorista depende de sinal | Banco local SQLite, fila com reenvio e `client_event_id` idempotente |
| RNF02 | **Segurança:** tráfego só por HTTPS; senhas com hash; token curto com renovação | Traefik + Let's Encrypt, bcrypt, JWT de 1 h + refresh token rotativo guardado no SecureStore |
| RNF03 | **Isolamento entre empresas:** cada empresa só vê os próprios dados | `id_company` em todas as tabelas, extraído do token |
| RNF04 | **Privacidade (LGPD):** localização só com rota ativa, consentimento registrado, política pública | Ver [[Segurança e LGPD|Seguranca-e-LGPD]] |
| RNF05 | **Bateria:** rastreamento só durante a rota, com intervalo mínimo de 15 s / 50 m e envio em lotes de até 200 pontos | `tracking.ts`, `SYNC_MIN_INTERVAL_MS` |
| RNF06 | **Usabilidade em campo:** alvos de toque de no mínimo 52 px, ação principal fixa no rodapé, tema claro/escuro | `src/theme/tokens.ts` (`MIN_TOUCH`), `Screen` |
| RNF07 | **Disponibilidade e observabilidade:** health check, métricas e alertas de erro | `/health`, Prometheus + Grafana, Sentry |
| RNF08 | **Qualidade:** CI com lint, typecheck, testes e análise estática em todo push; cobertura mínima travada | GitHub Actions + SonarCloud ([[Testes e Qualidade|Testes-e-Qualidade]]) |
| RNF09 | **Portabilidade:** um código para Android e iOS; infraestrutura em contêineres | Expo, Docker Compose |
| RNF10 | **Desempenho do painel:** indicadores de 30 dias em menos de 2 s | Métricas consolidadas no encerramento da rota (não calculadas a cada consulta) |
