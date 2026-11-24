# Manual de uso

Guia para a equipe da empresa usar o Athonis no dia a dia: o **painel** (escritório) e o **aplicativo** (motorista). Entregue ao parceiro junto com o acesso, como parte da transferência da solução.

**Endereços**
- Painel: https://app.athonis.seletohub.cloud
- Aplicativo (Android): [baixar o APK](https://github.com/kevin-elazar/AthonisMobile/releases/latest)
- Política de privacidade: https://app.athonis.seletohub.cloud/privacidade

---

## Parte 1 — Painel (administrador / logística)

### Primeiro acesso
1. Entre com o e-mail e a senha de administrador recebidos.
2. Em **Configurações**, confira os dados da empresa, o **endereço do depósito** (origem e destino das rotas), o horário de expediente, o custo por km/hora e o tempo médio por parada. Esses valores alimentam a otimização.

### Cadastros
- **Clientes:** nome, CPF/CNPJ, telefone e endereço. Digite o CEP e o endereço é preenchido.
- **Motoristas:** só o nome é obrigatório. Informe categoria e validade da CNH: o painel avisa quando a CNH vence ou não permite o veículo.
- **Veículos:** nome, placa, tipo e capacidade.
- **Pedidos:** um por entrega, com data, janela de horário (opcional) e endereço (vem do cliente). Para muitos pedidos, use **Pedidos → Importar** com a planilha modelo; as linhas recusadas voltam num arquivo com o motivo.

### Liberar o aplicativo para um motorista
**Motoristas →** menu do motorista **→ Acesso ao aplicativo →** informe o e-mail e uma senha (mínimo de 6 caracteres) **→ Criar acesso**. Passe os dados ao motorista. No mesmo lugar dá para trocar a senha ou **desligar o acesso**.

### Montar as rotas do dia
1. **Rotas → Gerar rota:** selecione os pedidos do dia e confirme.
2. O sistema calcula as rotas pelo Google (ordem das paradas e horário previsto). Pedidos sem endereço válido ficam de fora, com o motivo.
3. Em cada rota, escolha **motorista e veículo**. A rota aparece no aplicativo dele.
4. Rota cancelada pelo motorista: as paradas não feitas voltam para planejamento. Use **Duplicar** para refazer a rota em outro dia.

### Acompanhar
- **Acompanhamento → Ao vivo:** posição de cada motorista, próxima parada e há quanto tempo veio a última posição ("Sem sinal há…" indica que o celular está sem internet; os dados sobem quando a conexão volta).
- **Acompanhamento → Percursos:** o trajeto real de uma rota no mapa.

### Analisar
**Indicadores → Execução em campo** (7, 30 ou 90 dias): conclusão, pontualidade, atraso médio, ocorrências por motivo, desempenho por motorista e por região/horário. Clique numa rota para ver a **comparação planejado × executado** parada a parada.

---

## Parte 2 — Aplicativo (motorista)

### Instalar
1. No celular Android, abra o link do APK e baixe o arquivo.
2. Permita "instalar de fontes desconhecidas" quando o Android pedir.
3. Entre com o e-mail e a senha que o escritório criou.
4. Recomendado: em **Configurações do Android → Bateria**, tire o "Athonis Entregas" da otimização de bateria.

### No dia
1. **Rotas de hoje:** toque na rota.
2. **Iniciar rota.** Na primeira vez aparece a explicação sobre localização: toque em **Permitir registro do trajeto** e, na tela do sistema, **Permitir o tempo todo**. (Se recusar, a rota funciona normalmente, só sem trajeto.)
3. Em cada parada: **Navegar** (abre o Google Maps) → **Cheguei ao local** → **Entregue** (observação opcional) ou **Não foi possível entregar** (escolha o motivo).
4. No fim: **Encerrar rota**. O resumo mostra entregas, ocorrências e duração.

### Sem sinal
Pode continuar normalmente: tudo fica guardado no celular e é enviado quando a internet voltar. O selo no topo mostra **Sincronizado** ou **N pendentes**. Antes de sair do app (**Minha conta → Sair**), conecte-se para enviar o que ficou pendente.

### Privacidade
A localização só é registrada com uma rota em andamento (aparece uma notificação fixa enquanto isso). Em **Minha conta → Privacidade** dá para rever o consentimento, abrir as permissões do celular e ler a política.

---

## Dúvidas e problemas
- Esqueceu a senha do app: o administrador troca em **Acesso ao aplicativo**.
- Rota não aparece no app: confira no painel se a rota é de hoje e se tem o motorista certo; no app, puxe a lista para baixo para atualizar.
- Erro ou sugestão: abra uma issue em https://github.com/kevin-elazar/AthonisMobile/issues ou fale com o responsável pelo projeto (kevin.azal@catolicasc.edu.br).
