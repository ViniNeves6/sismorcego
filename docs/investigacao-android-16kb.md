# Sismorcego no Android com páginas de 16 KB

Investigação da branch `feature/redesign-coordenadores-20261031`. O checkout estava em `917bcaf`, um commit à frente de `36ebd88`. A análise usa os APKs existentes de homologação e emulador. A execução em AVD usou o APK de emulador com Auth e Firestore locais e um registro fictício. Os APKs contêm as mesmas bibliotecas nativas e o mesmo bundle Hermes, cujo SHA-256 é `81787a397a74f011bd39ba0a022e61628bddd1d92e397b25e0113e73c99b48a7`.

## Diagnóstico

**O APK de homologação tem uma incompatibilidade confirmada com páginas de 16 KB.** O único ELF que falhou foi `libpdfiumandroid.so`, de `io.legere:pdfiumandroid:1.0.24`, usado pela prévia de fichas em PDF. Os APKs passaram na verificação de alinhamento ZIP. Em Android com páginas de 16 KB, o sistema pode executar o APK com a camada de compatibilidade e mostrar um aviso. [Documentação Android sobre páginas de 16 KB](https://developer.android.com/guide/practices/page-sizes).

**O crash histórico de renderização tem uma assinatura diferente.** Em 6 de novembro, às 22:10:14 e às 22:10:37 no relógio do log, o processo `com.sismorcego.emulador` terminou na thread principal com `java.lang.StackOverflowError: stack size 8176KB`. A pilha passa pelo desenho de SVG e pelo despacho do evento de layout via Fabric e Reanimated. Os dois rastros do app não contêm `dlopen`, `UnsatisfiedLinkError` ou sinal fatal do linker. O mesmo log registra `DeadSystemException` horas antes, em processos do sistema. [Log histórico, primeira falha](../android/app/build/evaluation-auto-qa/android-crash-initial.log).

```text
SvgView.onDraw → RenderableView.draw → VirtualView.setClientRect
  → FabricEventDispatcher.dispatchEvent → Reanimated NodesManager
  → OnLayoutEvent.getEventData → Arguments.createMap → HybridData
```

`VirtualView.setClientRect` emite o evento de layout durante o desenho. O `NodesManager` pode tratá-lo imediatamente na thread de interface. A cadeia torna plausível investigar o despacho síncrono de layout e a profundidade da árvore de views. A pilha disponível não identifica qual SVG estava sendo desenhado nem demonstra uma chamada recursiva específica. Há um caso upstream de reentrada de layout de SVG no Reanimated, em versões diferentes e com ANR, que serve como pista para instrumentação. [SVG `VirtualView`](../node_modules/react-native-svg/android/src/main/java/com/horcrux/svg/VirtualView.java), [Reanimated `NodesManager`](../node_modules/react-native-reanimated/android/src/main/java/com/swmansion/reanimated/NodesManager.java), [Reanimated #10280](https://github.com/software-mansion/react-native-reanimated/issues/10280).

## ELF e empacotamento

Usei `llvm-readelf -lW` nos binários extraídos e `zipalign -c -P 16 -v 4` nos APKs existentes. O primeiro verifica os segmentos que o linker carrega. O segundo verifica a posição dos dados no ZIP.

| Verificação | Homologação e emulador |
| --- | --- |
| ABIs empacotadas | `arm64-v8a` e `x86_64`, 21 bibliotecas por ABI |
| ZIP | `zipalign` retornou 0 nos dois APKs. Todos os `.so` estão sem compressão em offsets múltiplos de 16.384 |
| ELF | 20 bibliotecas por ABI passam, com `PT_LOAD.p_align = 0x4000` e congruência de offset e endereço virtual em 16 KB |
| Exceção | Os três segmentos `PT_LOAD` de `libpdfiumandroid.so` têm `p_align = 0x1000` nas duas ABIs |
| RELRO | Nenhum ELF apresentou fim de `GNU_RELRO` desalinhado com dados graváveis no restante do mesmo segmento `LOAD` |
| Identidade | Todas as bibliotecas nativas têm SHA-256 idêntico entre os APKs |

O binário desalinhado é idêntico ao fornecido no AAR `io.legere:pdfiumandroid:1.0.24`. A dependência está em `react-native-pdf@6.7.7`, junto de `AndroidPdfViewer:4.0.1`. O outro binário do AAR, `libpdfium.so`, passa. Também passam React Native, Hermes, Reanimated, Worklets, o código nativo gerado para SVG e as bibliotecas C++ e JNI incluídas. [Relatório por biblioteca](../android/app/build/android-16kb-investigacao/elf-apk.json), [verificação RELRO](../android/app/build/android-16kb-investigacao/relro-apk-candidate.json), [zipalign da homologação](../android/app/build/android-16kb-investigacao/zipalign-homologation.log), [zipalign do emulador](../android/app/build/android-16kb-investigacao/zipalign-emulator.log), [dependência declarada](../node_modules/react-native-pdf/android/build.gradle).

| Componente | Versão | Relação com o diagnóstico |
| --- | --- | --- |
| React Native, Hermes e Fabric | RN `0.81.1`, Hermes e Nova Arquitetura habilitados | Os ELFs correspondentes passam. Fabric está no rastro histórico de layout |
| SVG, Reanimated, Worklets | `15.12.1`, `4.1.0`, `0.5.0` | Os ELFs passam. SVG e Reanimated aparecem no rastro Java histórico |
| Android Gradle Plugin e Gradle | `8.11.0` e `8.14.3` | A versão do AGP já supera o mínimo recomendado de `8.5.1` e o ZIP passou |
| NDK, Build Tools e SDK | NDK `27.1.12297006`, Build Tools `36.0.0`, min SDK 24, compile e target SDK 36 | O NDK r27 permite gerar binários com alinhamento adequado. O r28 o aplica por padrão. Mudar o NDK do app não altera o ELF pré-compilado do AAR |

O React Native anunciou suporte a 16 KB na série 0.77. Os resultados acima se referem aos binários de fato entregues por este projeto. [React Native 0.77](https://reactnative.dev/blog/2025/01/21/version-0.77), [requisitos de AGP, NDK e bibliotecas pré-compiladas](https://developer.android.com/guide/practices/page-sizes).

### Artefatos inspecionados

| APK | SHA-256 |
| --- | --- |
| `app-homologation.apk` | `49e440ed81a2f5aafca6405e788c11729b2cfef7dc520b1da9fb20012a05fcf7` |
| `app-emulator.apk` | `3c4132bb4e2a6581c92e0b71086892b9fc62c8cdfda14dc696324817377d855b` |

## Reprodução

### Android 17 / API 37, 16 KB, imagem Play Store

Ambiente x86_64, `getconf PAGE_SIZE = 16384`, fingerprint `google/sdk_gphone16k_x86_64/emu64xa16k:17/CP21.260330.005/15181570:user/dev-keys`, Emulator 36.5.11 com renderizador SwiftShader. A instalação retornou `Success`. O Android exibiu **Android App Compatibility**, com **ELF alignment check failed** e **LOAD segment not aligned** para `libpdfiumandroid.so`. O diálogo atribuiu “Unknown error” a outros arquivos, cujos segmentos foram verificados separadamente na auditoria. [Ambiente](../android/app/build/android-16kb-investigacao/37-r04-16k/default-environment.json), [aviso do sistema](../android/app/build/android-16kb-investigacao/37-r04-16k/default-visible.png).

Após fechar o aviso, a autenticação automática chegou ao bloqueio esperado de avaliação suspensa. A reativação da política fictícia liberou o primeiro passo do guia e Registros. O fluxo abriu Painel, mapa com tiles, marcador e calor, opções Dia e Mês, Alertas, formulário, teclado com retorno da barra ao pressionar Voltar, detalhes e a prévia de PDF com a ficha de uma página renderizada. Em uma reabertura, dispensei o aviso recorrente no AVD para capturar a splash violeta e a chegada a Registros. Houve mensagens de frames descartados do `Choreographer` no app e em processos do emulador. As capturas confirmam a abertura e a saída da splash e os estados finais das transições. Elas não medem a fluidez das animações. Os buffers de crash do app ficaram vazios nessas rodadas. [Splash](../android/app/build/android-16kb-investigacao/37-r04-16k/animated-splash-02.png), [reabertura](../android/app/build/android-16kb-investigacao/37-r04-16k/after-comparison-startup.png), [guia](../android/app/build/android-16kb-investigacao/37-r04-16k/r04-active-current.png), [mapa](../android/app/build/android-16kb-investigacao/37-r04-16k/03-map.png), [formulário após Voltar](../android/app/build/android-16kb-investigacao/37-r04-16k/09-keyboard-closed.png), [PDF](../android/app/build/android-16kb-investigacao/37-r04-16k/11-pdf-preview.png), [log](../android/app/build/android-16kb-investigacao/37-r04-16k/pdf-r04-app.log).

### Android 17 / API 37, segunda imagem com páginas de 16 KB

A imagem Google APIs `CE2A.260420.051.A3` (build `16571990`, x86_64, `userdebug`) com Emulator 37.2.13 repetiu o aviso e chegou a Registros. Nessa imagem, um programa de diagnóstico separado tentou carregar diretamente o mesmo binário do APK com `dlopen`. O linker recusou `1.0.24`, pois o alinhamento de 4.096 bytes é menor que a página de 16.384 bytes. Com as propriedades de teste `bionic.linker.16kb.app_compat.enabled=fatal` e `pm.16kb.app_compat.disabled=true`, o processo de diagnóstico foi abortado com código 134. `1.0.32` carregou com código 0 nos dois cenários. O APK do app permaneceu intacto e a candidata ainda não foi validada integrada ao visualizador. [Ambiente](../android/app/build/android-16kb-investigacao/37-r08-16k/r08-default-environment.json), [guia](../android/app/build/android-16kb-investigacao/37-r08-16k/r08-default-ready.png), [teste do linker](../android/app/build/android-16kb-investigacao/37-r08-16k/linker-probe.json).

As propriedades globais, por si, deixaram a compatibilidade do pacote ligada nessa imagem. A instalação retornou `Success` e o gráfico SVG Dia/Mês, o mapa e a prévia em PDF renderizaram. Depois desativei a opção **Run app with page size compat mode** no menu do aplicativo do AVD. O `dumpsys package` passou de `pageSizeCompat=4` para `20`, correspondendo ao bit de desalinhamento ELF mais o bit de compatibilidade desativada pelo usuário. O app abriu Registros. Ao escolher **Ficha completa**, o processo do Sismorcego encerrou com `SIGABRT` na `Thread-5`. O linker identificou `base.apk!/lib/x86_64/libpdfiumandroid.so` com alinhamento 4.096 menor que a página 16.384. Essa sequência estabelece que a instalação e a abertura do app podem funcionar e o carregamento tardio do PDF pode falhar. [Flags do AOSP](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/content/pm/ApplicationInfo.java), [gráfico](../android/app/build/android-16kb-investigacao/37-r08-16k/screen-chart-month.png), [compatibilidade desligada](../android/app/build/android-16kb-investigacao/37-r08-16k/compat-disabled.png), [Registros no modo estrito](../android/app/build/android-16kb-investigacao/37-r08-16k/strict-app-settled.png), [crash ao abrir PDF](../android/app/build/android-16kb-investigacao/37-r08-16k/strict-pdf-crash.log).

### Android 17 / API 37, 4 KB no mesmo build

Na imagem Google APIs com `getconf PAGE_SIZE = 4096`, o fingerprint traz o mesmo build `CE2A.260420.051.A3/16571990` e foi usado o mesmo Emulator 37.2.13 e GPU SwiftShader. A instalação e a autenticação automática chegaram ao guia sem o aviso de 16 KB. Painel, mapa com calor e marcador, seleção Dia/Mês, Alertas, formulário e PDF abriram. O buffer de crash ficou vazio. A partida passou pela splash do Android, um intervalo de tela clara e pela splash violeta do app antes da interface funcional. A observação foi qualitativa, sem comparar tempos de frames ou atribuir a espera a uma biblioteca. [Ambiente](../android/app/build/android-16kb-investigacao/37-r08-4k/comparison-environment.json), [splash violeta](../android/app/build/android-16kb-investigacao/37-r08-4k/animated-splash-02.png), [guia](../android/app/build/android-16kb-investigacao/37-r08-4k/stable-now.png), [Painel e mapa](../android/app/build/android-16kb-investigacao/37-r08-4k/screen-chart-month.png), [PDF](../android/app/build/android-16kb-investigacao/37-r08-4k/pdf-rendered.png), [log](../android/app/build/android-16kb-investigacao/37-r08-4k/final-comparison-app.log).

### Android 15 / API 35, 4 KB

O APK de emulador instalou na imagem Google APIs x86_64 `AE3A.240806.043/12960925` com Emulator 36.5.11 e `getconf PAGE_SIZE = 4096`. A execução chegou à splash violeta, ao guia após autenticação automática, a Registros, Painel, mapa, opções Dia/Mês, Alertas, formulário e PDF. O buffer de crash ficou vazio. A rodada anterior de `36ebd88` na homologação já havia confirmado Registros, Painel, Alertas, suspensão, expiração e retomada em API 35. [Ambiente atual](../android/app/build/android-16kb-investigacao/35-4k/api35-environment.json), [splash](../android/app/build/android-16kb-investigacao/35-4k/animated-splash-03.png), [Painel](../android/app/build/android-16kb-investigacao/35-4k/screen-chart-month.png), [PDF](../android/app/build/android-16kb-investigacao/35-4k/pdf-rendered.png), [log](../android/app/build/android-16kb-investigacao/35-4k/final-api35-app.log), [validação anterior](avaliacao-coordenadores.md#testes-e-evidências).

### Galaxy S25

O Galaxy S25 (`SM-S931B`) consultado em modo somente leitura usa API 36, ARM64 e páginas de **4.096 bytes**. O SHA-256 do APK instalado, `b906aea2625bd8838def1c80afab559add02cba7ef7b7c81cfbc5e6085c26081`, coincide com a homologação anterior, de `36ebd88`, validada pelo usuário no aparelho. A execução dos APKs atuais se restringiu aos AVDs. [Hash da homologação anterior](../android/app/build/evaluation-spark-qa/apk-verification.json).

## Gravidade e distribuição

- **Android 15 e posteriores, em dispositivos com 16 KB.** A incompatibilidade ELF é reproduzível e afeta as duas ABIs. No perfil com compatibilidade habilitada, a instalação e a prévia do PDF funcionaram, com aviso na abertura. No perfil estrito do API 37, a instalação e Registros funcionaram e a prévia encerrou o processo. O resultado depende da configuração de compatibilidade do sistema. Dispositivos com páginas de 4 KB, como o S25 verificado, não exigem esse alinhamento de 16 KB.
- **Crash visual histórico.** É grave quando ocorre, pois encerra o app, mas a execução atual completou os fluxos no mesmo fingerprint com 16 KB. A abrangência, a condição de disparo e a associação do crash a uma imagem, versão do app ou estado de renderização continuam indeterminadas.
- **Google Play.** Desde 1º de novembro de 2025, novos apps e atualizações enviados ao Google Play que têm como alvo Android 15 ou superior precisam suportar 16 KB. Esse requisito de publicação é separado da instalação direta do APK, em que o comportamento depende do dispositivo e do modo de compatibilidade. [Política e compatibilidade Android](https://developer.android.com/guide/practices/page-sizes).

**Recomendo corrigir o PDFium antes de distribuir para um grupo de coordenadores cujos aparelhos ainda não foram verificados.** Um piloto restrito a aparelhos com páginas de 4 KB, após teste do APK exato que será entregue, tem risco menor para este defeito. O desalinhamento afeta dispositivos de 16 KB e não se limita ao emulador. O crash histórico de SVG segue como investigação separada.

## Plano após autorização

1. **Corrigir a dependência do PDF.** Testar uma restrição de dependência em `android/app/build.gradle` para resolver apenas `io.legere:pdfiumandroid` para `1.0.32` nos APKs. O AAR candidato já passou em `llvm-readelf` nas duas ABIs. O `libpdfium.so` tem os mesmos bytes de `1.0.24` e a biblioteca JNI `libpdfiumandroid.so` passou a ter segmentos `0x4000`. A série `7.x` de `react-native-pdf` documenta suporte a 16 KB e usa essa linha de Pdfium. Avaliar uma atualização localizada do pacote caso a resolução Gradle isolada falhe no teste de compatibilidade Java/JNI. [Auditoria do AAR candidato](../android/app/build/android-16kb-investigacao/pdfium-candidate.json), [releases de react-native-pdf](https://github.com/wonday/react-native-pdf/releases).
2. **Validar o APK recompilado.** Repetir `llvm-readelf` e `zipalign` nas duas ABIs e confirmar instalação e PDF em API 35/4 KB e API 37/16 KB com compatibilidade desativada. Testar ficha completa, opções de privacidade, fechar e reabrir, zoom e retorno do Android. A troca afeta APIs Java/JNI e o ciclo de vida do visualizador. Um teste do APK recompilado em ARM64/4 KB deve cobrir a regressão no Galaxy S25. A alteração proposta pode ser feita sem mudar autenticação, telas ou dados.
3. **Investigar SVG se a falha voltar.** Capturar `logcat` desde a inicialização até a primeira tela, registrar qual componente SVG dispara `onLayout` e repetir com a mesma imagem e GPU em 4 e 16 KB. Isolar o menor fluxo que reproduza entre splash, ícones da navegação e gráfico. Só então avaliar uma mudança no componente ou uma versão compatível de SVG/Reanimated. Atualizações desses pacotes podem afetar transições, gestos, layout e movimento reduzido.
4. **Verificar AAB se houver publicação na Play.** Inspecionar o alinhamento declarado pelo `bundletool` e repetir os checks nos APKs gerados do bundle. Os dois artefatos analisados aqui são APKs.

O relatório é o único arquivo novo fora do diretório ignorado de evidências. A checagem por SHA-256 confirmou a preservação dos arquivos rastreados, dos APKs existentes e dos arquivos locais anteriores. Os testes usaram apenas dados fictícios e serviços Firebase emulados. [Checagem de preservação](../android/app/build/android-16kb-investigacao/preservation-final.json).
