# Distribuição do APK dos coordenadores

Esta orientação vale para a branch `feature/redesign-coordenadores-20261031`. Não se aplica à `main`.

## Comando padrão

Na pasta do projeto:

```powershell
npm run android:apk
```

O comando padrão **sempre compila a variante de homologação dos coordenadores**, com Firebase real, tela de entrada (ACS direto ou coordenador com e-mail e senha) e as regras de prazo já existentes no projeto Spark. Ele não compila o APK de emuladores nem o debug convencional.

A saída para enviar aos coordenadores será copiada automaticamente para:

```text
android/app/build/outputs/apk/distribuicao/Sismorcego-Coordenadores.apk
```

O APK original também permanece em `android/app/build/outputs/apk/homologation/app-homologation.apk`. A compilação exibe o SHA-256 do arquivo de distribuição.

`npm run android:apk:homologacao` é um nome alternativo para o mesmo build. Nenhuma credencial é compilada no APK: o build não depende mais do arquivo `evaluation-credentials.properties`. Passe o e-mail e a senha da conta de coordenador somente aos coordenadores, por um canal privado.

## Somente para desenvolvimento

- `npm run android:apk:debug`: gera um aplicativo **Sismorcego (DEV)**, sem o Firebase real habilitado para avaliação.
- `npm run android:apk:emulador`: gera **Sismorcego (TESTE LOCAL)**, conectado apenas aos emuladores de Auth/Firestore de desenvolvimento. Essa variante não pode acessar o Firebase real e pode exibir indisponibilidade de serviços quando instalada num celular comum.

**Nunca distribuir** `app-debug.apk` nem `app-emulator.apk`. Somente `Sismorcego-Coordenadores.apk`.

## Funcionamento esperado para quem recebe

1. Instalar e abrir o APK. Depois da splash, escolher **Sou ACS** (entra direto, sem senha) ou **Sou coordenador** (e-mail e senha da conta de coordenação). Não há QR, código nem ativação por aparelho.
2. Com acesso à internet, o aplicativo autentica o perfil escolhido e valida a avaliação pelo Firebase real.
3. A avaliação tem configuração global `configuracoes/avaliacaoCoordenadores` no Firestore. `enabled: false` suspende e `expiresAt` prorroga sem reinstalação.
4. Falha de conexão com Firebase/expiração/suspensão impedem acesso ao conteúdo protegido até a próxima verificação. A tela de bloqueio não indica, por si só, falha do Wi-Fi.

## Verificação da versão

Pacote de distribuição: `com.sismorcego.homologacao`. Nome na tela: **Sismorcego**. O APK de teste utiliza o pacote `com.sismorcego.emulador` e tem nome claramente diferente.

O APK de homologação é assinado para distribuição **interna de avaliação**, não para publicação na Google Play.

Os ajustes de PDFium para páginas de 16 KB estão nesta branch; a branch `main` ainda não incorporou essa correção.
