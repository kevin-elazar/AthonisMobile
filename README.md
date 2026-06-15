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
│     Athonis Backend      │  ← Node.js + Express
│   (novos endpoints)      │
└──────┬───────────────────┘
       │
  ┌────┴─────┐   ┌──────────────────────┐
  │PostgreSQL│   │     Athonis Web      │  ← React
  │   (BD)   │   │  (painel analítico)  │
  └──────────┘   └──────────────────────┘
```

**Padrão arquitetural:** MVC aplicado no mobile e no backend.  
**Decisão de design:** o backend Athonis é *extendido* com novos endpoints — sem criação de nova infraestrutura.

### Stack tecnológico

| Camada | Tecnologia |
|--------|------------|
| Aplicativo mobile | React Native + Expo |
| Backend (API) | Node.js + Express |
| Frontend web | React |
| Banco de dados | PostgreSQL |
| Mapas / Rotas | Google Maps API |
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

## 📅 Cronograma de desenvolvimento

| Sprint | Período | Entrega |
|--------|---------|---------|
| S1 | Jul S1–S2 | Setup Expo, estrutura MVC, autenticação JWT |
| S2 | Jul S3–S4 | Modelagem BD: tabelas de entrega, ocorrência e métrica |
| S3 | Ago S1–S2 | Endpoints Node.js para listagem de entregas por motorista |
| S4 | Ago S3–S4 | Tela de sequência de entregas + Google Maps (deep link) |
| S5 | Set S1–S2 | Marcação de entrega concluída/ocorrência + timestamp |
| S6 | Set S3–S4 | Coleta de métricas em tempo real (geolocalização + cronômetro) |
| S7 | Out S1–S2 | Análise comparativa: rota planejada vs. executada |
| S8 | Out S3–S4 | Painel analítico integrado ao frontend React |
| S9 | Nov S1–S2 | Testes integrados, ajustes de UX e performance |
| S10 | Nov S3–S4 | Documentação técnica, TCC final e defesa |

---

## 🚀 Como executar

> 🚧 Em desenvolvimento — instruções completas serão adicionadas durante os sprints.

### Pré-requisitos
- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- Dispositivo físico ou emulador Android/iOS

### Mobile (Expo)
```bash
cd athonis-mobile
npm install
npx expo start
```

### Backend (Athonis)
```bash
cd athonis-backend
npm install
cp .env.example .env   # configure as variáveis (DB, JWT_SECRET, GOOGLE_MAPS_KEY)
npm run dev
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
