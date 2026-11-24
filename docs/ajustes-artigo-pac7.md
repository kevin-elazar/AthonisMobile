# Ajustes do artigo (PAC 7 → versão final)

O PAC 7 foi escrito como **proposta**. A versão final precisa descrever o que foi **construído e validado**. Abaixo, seção por seção: o que muda, por quê e um texto pronto para colar (revise o tom e ajuste à sua voz). Itens marcados com **[piloto]** só podem ser preenchidos com os números do piloto (`docs/piloto.md`).

Resumo das mudanças de fundo:

| No PAC 7 | Na versão final | Motivo |
|---|---|---|
| Backend Node.js + **Express** | **NestJS 11** (sobre Express) + TypeORM | É o que o sistema existente usa (ADR-01) |
| Banco não detalhado / SQLite no sistema web | **PostgreSQL 17** com migrations | Concorrência dos pings de GPS e exigência do Portfólio (ADR-02) |
| Frontend **React** | **Next.js 16** (React 19) | É o framework do painel existente |
| "Infraestrutura já validada", sem hospedagem descrita | **VPS Linux com Docker Compose**, HTTPS, CI/CD sem SSH, Prometheus/Grafana, Sentry | Exigência de deploy em nuvem do Portfólio (ADR-06/07) |
| Offline como **trabalho futuro** | **Offline first implementado** (fila local idempotente) | Risco de conectividade virou requisito (ADR-03) |
| Tela de "mapa" no app | **Navegação por link** para o Google Maps; mapa do trajeto **no painel** | ADR-04 |
| Cronograma jul–nov/**2025** | Desenvolvimento em **2026** (ver cronograma realizado) | Datas reais |
| Resultados **esperados** | Resultados **obtidos** no piloto | **[piloto]** |
| Artefatos "mediante solicitação" | Repositórios **públicos**, Wiki, APK | Exigência do Portfólio |

---

## Título

Mantém. Opcional, mais preciso: *"Aplicativo Mobile Offline-First para Gerenciamento Operacional de Entregas: uma Extensão do Sistema de Otimização de Rotas"*.

## Resumo / Abstract

Trocar "apresenta a proposta" por "apresenta o desenvolvimento e a validação". Texto sugerido:

> Este trabalho apresenta o desenvolvimento e a validação de um aplicativo mobile para o gerenciamento operacional de entregas, construído como extensão de um sistema web de otimização de rotas já existente. O aplicativo permite que entregadores visualizem a sequência de paradas, registrem entregas e ocorrências e tenham o trajeto registrado por GPS, inclusive sem conexão com a internet, por meio de uma fila local idempotente. Os dados coletados alimentam um painel analítico que compara a rota planejada pela API do Google com a rota executada em campo. O problema investigado é: como um aplicativo mobile pode complementar um sistema web de otimização de rotas para ampliar a coleta de dados operacionais e a visibilidade das entregas em campo? A solução adota React Native com Expo no mobile e estende o backend NestJS existente, com PostgreSQL, e foi implantada em servidor próprio com integração e entrega contínuas. Em piloto com **[piloto: N]** rotas reais na empresa Forte Acessórios para Móveis, **[piloto: principal resultado, ex.: 100% das paradas registradas com horário e motivo, contra X% antes]**, confirmando a hipótese de aumento da rastreabilidade.

Abstract: traduzir o mesmo texto.

**Palavras-chave:** acrescentar *Offline-first*.

## 1 Introdução

Sem mudanças estruturais. No último parágrafo, trocar o futuro pelo pretérito ("este trabalho desenvolveu…") e antecipar em uma frase o resultado do piloto **[piloto]**.

## 4 Objetivos

Mantêm-se. Sugestão: depois da lista, uma frase dizendo onde cada objetivo foi atendido (a página **Requisitos** da Wiki traz o mapeamento OE → requisito → código).

## 7 Proposta: Arquitetura e Tecnologias → renomear para **"Arquitetura e Implementação"**

Substituir o segundo parágrafo ("No backend, o projeto Athonis (Node.js + Express)…") por:

> No backend, o sistema Athonis, desenvolvido em NestJS com TypeORM, recebeu dois novos módulos, sem criação de novo servidor: `driver-app`, com os endpoints usados pelo aplicativo (rotas do dia do motorista, início e encerramento da rota, chegada, entrega e ocorrência por parada, e recebimento do rastro de GPS em lotes), e `analytics`, que expõe os indicadores do painel e a comparação entre rota planejada e executada. Toda ação enviada pelo aplicativo carrega um identificador gerado no aparelho (`client_event_id`), único no servidor, o que torna o reenvio seguro: uma ação repetida após queda de conexão não é duplicada. A autenticação usa JWT de curta duração com *refresh token* rotativo, e cada empresa só acessa os próprios dados. O banco de dados passou de SQLite para PostgreSQL, com o esquema versionado por *migrations*.

Acrescentar um parágrafo sobre o **offline first**:

> O aplicativo foi construído no modelo *offline first*: toda ação do entregador é gravada primeiro em um banco SQLite no aparelho, junto com a atualização da tela, e enviada por uma fila de sincronização quando há conexão. A fila preserva a ordem das ações de cada rota, guarda o horário do toque (e não o do envio), repete com espera crescente em falhas de rede e separa recusas definitivas do servidor para o entregador conferir. O rastreamento de GPS roda como serviço em primeiro plano no Android, apenas durante a rota, com leituras a cada 15 segundos ou 50 metros.

Ajustar a menção ao Google Maps:

> A integração com o Google Maps acontece em dois pontos: no servidor, a Route Optimization API gera as rotas e o horário previsto de cada parada; no aplicativo, a navegação abre o Google Maps nativo por *link* universal, sem chave de API no aparelho. O trajeto executado é desenhado no painel web.

E o painel:

> O painel analítico foi implementado no frontend Next.js existente, consumindo indicadores consolidados pelo backend no encerramento de cada rota.

**Mapeamento MVC** (o artigo promete MVC; vale explicitar):

> No aplicativo, os *models* são os esquemas de dados validados com Zod (Rota, Parada, Ocorrência e item da fila); os *controllers* são os *hooks* e serviços que concentram as chamadas à API, a fila offline, a sincronização e o rastreamento; e as *views* são as telas do Expo Router e os componentes de interface.

**Figura nova sugerida:** diagrama de contêineres (C4 nível 2) da página **Arquitetura** da Wiki, e o diagrama de sequência da baixa offline da página **Fila Offline**.

### Tabela 2 — substituir

| Camada | Tecnologia |
|---|---|
| Aplicativo mobile | React Native + Expo SDK 57, Expo Router, SQLite (expo-sqlite), expo-location |
| Backend (API) | Node.js + NestJS 11, TypeORM |
| Frontend web | Next.js 16 (React 19), TanStack Query |
| Banco de dados | PostgreSQL 17 |
| Geolocalização/Rotas | Google Route Optimization e Geocoding (servidor); Google Maps por *link* (app) |
| Autenticação | JWT + *refresh token* rotativo |
| Infraestrutura | Docker Compose em VPS Linux, Traefik com HTTPS (Let's Encrypt) |
| CI/CD e qualidade | GitHub Actions, SonarCloud, Jest/Vitest |
| Observabilidade | Prometheus, Grafana, Sentry |

### Seção nova sugerida: "Implantação e Qualidade"

> A solução foi implantada em um servidor privado virtual (VPS) Linux, com os serviços em contêineres Docker, HTTPS automático e ambientes separados de homologação (*staging*) e produção. Cada alteração passa por integração contínua no GitHub Actions — análise estática, verificação de tipos, testes automatizados com cobertura mínima e análise no SonarCloud — e, quando aprovada, é publicada automaticamente por um executor instalado no próprio servidor, sem acesso por SSH. O backend conta com 221 testes automatizados (unitários e de integração contra PostgreSQL), com 80,8% de cobertura de linhas; o painel, com 136 testes; e o aplicativo, com 46, concentrados na fila offline. A disponibilidade é acompanhada por métricas no Prometheus/Grafana e os erros pelo Sentry.

## 8 Cronograma → "Cronograma realizado"

Trocar o planejado de 2025 pelo realizado (datas tiradas do histórico do git):

| Período | Entrega |
|---|---|
| nov/2025 – jan/2026 | Sistema web Athonis (semestre anterior): otimização de rotas, autenticação, importação de pedidos, multiempresa |
| set/2026 | Preparação do backend e do painel: rota como registro próprio, cache de geocodificação, janela de entrega na otimização, ligação da nova interface à API |
| out/2026 (1ª quinzena) | Aplicativo: login do motorista com sessão longa, rotas do dia, baixa de parada, ocorrências, fila offline, rastro de GPS; módulo de análise e painel de execução em campo |
| out/2026 (2ª quinzena) | Acompanhamento ao vivo, cancelamento e duplicação de rota |
| nov/2026 (1ª quinzena) | PostgreSQL com *migrations*, CI/CD, SonarCloud, monitoramento, implantação na VPS |
| nov/2026 (2ª quinzena) | Testes do painel, consentimento de localização (LGPD), documentação, versão 1.0.0, piloto e escrita final |

## 9 Resultados Esperados → **"Resultados"**

Estrutura sugerida, a preencher com o piloto **[piloto]**:

> **9.1 Execução do piloto.** O piloto ocorreu entre **[datas]** na Forte Acessórios para Móveis, com **[N]** rotas reais, **[N]** paradas e **[N]** motorista(s), usando o aplicativo na versão 1.0.0 e o painel em produção.

**Tabela 4 — Planejado × executado por rota [piloto]**

| Rota | Paradas | Entregues | Não entregues | Distância plan. × real (km) | Duração plan. × real (min) | Fora de ordem | Atraso médio (min) |
|---|---|---|---|---|---|---|---|

> **9.2 Rastreabilidade.** Antes do aplicativo, **[X]** das entregas tinham registro de horário e motivo de não entrega (controle manual); com o aplicativo, **[Y]**. Nenhuma baixa foi perdida na conferência com o controle da empresa **[confirmar]**, inclusive **[N]** ações registradas sem sinal e sincronizadas depois.

> **9.3 Dados para a melhoria das rotas.** A comparação mostrou **[ex.: desvio médio de X% na distância, Y paradas fora da ordem planejada, tempo médio de atendimento de Z min, contra os W min configurados na otimização]**. Esses dados indicam **[ex.: ajustar o tempo de parada configurado / revisar a ordem em determinada região]**.

> **9.4 Percepção dos usuários.** **[síntese das respostas do motorista e do gestor]**.

Retomar os quatro resultados esperados do PAC 7 e dizer, para cada um, se foi atingido.

## 10 Discussão

- O parágrafo do risco de conectividade deixa de ser "parcialmente mitigável": **foi tratado** com o modelo offline first. Texto: *"O risco de dependência de conectividade, apontado na proposta, foi tratado como requisito: o aplicativo opera integralmente sem sinal e sincroniza depois, sem perda nem duplicação, o que foi verificado em testes automatizados e **[piloto: N ações offline no piloto]**."*
- Acrescentar as **mudanças de decisão** e o porquê: NestJS, PostgreSQL, VPS em vez de PaaS (custo e controle, com o risco de servidor de terceiro), navegação por link em vez de mapa embutido.
- Acrescentar **privacidade**: a localização contínua de funcionário exige base legal e transparência; a solução coleta só com rota ativa, pede consentimento informado antes da permissão do sistema, registra a decisão e publica política de privacidade.
- **Limitações**: piloto curto (**[N]** rotas), um único parceiro, APK fora da loja, dependência da otimização do Google (há modo estimado quando a API não responde), rastreamento sujeito às políticas de bateria de cada fabricante.

## 11 Conclusão

Trocar "proposta"/"é tecnicamente viável" por "desenvolvido"/"foi validado". Texto sugerido para o fim:

> O aplicativo, o backend e o painel foram implantados e validados em operação real, **[piloto: síntese]**. Como trabalhos futuros, ficam: integração com APIs de trânsito em tempo real para sugestão dinâmica de desvios, uso do histórico de execução como entrada da otimização (tempo de atendimento e velocidade reais por região), comprovante de entrega por foto e assinatura, e publicação nas lojas de aplicativos.

(Tirar "modo offline" dos trabalhos futuros: foi implementado.)

## Declarações complementares

**Disponibilidade de artefatos** — substituir:

> Os artefatos estão disponíveis publicamente: aplicativo (https://github.com/kevin-elazar/AthonisMobile), API e infraestrutura (https://github.com/kevin-elazar/AthonisBackend) e painel web (https://github.com/kevin-elazar/athonis-front-end), com documentação na Wiki do projeto (https://github.com/kevin-elazar/AthonisMobile/wiki) e o APK na página de *releases* do aplicativo.

**Uso de Inteligência Artificial** — o texto atual cita só a revisão do texto. Como o desenvolvimento também usou IA (Claude Code), a declaração precisa refletir isso. Sugestão:

> O autor utilizou ferramentas de inteligência artificial generativa (Claude e Claude Code, da Anthropic) como apoio à implementação, à escrita de testes e de documentação e à revisão de linguagem do texto. Todo o código e o texto foram revisados, testados e validados pelo autor, que é responsável integral pelo conteúdo e pelas decisões de projeto.

**Contribuições dos autores** — acrescentar que o painel web partiu da interface desenvolvida por Gustavo (GitHub @GustavoJRoss) no semestre anterior (o README do painel detalha a autoria de cada parte).

## Referências

- Manter as seis. Opcional: citar a documentação do Expo (rastreamento em segundo plano), a LGPD (Lei 13.709/2018) e o modelo C4 (Simon Brown), já que passam a aparecer no texto.
- Atualizar "Acesso em: maio 2025" das soluções comerciais se forem reconsultadas.

## Checklist final

- [ ] Nenhum "será desenvolvido" / "propõe-se" restante (busca por "será", "propost", "esperad")
- [ ] Datas: 2025 → 2026 onde se referem a este TCC
- [ ] Tabela 2 trocada; figuras C4 e sequência offline inseridas
- [ ] Resultados com os números do piloto e o termo de aceite anexado
- [ ] Declaração de uso de IA atualizada
- [ ] "Sobrenome, 202X" do cabeçalho e "DD Month YYYY" preenchidos conforme o modelo da SBC
