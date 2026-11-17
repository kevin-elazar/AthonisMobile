# Monitoramento

Três camadas: **saúde** (o serviço está de pé?), **métricas** (como está se comportando?) e **erros** (o que quebrou e onde?).

| Camada | Ferramenta | O que cobre |
|---|---|---|
| Saúde | `GET /health` (NestJS Terminus) | API no ar e banco respondendo. Usado pelo healthcheck do Docker, pelo `deploy.sh` (rollback se falhar) e pela conferência externa do CI |
| Métricas | Prometheus + Grafana | Requisições, latência, erros e recursos da VPS |
| Erros | Sentry | Exceções da API (`@sentry/nestjs`) e do painel (`@sentry/nextjs`, navegador e servidor), com ambiente `production`/`staging` |

## Métricas

A API expõe `GET /metrics` (prom-client) só na rede interna do Docker: de fora, o proxy reescreve `/metrics` para uma rota inexistente (404). O Prometheus coleta a cada 15 s das duas APIs (produção e staging), do `node-exporter` (servidor) e de si mesmo, e guarda 30 dias.

O Grafana (`https://grafana.<domínio>`, login `admin`, senha no `.env` do servidor) abre com o painel **"Athonis - API e VM"**, provisionado automaticamente:

| Painel | Para quê |
|---|---|
| API no ar | Alvo do Prometheus respondendo (1/0) |
| Requisições/min | Volume de uso |
| Erros 5xx (%) | Taxa de falha do servidor |
| Latência p95 | Tempo de resposta percebido |
| Requisições e latência p95 por rota | Qual endpoint está lento ou mais usado |
| Respostas por status | Distribuição 2xx/4xx/5xx |
| Memória da API | Vazamento ou pico |
| VM: CPU e memória em uso (%) | Folga da VPS (produção e staging dividem a máquina) |

## Aplicativo

O app registra no próprio aparelho o que importa para a operação e mostra ao motorista: itens pendentes ou recusados pela API (tela de sincronização) e o estado do rastreamento (em "Minha conta"). No servidor, o volume de pontos de GPS por rota (`ping_count` em `route_execution_metrics`) mostra se o rastreamento em segundo plano funcionou no aparelho.

## Rotina

- Depois de cada deploy, o CI confere `/health` de fora.
- Antes da demonstração: abrir o Grafana e conferir "API no ar" = 1, erros 5xx ≈ 0 e CPU/memória com folga.
