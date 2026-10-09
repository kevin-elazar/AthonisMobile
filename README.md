# 📦 Athonis Mobile — Gerenciamento Operacional de Entregas

> Aplicativo mobile para entregadores desenvolvido como extensão do sistema web Athonis de otimização de rotas.  
> **TCC — Engenharia de Software | Universidade Católica de Santa Catarina | 2026**

---

## 📋 Sobre o projeto

O **Athonis Mobile** fecha o ciclo operacional que falta no planejamento de rotas: o que acontece depois que o motorista sai com o caminhão?

O sistema web **Athonis** (desenvolvido no semestre anterior) já otimiza rotas via Google Maps e gerencia pedidos, clientes, motoristas e veículos. O que ele não faz é acompanhar a execução em campo. Não há registro de entregas concluídas, coleta de métricas operacionais ou retroalimentação dos dados de rota.

Este TCC resolve essa lacuna com um aplicativo mobile que:
- Mostra ao entregador a sequência de paradas do dia
- Permite marcar entregas como concluídas ou com ocorrência
- Coleta métricas em tempo real (tempo de deslocamento, desvios, trânsito)
- Alimenta um painel analítico integrado ao sistema web

Os dados coletados permitem ainda **análise comparativa entre a rota gerada pela API e a rota executada em campo**, identificando padrões de ineficiência e oportunidades de melhoria contínua.

### Empresa parceira

**Forte Acessórios para Móveis** — Jaraguá do Sul, SC  
Comércio atacadista de madeira, ferragens, ferramentas e materiais correlatos.  
Mais de 15 anos de mercado, operando diariamente um volume expressivo de pedidos e entregas para indústrias moveleiras e construtoras da região.

---

## 🎯 Funcionalidades

### Sistema web (existente — Athonis)
- ✅ Cadastro de pedidos, clientes, motoristas e veículos
- ✅ Importação de pedidos via planilha CSV
- ✅ Geração de rotas otimizadas via Google Maps API

### Aplicativo mobile (TCC — em desenvolvimento)
- [ ] Visualização da sequência de entregas do dia
- [ ] Abertura de rota no Google Maps (deep link por parada)
- [ ] Marcação de entrega como concluída ou com ocorrência
- [ ] Registro de data, hora e observações por parada
- [ ] Coleta de métricas em tempo real (geolocalização + cronômetro)
- [ ] Sincronização automática com o backend Athonis

### Painel analítico (TCC — em desenvolvimento)
- [ ] Índice de conclusão de entregas por motorista
- [ ] Tempo médio de entrega por região e horário
- [ ] Análise comparativa: rota planejada vs. rota executada
- [ ] Frequência e categorização de ocorrências

---

## 🏗️ Arquitetura

```
┌──────────────────────────┐
│      Athonis Mobile      │  ← React Native + Expo
│  (entregador em campo)   │
└────────────┬─────────────┘
             │  REST API (JWT)
             ▼
┌──────────────────────────┐
│     Athonis Backend      │  ← NestJS + TypeORM
│   (novos endpoints)      │
└──────┬───────────────────┘
       │
  ┌────┴─────┐   ┌──────────────────────┐
  │  SQLite  │   │     Athonis Web      │  ← Next.js
  │   (BD)   │   │  (painel analítico)  │
  └──────────┘   └──────────────────────┘
```

**Padrão arquitetural:** MVC no mobile (models, hooks como controllers, telas como views); módulos NestJS no backend.  
**Decisão de design:** o backend Athonis é *extendido* com novos endpoints — sem criação de nova infraestrutura.  
**Banco de dados:** SQLite durante o desenvolvimento e os testes; migração para PostgreSQL planejada.

### Stack tecnológico

| Camada | Tecnologia |
|--------|------------|
| Aplicativo mobile | React Native + Expo |
| Backend (API) | Node.js + NestJS + TypeORM |
| Frontend web | Next.js (React) |
| Banco de dados | SQLite (PostgreSQL planejado) |
| Mapas / Rotas | Google Maps Platform (Route Optimization, Geocoding, Street View) |
| Autenticação | JWT |

---

## 🆚 Diferenciais frente ao mercado

Plataformas como **Track-POD**, **ControLog** e **Routech Motorista** cobrem o cotidiano operacional do entregador, mas apresentam duas limitações centrais:

1. **Sem análise comparativa de rotas:** nenhuma compara a rota gerada automaticamente com a executada em campo para fins de melhoria contínua.
2. **Sistemas fechados:** não permitem integração nativa com sistemas web preexistentes — exigem migração total da operação.

O Athonis Mobile resolve ambos: análise comparativa como funcionalidade de primeira classe, e integração direta ao sistema já validado em produção.

| Funcionalidade | Track-POD | ControLog | Routech | **Athonis Mobile** |
|---|:---:|:---:|:---:|:---:|
| Sequência de entregas + Google Maps | ✅ | ✅ | ✅ | ✅ |
| Marcação de ocorrências com timestamp | ✅ | ✅ | ✅ | ✅ |
| Coleta de métricas em tempo real | ✅ | ~  | ~  | ✅ |
| Análise comparativa rota planejada vs. executada | ~ | ❌ | ❌ | ✅ |
| Integração nativa com sistema web preexistente | ~ | ✅ | ~ | ✅ |
| Painel analítico integrado | ✅ | ~ | ~ | ✅ |

---

## 📅 Plano de desenvolvimento

O plano por fases, com tarefas e critérios de aceite, está em [`SPEC.md`](SPEC.md).
O desenvolvimento acontece na branch `desenvMobile`, que existe nos três repositórios (mobile, backend e front-end).

---

## 🚀 Como executar

> 🚧 Em desenvolvimento — as instruções do app entram quando o projeto Expo for criado (Fase 2 do `SPEC.md`).

### Pré-requisitos
- Node.js 22+
- Android Studio (SDK + emulador) ou aparelho físico com Expo Go

### Backend (Athonis)
```bash
cd AthonisBackend
npm install
cp .env.example .env   # configure JWT_SECRET e as variáveis do Google
npm run start:dev
```

---

## 📄 Publicação acadêmica

Artigo no formato **SBC Reviews 2025** disponível em [`docs/artigo-tcc.pdf`](docs/artigo-tcc.pdf).

---

## 👨‍💻 Autor

**Kevin Chedid El Azar**  
Engenharia de Software — Universidade Católica de Santa Catarina  
✉️ kevin.azal@catolicasc.edu.br

---

*Projeto acadêmico — todos os direitos reservados ao autor.*
