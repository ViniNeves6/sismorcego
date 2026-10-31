# Fade simples entre telas

Correção de 29/10/2026.

## Problema e mudança

A transição aplicava opacidade ao ancestral de toda a tela, incluindo fundos,
bordas, texto e sombras dos cards. A imagem enviada é compatível com um artefato
de composição desse tipo. A [documentação do React Native](https://reactnative.dev/docs/view#needsoffscreenalphacompositing)
descreve diferenças na mistura de cores ao aplicar opacidade a um grupo de
elementos sobrepostos sem composição adicional. O código Android do React Native
0.81.1 instalado retorna `false` em `ReactViewGroup.hasOverlappingRendering()`
quando essa composição não é solicitada.

O componente de navegação agora mantém o conteúdo opaco e anima somente uma
camada lisa sobre ele. Assim, a aparência interna dos cards não depende de
transparência no ancestral da tela. A camada usa o mesmo fundo da transição,
inclusive o mapeamento de alto contraste do aplicativo, e é removida ao terminar.
Não foram alterados bordas, sombras ou tamanhos dos cards.

As trocas usam apenas fade: saída de 100 ms e entrada de 200 ms. A tela anterior
continua montada até ficar coberta; então a próxima é montada e revelada. Não há
escala nem deslocamento. O conteúdo não recebe toques durante a troca; o dock
continua aceitando a escolha de outra aba. Em navegação rápida, apenas o destino
mais recente é mostrado, e callbacks antigos não finalizam a nova transição.

O movimento reduzido do sistema ou do aplicativo faz a troca imediata. A volta
para uma tela usa o mesmo caminho. O handler do botão Voltar do Android no Shell
foi mantido. Esta implementação substitui a troca imediata descrita anteriormente
em `docs/correcao-abertura-painel.md`, atendendo à instrução atual do `AGENTS.md`
de manter o conteúdo anterior até o término da saída.

## Mapa

O mapa ainda aguarda o término da entrada, dois frames e a tarefa ociosa antes de
ser criado. Se a pessoa sair antes disso, o trabalho pendente é cancelado. Um mapa
que já existe permanece visível durante a saída do painel e só é desmontado com
a tela, evitando uma troca repentina pelo placeholder no início do fade.

## Arquivos e validação

- `src/ui/AnimatedScreenTransition.js`: camada do fade, saída/entrada e retenção
  da tela anterior, com cancelamento de transições interrompidas.
- `src/pages/Admin/DeferredPanelMap.js`: preserva o mapa existente até a saída.
- Testes de navegação e mapa: ida/volta, quadros intermediários, trocas rápidas,
  atualização de dados sem reiniciar o efeito, movimento reduzido durante a saída
  e retenção do mapa.

**328 testes aprovados em 36 suítes.** ESLint dos quatro arquivos alterados sem
erros ou avisos. Compilações universais Debug e Homologação concluídas. O bundle
do APK de entrega e as quatro arquiteturas foram conferidos.

Não houve captura quadro a quadro em um Galaxy S25 nesta etapa; a validação cobre
a lógica e o contrato de renderização, além da compilação Android.

Evidências: `docs/evidencias-fade-simples/`.

APK: `android/app/build/outputs/apk/homologation/app-homologation-fade.apk`.
