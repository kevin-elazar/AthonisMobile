# Ambiente Android — guia de configuração

> Verificado nesta máquina em 08/10/2026. O SDK **já está instalado**; o que falta é o Windows saber onde ele está.

## 1. O que já existe

| Item | Situação | Onde |
|---|---|---|
| Android Studio | Instalado (2025.1.2) | `C:\Program Files\Android\Android Studio` |
| Android SDK | Instalado | `C:\Android` |
| SDK Platform 36 (Android 16) | Instalado — é a que o Expo exige | `C:\Android\platforms\android-36` |
| Build-Tools 36.0.0 | Instalado | `C:\Android\build-tools` |
| Platform-Tools (`adb` 36.0.0) | Instalado | `C:\Android\platform-tools` |
| Emulador + driver de aceleração | Instalado | `C:\Android\emulator` |
| Imagem de sistema Android 36 (Play Store, x86_64) | Instalada | `C:\Android\system-images\android-36` |
| Emuladores criados | `Pixel_9`, `Medium_Phone`, `Small_Phone` | `%USERPROFILE%\.android\avd` |
| Virtualização | Ativa | — |
| Espaço em disco | ~87 GB livres em `C:` | — |

## 2. O que está errado

| Problema | Efeito |
|---|---|
| `ANDROID_HOME` (variável de sistema) aponta para `%LOCALAPPDATA%\Android\Sdk`, pasta que não existe | Expo e Gradle não acham o SDK |
| O `Path` tem quatro entradas para essa mesma pasta inexistente | `adb` e `emulator` não são reconhecidos no terminal |
| JDK ativo é o 21 (`JAVA_HOME`); o Expo pede o **17** | Só afeta o build local (Fase 4 do `SPEC.md`) |
| `cmdline-tools` (`sdkmanager`) não instalado | Opcional; só faz falta para gerenciar o SDK pelo terminal |

## 3. Correção das variáveis (obrigatório)

> **Já aplicado nesta máquina em 08/10/2026**: `ANDROID_HOME` de usuário = `C:\Android`, e `C:\Android\platform-tools` e `C:\Android\emulator` no `Path` de usuário. Falta só reabrir os programas. Os comandos abaixo ficam como referência para outra máquina.

Abra o **PowerShell** (não precisa ser administrador) e rode os dois comandos. Eles criam variáveis **de usuário**, que têm prioridade sobre a de sistema que está errada.

```powershell
[Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Android', 'User')
```

```powershell
$p = [Environment]::GetEnvironmentVariable('Path', 'User'); [Environment]::SetEnvironmentVariable('Path', "$p;C:\Android\platform-tools;C:\Android\emulator", 'User')
```

Depois **feche e reabra** o terminal, o VS Code e o Claude — programas abertos continuam com as variáveis antigas.

Limpeza opcional (precisa de administrador): em *Painel de Controle → Sistema → Configurações avançadas → Variáveis de Ambiente*, na parte **Variáveis do sistema**, corrija `ANDROID_HOME` para `C:\Android` e apague do `Path` as quatro entradas que começam com `C:\Users\Kevin Chedid\AppData\Local\Android\Sdk`.

## 4. Conferência

```powershell
$env:ANDROID_HOME
```

Deve mostrar `C:\Android`.

```powershell
adb --version
```

Deve mostrar `Android Debug Bridge version 1.0.41`.

```powershell
emulator -list-avds
```

Deve listar `Medium_Phone`, `Pixel_9` e `Small_Phone`.

## 5. Abrir o emulador

```powershell
emulator -avd Pixel_9
```

Com o emulador aberto, em outro terminal:

```powershell
adb devices
```

Deve aparecer uma linha `emulator-5554   device`. Se aparecer `offline`, espere o Android terminar de iniciar.

Alternativa pela interface: Android Studio → *More Actions* → *Virtual Device Manager* → botão ▶ do `Pixel_9`.

## 6. Celular físico (recomendado para o rastreamento)

O GPS em segundo plano só se comporta de verdade em aparelho real.

1. No celular: *Configurações → Sobre o telefone* → toque 7 vezes em **Número da versão**.
2. *Configurações → Sistema → Opções do desenvolvedor* → ative **Depuração USB**.
3. Conecte o cabo e aceite o aviso "Permitir depuração USB?".
4. `adb devices` deve listar o aparelho como `device`.

Para o Expo Go, celular e computador precisam estar na mesma rede Wi-Fi.

## 7. JDK 17 (só para build local — Fase 4)

Não é necessário para as Fases 2 e 3 (Expo Go) nem para build na nuvem (EAS Build).

Instale o 17 **ao lado** do 21, sem trocar o `JAVA_HOME` global — o 21 continua valendo para os projetos Maven e Ant:

```powershell
winget install Microsoft.OpenJDK.17
```

Depois aponte só o Gradle para ele, criando o arquivo `%USERPROFILE%\.gradle\gradle.properties` com a linha abaixo (ajuste o número da versão para a pasta que o instalador criar em `C:\Program Files\Microsoft\`):

```properties
org.gradle.java.home=C:\\Program Files\\Microsoft\\jdk-17.0.x.y-hotspot
```

Atenção: esse arquivo vale para **todos** os projetos Gradle do seu usuário. Se houver outro projeto Gradle que precise do JDK 21, prefira definir `JAVA_HOME` só no terminal, antes do build:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.x.y-hotspot'
```

## 8. Command-line Tools (opcional)

Android Studio → *More Actions* → *SDK Manager* → aba **SDK Tools** → marque **Android SDK Command-line Tools (latest)** → *Apply*.

Na mesma tela, confira se o campo *Android SDK Location* mostra `C:\Android`.

## 9. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `adb` não é reconhecido | Terminal aberto antes da correção | Feche e reabra o terminal |
| `SDK location not found` no build | `ANDROID_HOME` antigo | Repita a seção 3 e reabra o terminal |
| Emulador muito lento ou não abre | Aceleração desligada | SDK Manager → SDK Tools → *Android Emulator hypervisor driver* |
| App no emulador não alcança o backend | `localhost` do emulador é o próprio emulador | Use `http://10.0.2.2:8080` no emulador; no celular físico, o IP da máquina na rede |
| `Unsupported class file major version` | Gradle rodando com JDK errado | Seção 7 |
