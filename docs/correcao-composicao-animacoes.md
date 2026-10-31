# Revisão dos rastros retangulares nas animações

Data: 30/10/2026.

## Diagnóstico

A revisão encontrou animações de opacidade individuais nos cards de Registros e Alertas, com escala, deslocamento e atraso de até 880 ms. Elas continuavam em execução depois do fade de 200 ms da tela. A cobertura de testes anterior verificava um card estático de exemplo, sem renderizar essas duas listas reais.

Nos popups, a proteção anterior solicitava composição conjunta por `needsOffscreenAlphaCompositing`, mas não forçava uma textura única no Android. As sombras nativas dos diálogos usam elevação. Esse conjunto é compatível com os contornos descritos pelo usuário; não houve reprodução visual na GPU do S25 nesta execução.

## Correções

- Os cards de Registros e Alertas permanecem opacos durante a troca de tela. Foram removidos seus efeitos individuais de entrada; a navegação mantém um único fade, com saída e entrada.
- A cobertura lisa do fade fica acima das sombras dos cards, com elevação própria e sombra transparente. A tela anterior continua montada até o término da saída.
- `useFadeCompositing` prepara uma textura nativa antes da entrada e da saída dos popups, combina-a com composição de alpha e libera a textura ao atingir o destino da animação. Uma reversão não libera a camada antes da hora, e movimento reduzido desativa esse cache.
- A proteção atende confirmação de perguntas, calendário e seus menus, seletores, detalhes/cancelamento de ocorrência, responsável, informações, orientações, notificações e os diálogos do tutorial.
- Responsável, informações, orientações e seletores agora montam antes de iniciar a entrada e cancelam transições interrompidas. Calendário, detalhes e notificações também ignoram conclusões antigas de saída após uma reabertura.
- Os ajustes recentes de teclado e rolagem do calendário foram preservados.

A documentação do React Native descreve a composição de elementos sobrepostos e a textura única no Android, recomendando liberar o cache após a animação: [composição de alpha](https://reactnative.dev/docs/0.81/view#needsoffscreenalphacompositing) e [textura de hardware](https://reactnative.dev/docs/0.81/view#rendertohardwaretextureandroid). Também foram conferidos os setters de camada e alpha no código Android do React Native 0.81.1 instalado.

## Validação

- 409 testes aprovados em 43 suítes.
- Regressões com as listas reais de Registros e Alertas, verificando ausência de transparência, escala e deslocamento nos ancestrais dos cards durante o fade da tela.
- Testes de preparação/liberação de textura, entrada/saída, retenção de conteúdo, reabertura rápida e conclusão antiga, exclusão de pergunta, Cancelar, Voltar e movimento reduzido.
- Testes anteriores de teclado, calendário e demais funcionalidades continuam aprovados.
- ESLint sem erros, com 21 avisos preexistentes nos arquivos revisados.
- Builds debug e homologação universais concluídos; bundle embarcado e quatro arquiteturas conferidos após a geração.

Os testes validam o comportamento React e as propriedades enviadas às views nativas. Ainda falta confirmar visualmente o resultado na GPU do S25; não foi utilizado o emulador pessoal do usuário.

## Entrega

APK: `android/app/build/outputs/apk/homologation/app-homologation-fade-sem-rastro.apk`.

Logs e conferência SHA-256: `docs/evidencias-composicao-animacoes/`.
