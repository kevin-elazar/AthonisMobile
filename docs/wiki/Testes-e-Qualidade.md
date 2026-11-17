# Testes e qualidade

Todo push e PR passa pelo CI do GitHub Actions nos três repositórios: **lint → typecheck → testes com cobertura → build → SonarCloud**. A cobertura mínima fica travada na configuração: se cair, o CI falha. As branches `master`/`main` exigem PR com uma aprovação.

| Repositório | Ferramentas | Testes | Cobertura | Limite no CI |
|---|---|---|---|---|
| AthonisBackend | Jest, Supertest, PostgreSQL no CI | 221 (unitários + e2e) | 80,8% das linhas (SonarCloud) | 80% linhas / 70% branches (`jest.coverage.config.js`) |
| athonis-front-end | Vitest, Testing Library | 136 | 38% das linhas | 30% linhas (`vitest.config.ts`) |
| AthonisMobile | Jest (jest-expo) | 46 | 95% das linhas dos módulos testados | — |

## O que é testado

**Backend**
- Regra de negócio da comparação planejado × executado (`route-metrics.calculator`) sobre rastros de GPS fixos: distância por haversine, descarte de leituras imprecisas, paradas fora de ordem, atraso, tempo ocioso.
- Endpoints do app (`/driver/*`): idempotência por `client_event_id`, motorista A recebendo 404 na rota do motorista B, papel `driver` recebendo 403 nos endpoints administrativos, regra de encerramento.
- Autenticação: login, renovação e revogação de refresh token.
- e2e contra PostgreSQL real (serviço do GitHub Actions), com as migrations.

**Painel**
- Regras de documento (CPF/CNPJ com dígito verificador), CNH (categoria × veículo, validade), placa, CEP e janela de entrega.
- Esquemas de validação (Zod) de todos os formulários.
- Conversão entre o formato da API e o da tela (mappers) e as Server Actions com a API simulada.
- Sessão (cookie httpOnly), proxy de autenticação e login.
- Hooks do React Query (busca, mutações, invalidação de cache) e formulários de cadastro renderizados.

**Aplicativo**
- Fila offline contra um servidor que falha como a rede real: ordem por rota, idempotência, espera crescente, recusa definitiva, renovação de sessão, prioridade dos eventos sobre o rastro ([[Fila Offline|Fila-Offline]]).
- Consentimento de localização: registro com data e versão, nova pergunta quando o texto muda.
- Formatação, link de navegação, classificação de erros da API e modelo da rota.

## Análise estática

- **SonarCloud** (organização `kevin-elazar`) analisa os três repositórios com a cobertura do CI. No backend, o quality gate está aprovado, com 0 bugs e 0 vulnerabilidades.
- **ESLint** e **TypeScript strict** em tudo; Prettier no app e no painel.

## Testes manuais registrados

- Fluxo completo do app no navegador contra o backend local: login, rotas do dia, saída, chegada, entrega, ocorrência, encerramento, sincronização e logout.
- Fila offline com o backend desligado: três ações pendentes subiram sozinhas, em ordem e com a hora original.
- Teste de GPS em aparelho real (30 min com a tela apagada) e piloto: ver [[Piloto e Aceite|Piloto-e-Aceite]].
