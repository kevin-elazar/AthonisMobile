# Roteiro do piloto — Forte Acessórios para Móveis

**Objetivo:** validar o Athonis em operação real e produzir os números da seção de Resultados do artigo, respondendo à hipótese: *a integração do aplicativo aumenta a rastreabilidade das entregas e fornece dados para melhorar as rotas.*

**Período:** 19 a 23/11/2026 (mínimo de **3 rotas reais completas**).
**Ambiente:** produção (`app.<domínio>` e APK da Release v1.0.0).
**Responsável:** Kevin Chedid El Azar. **Contato na empresa:** a definir com o gestor de logística.

## 1. Preparação (antes do primeiro dia)

- [ ] Gestor de logística leu e concordou com o roteiro e o termo de aceite (`docs/termo-de-aceite.md`)
- [ ] Motorista(s) informados sobre a coleta de localização (só com rota ativa) e cientes do termo
- [ ] Empresa cadastrada em produção com **endereço e coordenadas do depósito** e horário de expediente
- [ ] Clientes e pedidos do dia cadastrados ou importados por planilha (endereços revisados)
- [ ] Motorista com acesso ao aplicativo (**Motoristas → Acesso ao aplicativo**) e veículo cadastrado
- [ ] APK instalado no celular do motorista; login feito; Athonis fora da otimização de bateria
- [ ] Teste de GPS concluído: 30 min com a tela apagada geram rastro contínuo (ver item 4)
- [ ] Grafana conferido: API no ar, erros 5xx ≈ 0

## 2. Execução (cada dia de rota)

| Momento | Quem | O quê |
|---|---|---|
| Manhã | Logística | Seleciona os pedidos do dia → **Gerar rotas** → escala motorista e veículo |
| Saída | Motorista | Abre a rota → **Iniciar rota** (consentimento na 1ª vez) |
| Em cada parada | Motorista | **Navegar** → **Cheguei** → **Entregue** ou **Não entregue** (com o motivo) |
| Durante | Logística | Acompanha em **Rastreamento** (posição e próxima parada) |
| Fim | Motorista | **Encerrar rota**; confere que o selo mostra "Sincronizado" |
| Fim do dia | Kevin | Exporta os indicadores (item 3) e anota observações de campo |

**Controle paralelo:** a empresa mantém o controle atual de entregas (canhoto/planilha) para conferência com o que o app registrou.

## 3. Dados a coletar (por rota)

Do painel (**Análises → Execução em campo** e comparação da rota):

| Indicador | Fonte |
|---|---|
| Paradas planejadas, entregues e não entregues; motivos | Comparação da rota |
| Distância planejada × percorrida (km) | `route_execution_metrics` |
| Duração planejada × real (min) | idem |
| Paradas fora da ordem planejada | idem |
| Atraso médio na chegada (min) e pontualidade (%) | idem |
| Tempo médio de atendimento por parada (min) | idem |
| Tempo ocioso fora de parada (min) | idem |
| Pontos de GPS recebidos | `ping_count` |
| Baixas feitas sem sinal (pendentes que subiram depois) | Tela de sincronização / eventos com `received_at` posterior |

E fora do sistema:

- **Rastreabilidade antes × depois:** quantas entregas do período tinham registro de horário e motivo de não entrega **antes** do app (controle atual) × com o app.
- **Divergências** entre o controle da empresa e o app (meta: zero baixa perdida).
- **Percepção** do motorista e do gestor (3 perguntas abertas: o que ajudou, o que atrapalhou, o que mudaria).

## 4. Teste de GPS (pré-requisito)

1. Iniciar uma rota de teste e bloquear a tela por 30 minutos em deslocamento.
2. Encerrar a rota e abrir a comparação no painel.
3. Aceite: trajeto contínuo no mapa (sem buracos maiores que 2 min) e `ping_count` compatível (~120 pontos em 30 min).
4. Se falhar: conferir permissão "Permitir o tempo todo" e a otimização de bateria do fabricante.

## 5. Critérios de sucesso

- [ ] ≥ 3 rotas reais completas, com rastro e eventos
- [ ] Nenhuma baixa perdida na conferência com o controle da empresa
- [ ] Indicadores do item 3 coletados para todas as rotas
- [ ] Termo de aceite assinado pelo responsável da empresa

## 6. Registro

Para cada dia, anotar: data, rota, motorista (iniciais), número de paradas, problemas encontrados e decisões tomadas. Ajustes vindos do campo (tamanho de botão, contraste ao sol, bateria) viram Issues no repositório.
