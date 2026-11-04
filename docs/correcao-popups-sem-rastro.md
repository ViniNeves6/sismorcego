# Composição do fade das popups no Android

Correção de 29/10/2026.

O código das popups aplicava opacidade a contêineres com fundo, texto e sombras
de elevação sobrepostos, sem solicitar composição conjunta no Android. Esse
padrão é compatível com o retângulo de sombra visível na captura enviada.
O diagnóstico foi feito por inspeção do código, da captura e do mecanismo nativo;
não houve reprodução visual em um aparelho físico nesta etapa.

## Mudanças

Foi habilitado `needsOffscreenAlphaCompositing` nos contêineres que fazem fade.
Assim, o Android pode compor as partes sobrepostas antes de aplicar a opacidade
ao conjunto. A correção cobre:

- Confirmação de exclusão de perguntas (`AnimatedOverlay`).
- Calendário e submenus de mês/ano.
- Seletores em bottom sheet.
- Detalhes, edição e confirmação de cancelamento de ocorrência.
- Informações, alteração de responsável, orientações e notificações.
- Guia inicial, boas-vindas e avisos flutuantes com o mesmo padrão de fade.

Não foi habilitado cache permanente com `renderToHardwareTextureAndroid`.
Sombras e cantos arredondados continuam nos estilos existentes.

No `AnimatedOverlay`, a entrada agora começa depois de o conteúdo estar
montado. O conteúdo da última abertura fica retido até o fim da saída, mesmo
que o chamador remova seus filhos. Fechamentos interrompidos não podem desmontar
uma popup já reaberta. Movimento reduzido do aplicativo ou do sistema abre e
fecha imediatamente, sem disparar a animação. Durante o fechamento, a popup
deixa de receber toques e de participar da navegação de acessibilidade.

A confirmação de perguntas mantém seus caminhos de Cancelar, Excluir e voltar
do Android. As transições das outras popups foram preservadas.

## Verificação

- 368 testes aprovados em 40 suítes.
- 16 testes novos de composição e ciclo de vida, incluindo quadros intermediários,
  montagem antes da entrada, conteúdo retido na saída, fechamento interrompido,
  reabertura, redução de movimento, exclusão real simulada, Cancelar e voltar
  pelo Android. Cobertura adicional de calendário, seletores, orientações,
  detalhes, cancelamento, informações e alteração de responsável.
- ESLint dos arquivos alterados: nenhum erro e 18 avisos preexistentes de
  estilos inline.
- Compilações Debug e Homologação universais concluídas. O bundle incluído no
  APK de entrega é conferido por SHA-256, com as quatro arquiteturas presentes.

Os testes conferem propriedades nativas e o comportamento da árvore React.
Eles não medem pixels renderizados pela GPU do S25. Ainda é necessária a
conferência visual da abertura e saída nesse aparelho.

Logs e conferência do APK: `docs/evidencias-popups-sem-rastro/`.

APK de homologação:
`android/app/build/outputs/apk/homologation/app-homologation-popups-sem-rastro.apk`.

## Base técnica

Conferidos também os métodos `setNeedsOffscreenAlphaCompositing` e
`hasOverlappingRendering` em `ReactViewGroup.kt` e o respectivo prop em
`ReactViewManager.kt` do React Native 0.81 instalado no projeto.

A documentação oficial descreve a composição necessária para opacidade em
elementos sobrepostos e o custo de manter texturas de hardware:
[needsOffscreenAlphaCompositing](https://reactnative.dev/docs/0.81/view#needsoffscreenalphacompositing)
e [renderToHardwareTextureAndroid](https://reactnative.dev/docs/0.81/view#rendertohardwaretextureandroid).
