# Retorno da barra ao fechar o teclado

Correção Android na branch `feature/redesign-coordenadores-20261031`, sobre `36ebd88`.

## Problema e alteração

A barra inferior aguardava o fim da animação do IME, outro layout do conteúdo e a atualização assíncrona das coordenadas do React/Yoga. Nesse intervalo a tela já tinha crescido, mas a barra permanecia invisível. O primeiro registro no emulador mostrou 100 ms entre o estado nativo de teclado fechado e o retorno da barra.

Em Android 11 ou posterior, `SismorcegoWindow.kt` agora encerra esse estado diretamente no callback nativo do IME. A barra é alinhada ao rodapé real com uma translação temporária, antes do desenho, enquanto o React termina de atualizar suas coordenadas. A correção é recalculada antes de desenhar e volta a zero quando o layout alcança a posição final. Isso evita tanto o intervalo sem barra quanto o salto para uma posição antiga acima do teclado.

A árvore permanece montada. A barra continua oculta durante abertura, digitação e fechamento do teclado, retornando quando a animação nativa termina. Não foram adicionados timers ou uma segunda animação de entrada; movimento reduzido continua sendo respeitado. O caminho anterior de `adjustResize` foi preservado para Android abaixo da API 30.

Referência técnica: [sincronização com WindowInsetsAnimationCompat](https://developer.android.com/develop/ui/views/layout/sw-keyboard#synchronize-animation).

## Validação

- **39 testes / 4 suítes aprovados:** estado nativo/visibilidade do teclado, scroll/foco, viewport Android/iOS e telas do Shell.
- Builds `assembleEmulator` e `assembleHomologation` aprovados, com `arm64-v8a` e `x86_64`. O bundle JavaScript corresponde ao da versão Spark; esta alteração funcional é nativa.
- APK instalado no AVD exclusivo `SismorcegoAutomaticQA35` (Android 15/API 35, serial 5556), usando somente Auth/Firestore locais e registros fictícios.
- Ciclos repetidos no campo de localidade do formulário e na busca. Barra oculta com o teclado aberto; rodapé restaurado depois de fechar pelo Voltar do Android. Campo inferior permaneceu acima do teclado.
- Movimento reduzido testado com a escala de animação do sistema zerada, depois restaurada.
- Popup de responsável: abrir, focar, fechar teclado pelo Voltar mantendo o popup e cancelar o popup. Barra retorna ao rodapé.
- Nos seis ciclos medidos após a alteração, o intervalo nativo ficou entre **0 e 2 ms**. No APK final, o ciclo adicional mediu **0 ms**. Esses valores medem os eventos de estado/visibilidade, não constituem um benchmark geral de FPS ou certificação em todos os aparelhos.
- `git diff --check` aprovado. O aparelho físico conectado não foi controlado nem recebeu instalação; nele foram consultados apenas a API Android (36) e os logs filtrados disponíveis. O comportamento do teclado Samsung no S25 ainda pode ser conferido após instalar o APK atualizado.

Não houve alteração de autenticação, regras, plano Spark, prazos ou dados do Firebase real. As outras branches e os arquivos locais não rastreados foram preservados.

## Artefatos

APK para instalar: `android/app/build/outputs/apk/homologation/app-homologation.apk`.

SHA-256: `49e440ed81a2f5aafca6405e788c11729b2cfef7dc520b1da9fb20012a05fcf7`.

Evidências ignoradas pelo Git em `android/app/build/keyboard-dismiss-qa/`: `tests-keyboard.log`, `build-final.log`, `baseline-native.log`, `final-native.log`, `final-build-native.log`, `timing-comparison.json`, `android-verification.json`, `apk-verification.json`, vídeos de comparação e capturas PNG/XML de formulário, busca e popup.
