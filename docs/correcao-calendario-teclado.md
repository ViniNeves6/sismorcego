# Calendário e campos acima do teclado

Data: 30/10/2026.

## Alterações

- As listas de meses e anos agora são filhas do diálogo do calendário. Antes, ficavam fora dos limites de toque das colunas dos botões, embora continuassem visíveis. Cada lista tem uma janela de rolagem de 180 pontos e indicador nativo de rolagem.
- Os menus acompanham as medidas reais dos controles. Ao trocar entre mês e ano, a saída do menu anterior termina antes da entrada do próximo. O botão Voltar do Android fecha primeiro o menu, e a preferência de movimento reduzido é respeitada.
- Uma camada de ajuste ao teclado atende a janela do aplicativo. As camadas duplicadas de login e telas antigas foram removidas.
- Os formulários usam uma rolagem compartilhada que mede o campo em foco depois do ajuste da janela e o coloca acima do teclado, com margem de 16 pontos. O ajuste é cancelado ao fechar o teclado, sair do campo, iniciar rolagem manual ou desmontar a tela. Uma medição atrasada não move um formulário que perdeu o foco.
- Os popups de alterar responsável e cancelar ocorrência têm altura limitada ao espaço disponível e rolagem interna, incluindo suas ações. As animações existentes foram preservadas.

## Validação

- 396 testes aprovados em 42 suítes, incluindo seleção de meses/anos, hierarquia de toque dos menus, troca e fechamento animados, Voltar, movimento reduzido, campo inferior, foco com teclado aberto, cancelamento de ajustes pendentes e preservação de callbacks e referências dos formulários.
- 324 layouts modelados com Yoga 3.2.1 usando os estilos reais e alturas de conteúdo simuladas: larguras de 280 a 768 pontos, escalas de conteúdo de 1 a 1,5, menus dentro dos limites de toque e popups dentro do espaço acima do teclado.
- ESLint sem erros; 12 avisos de estilos inline preexistentes nos dois arquivos de popup.
- APKs debug e homologação gerados. O APK de homologação desta entrega contém as quatro arquiteturas Android e seu bundle foi conferido por SHA-256 após a geração.

Os testes automatizados e o modelo de layout não substituem a verificação de gestos e teclado em um aparelho. Não houve validação física no S25 nesta execução.

## Entrega e evidências

- APK: `android/app/build/outputs/apk/homologation/app-homologation-calendario-teclado.apk`.
- Evidências: `docs/evidencias-calendario-teclado/`.
- Arquivos principais: `App.js`, `src/ui/KeyboardScrollView.js`, `src/ui/AppCalendarModal.js`, `src/ui/AccessibleNative.js`, `src/ui/ThemedDialogs.js`, `src/ui/RecordDetailsModal.js`, `src/pages/Auth/AuthLayout.js` e `src/ui/Screen.js`.

Nenhuma publicação no Firebase foi necessária para estas correções de interface.
