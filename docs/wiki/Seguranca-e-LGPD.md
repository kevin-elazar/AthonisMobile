# Segurança e LGPD

## Dados pessoais tratados

| Titular | Dados | Finalidade |
|---|---|---|
| Usuário do painel | nome, e-mail, senha (hash) | acesso |
| Cliente da empresa | nome/razão social, CPF/CNPJ, telefone, e-mail, endereço | entrega |
| Motorista | nome, CPF, telefone, CNH (número, categoria, validade), e-mail de acesso | escala e acesso ao app |
| Motorista (em rota) | **localização** a cada 15 s / 50 m, eventos de entrega, observações | acompanhamento e análise da execução |

A empresa contratante é a **controladora**; o Athonis trata os dados em nome dela. Base legal: execução de contrato e legítimo interesse na gestão das entregas (LGPD, art. 7º, V e IX). A localização exige, além disso, consentimento informado no app.

## Localização: princípios aplicados

- **Necessidade:** só é lida com uma rota em andamento. Liga em "Iniciar rota", desliga em "Encerrar"; ao abrir o app sem rota ativa, o rastreamento é desligado (`reconcileTracking`).
- **Transparência:** tela de consentimento antes do diálogo do sistema (o que, quando, para quê, que recusar não impede a rota) e link para a política. No Android, notificação fixa enquanto registra.
- **Registro do consentimento:** decisão gravada com data e versão do texto; mudar o texto pede consentimento de novo. O motorista revê a decisão em "Minha conta" e revoga pelas permissões do aparelho.
- **Livre escolha:** recusar não bloqueia o trabalho; a rota segue sem trajeto medido.

**Política de privacidade pública:** `/privacidade` no painel (link no rodapé, na tela de consentimento e em "Minha conta"). Ela informa dados, finalidades, compartilhamento (Google Maps Platform, ViaCEP, Sentry, hospedagem), retenção, segurança, direitos do titular (art. 18) e o contato.

## Controles de segurança

| Controle | Implementação |
|---|---|
| Transporte | HTTPS em tudo (Let's Encrypt via Traefik), HSTS de 1 ano, redirecionamento HTTP → HTTPS. O Android recusa HTTP puro no build de produção |
| Senhas | bcrypt; nunca retornadas pela API |
| Sessão do app | JWT de 1 h + refresh token de 30 dias rotativo, guardado no SecureStore (Keystore/Keychain) e salvo no servidor só como hash SHA-256; logout revoga |
| Sessão do painel | Token em cookie httpOnly, `SameSite=Lax`, `Secure` em produção; chamadas pela API feitas no servidor (Server Actions) |
| Autorização | Papéis `admin`, `user` e `driver`; `/driver/*` filtra pelo motorista do token (o app nunca diz de quem é a rota); `driver` recebe 403 nos endpoints administrativos |
| Multiempresa | `id_company` em todas as tabelas, sempre vindo do token |
| Cabeçalhos | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `poweredByHeader` desligado no painel |
| Superfície | `/metrics` bloqueado de fora; banco sem porta pública; containers com usuário sem privilégio |
| Segredos | Gerados no servidor, fora do git e das imagens; tokens de CI como secrets do GitHub; o app não carrega chave do Google |
| Deploy | Sem SSH; runner com permissão mínima ([[ADR-07|Decisoes-de-Arquitetura]]) |
| Erros | Sentry sem dados pessoais por padrão (sem IP, cookies ou corpo de requisição) |
| Retenção | Backups diários mantidos por 14 dias; exclusão a pedido da empresa ao fim do contrato |

## Riscos conhecidos

- **Acesso root de terceiro à VPS:** o servidor foi cedido por um colega, que tem acesso administrativo. Está declarado na política, no termo do piloto e no [[ADR-06|Decisoes-de-Arquitetura]].
- **Domínio de terceiro:** o sistema usa `athonis.seletohub.cloud`, subdomínio do domínio de quem cede a VPS (o sslip.io usado antes era bloqueado por filtros corporativos). Se o domínio deixar de existir, é preciso trocar o DNS, o servidor e gerar novo APK.
- **Repositório público com histórico antigo:** um arquivo SQLite de desenvolvimento ficou no histórico do backend; segundo o autor, contém apenas dados de teste.
