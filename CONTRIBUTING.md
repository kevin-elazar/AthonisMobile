# Como contribuir

1. Abra uma issue (bug ou melhoria) descrevendo o problema — há modelos em *New issue*.
2. Crie uma branch a partir de `desenvMobile`: `feat/<assunto>` ou `fix/<assunto>`.
3. Rode localmente antes de abrir o PR:
   ```bash
   npx expo lint
   npx tsc --noEmit
   npx jest
   ```
4. Abra o Pull Request para `desenvMobile` preenchendo o template. O CI (lint, tipos, testes e
   SonarCloud) precisa ficar verde e o PR precisa de uma revisão aprovada.
5. Mensagens de commit no formato `tipo(escopo): descrição` (ex.: `fix(sync): ...`).

Regras do app: a tela nunca lê da rede, lê do banco local (`src/services/store`); toda ação do
motorista passa pela fila (`src/features/routes/actions.ts`) com um `client_event_id`. Mudou algo
nativo (permissão, biblioteca com código nativo)? Precisa de um novo *development build* e de
um APK novo (tag `v*`). Ver [Fila Offline](https://github.com/kevin-elazar/AthonisMobile/wiki/Fila-Offline).
