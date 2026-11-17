# Athonis — gerenciamento operacional de entregas

O **Athonis** fecha o ciclo da roteirização: o painel web planeja as rotas, o **aplicativo do motorista** executa (sequência de paradas, baixa de entrega, ocorrências e rastro de GPS, tudo funcionando sem sinal) e o painel compara o **planejado com o executado** para melhorar as próximas rotas.

TCC de Engenharia de Software — Centro Universitário Católica de Santa Catarina (2026), linha **Mobile** do Portfólio. Parceiro: **Forte Acessórios para Móveis** (Jaraguá do Sul, SC).

## Problema

A empresa já gerava rotas otimizadas, mas perdia o rastro depois que o caminhão saía: não havia registro confiável de entregas concluídas, motivo das não entregues, horário real de chegada nem trajeto percorrido. Sem esses dados, não dava para saber se a rota planejada era boa.

**Pergunta de pesquisa:** como um aplicativo mobile pode complementar um sistema web de otimização de rotas para ampliar a coleta de dados operacionais e a visibilidade das entregas em campo?

## Componentes

| Componente | Repositório | Tecnologia |
|---|---|---|
| App do motorista | [AthonisMobile](https://github.com/kevin-elazar/AthonisMobile) | Expo SDK 57 (React Native), Expo Router, SQLite, expo-location |
| API | [AthonisBackend](https://github.com/kevin-elazar/AthonisBackend) | NestJS 11, TypeORM, PostgreSQL 17 |
| Painel web | [athonis-front-end](https://github.com/kevin-elazar/athonis-front-end) | Next.js 16, React 19, TanStack Query |
| Infraestrutura | `AthonisBackend/infra` | Docker Compose numa VPS Linux, Traefik/HTTPS, Prometheus, Grafana, Sentry |

## Links

- **APK do aplicativo:** [GitHub Releases](https://github.com/kevin-elazar/AthonisMobile/releases/latest)
- **Painel (staging):** https://staging-app.187-53-99-235.sslip.io
- **API (staging):** https://staging-api.187-53-99-235.sslip.io/health
- **Política de privacidade:** https://app.187-53-99-235.sslip.io/privacidade

## Páginas

1. [[Requisitos]] — funcionais e não funcionais, ligados aos objetivos do artigo
2. [[Casos de Uso|Casos-de-Uso]] — atores e fluxos completos
3. [[Navegação do App|Navegacao-do-App]] — mapa de telas
4. [[Arquitetura (C4)|Arquitetura]] — contexto, contêineres e componentes
5. [[Modelo de Dados|Modelo-de-Dados]] — DER
6. [[Fila Offline|Fila-Offline]] — como nenhuma baixa se perde sem sinal
7. [[Decisões de Arquitetura|Decisoes-de-Arquitetura]] — ADRs
8. [[Deploy e Infraestrutura|Deploy-e-Infraestrutura]]
9. [[Monitoramento]]
10. [[Testes e Qualidade|Testes-e-Qualidade]]
11. [[Segurança e LGPD|Seguranca-e-LGPD]]
12. [[Instalação|Instalacao]] — rodar localmente e instalar o APK
13. [[Piloto e Aceite|Piloto-e-Aceite]]
