# Entrada e saída dos detalhes do registro

Data: 30/10/2026.

## Mudança

A entrada era disparada no mesmo efeito que montava o diálogo. Além disso, a primeira montagem com `visible=true` começava com alpha 1. Isso permitia perder o início do fade ou apresentar o diálogo já aberto.

O diálogo agora começa transparente e só inicia a animação depois do evento nativo de layout. A entrada dura 320 ms, com curva de desaceleração, deslocamento vertical de 24 pontos e escala de 0,985 a 1, sem ultrapassar o tamanho final. A saída dura 220 ms. Posição, tamanho final, campos e ações foram preservados.

O registro permanece montado durante a saída, inclusive se o chamador limpar a seleção. Reabrir durante o fechamento usa a opacidade atual, sem reiniciar do zero; callbacks antigos não podem desmontar a nova abertura. O X, o toque no fundo e o botão Voltar usam o mesmo fechamento. Cancelar ou voltar da edição mantém o conteúdo anterior até o término de sua saída.

A preferência de movimento reduzido do sistema e do aplicativo é respeitada, inclusive se mudar durante a entrada. A composição em textura temporária que protege o fade das sombras retangulares foi mantida, assim como os ajustes de teclado e calendário.

## Validação

- 422 testes aprovados em 44 suítes.
- 13 testes específicos novos: montagem inicial e reabertura, espera pelo layout, alpha inicial zero, trajetória sem ultrapassagem, X/fundo/Voltar, retenção dos dados, reabertura durante a saída, redução de movimento, ida e volta da edição e fechamento antes do primeiro layout ou durante a troca de modo.
- Testes anteriores de composição dos popups atualizados para emitir o layout nativo antes da entrada dos detalhes.
- ESLint sem erros; oito avisos preexistentes de estilos inline no arquivo do diálogo.
- Builds debug e homologação universais concluídos; bundle incluído e arquiteturas conferidos por SHA-256 e inspeção do APK.

Os testes verificam a lógica, os valores intermediários e as propriedades nativas. Não houve reprodução visual da animação no S25 nesta execução.

## Entrega

APK: `android/app/build/outputs/apk/homologation/app-homologation-detalhes-suave.apk`.

Evidências: `docs/evidencias-animacao-detalhes/`.
