# Instalação

## Instalar o aplicativo (Android)

1. No celular, abra a [última Release](https://github.com/kevin-elazar/AthonisMobile/releases/latest) (ou leia o QR Code do pôster) e baixe o arquivo `.apk`.
2. Permita a instalação de "fontes desconhecidas" para o navegador, quando o Android pedir.
3. Abra **Athonis Entregas** e entre com o e-mail e a senha que o administrador criou no painel (**Motoristas → Acesso ao aplicativo**).
4. Na primeira rota, leia a tela de consentimento e, no diálogo do sistema, escolha **Permitir o tempo todo** para o trajeto continuar registrado com a tela apagada.
5. Recomendado: em **Configurações → Bateria**, tire o Athonis da otimização de bateria (alguns fabricantes encerram o rastreamento em segundo plano).

## Rodar localmente (desenvolvimento)

Pré-requisitos: Node 22, Docker (para o PostgreSQL) e, para o app no celular, Android Studio ou um aparelho com o dev client.

### API

```bash
git clone https://github.com/kevin-elazar/AthonisBackend.git && cd AthonisBackend
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL local
cp .env.example .env                              # ajuste se precisar
npm ci
npm run start:dev                                 # http://localhost:8080 (Swagger em /api)
node scripts/seed-driver-demo.js                  # empresa, admin, motorista e uma rota para hoje
```

### Painel

```bash
git clone https://github.com/kevin-elazar/athonis-front-end.git && cd athonis-front-end
cp .env.example .env.local                        # NEXT_PUBLIC_API_URL=http://localhost:8080
npm ci
npm run dev                                       # http://localhost:3000
```

### Aplicativo

```bash
git clone https://github.com/kevin-elazar/AthonisMobile.git && cd AthonisMobile
npm ci
npm run web        # telas no navegador (sem GPS; armazenamento em localStorage)
npm run android    # emulador ou aparelho com o dev client
```

No emulador Android, a API local é alcançada em `http://10.0.2.2:8080` (padrão do app). Para um aparelho na rede, defina `EXPO_PUBLIC_API_URL=http://<ip-da-máquina>:8080` no `.env`.

O rastreamento em segundo plano não funciona no Expo Go: gere o dev client com `npx eas-cli@latest build --profile development --platform android`.

## Verificações

| Comando | Repositório |
|---|---|
| `npm run test:all` | API (unitários + e2e; exige o PostgreSQL local) |
| `npm run test:cov` | Painel |
| `npx jest` · `npx tsc --noEmit` · `npx expo lint` | App |
