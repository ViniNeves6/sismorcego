# Ilustração do passo 1 e fade após login

Data: 30/10/2026. Branch: `feature/redesign-teste`.

## Passo 1 de Como usar?

A imagem antiga foi substituída por uma ilustração vetorial da busca atual de Registros. Para coordenadores, ela inclui os seletores **Município: Todos** e **Vítima: Todas**, empilhados como na tela estreita, além das opções **Todos**, **Pendentes** e **Enviados** e do contador. Para ACS, mostra apenas os controles disponíveis nesse perfil. A imagem se ajusta inteira ao espaço da popup e também responde ao alto contraste. Os passos 2 e 3 foram preservados.

A leitura por voz dos três passos foi alinhada ao conteúdo visual: consultar, registrar e sincronizar, nessa ordem.

## Splash pós-login para o guia

A passagem passou a compartilhar a duração e a curva das transições entre Registros e Alertas, extraídas para `src/ui/screenFade.js`. Uma cobertura do fundo fecha sobre a splash em **100 ms**; somente depois sua arte é desmontada. A cobertura então desaparece em **200 ms**, revelando o guia já pronto por baixo. A hierarquia de cards do guia permanece opaca, evitando o problema de sombras atravessando as faces dos cards.

O mínimo de **2,9 segundos**, a espera pelo primeiro passo pronto e o bloqueio dos dados durante o tutorial continuam ativos. A abertura inicial mantém o fade original de 250 ms. Movimento reduzido dispensa as duas animações adicionais. Cancelamento de ambas as fases, logout, novo login e Voltar preservam as proteções existentes. A confirmação de saída também permanece incluída.

## Arquivos e validação

Fontes alterados/criados: `src/ui/HowToRecordsPreview.js`, `src/ui/HowToModal.js`, `src/ui/screenFade.js`, `src/ui/AnimatedScreenTransition.js`, `src/navigation/StartupSplash.js`, `src/navigation/index.js` e `src/navigation/SismorcegoShell.js`.

Testes alterados/criados: `__tests__/howToRecordsPreview.test.js`, `__tests__/startupSplash.test.js`, `__tests__/popupCompositing.test.js` e `__tests__/accessibilityMotion.test.js`.

**538 testes aprovados em 52 suítes.** ESLint sem erros nos 11 arquivos verificados, com dois avisos preexistentes de estilos inline. A ilustração foi renderizada a partir do componente de produção e inspecionada em prévia para coordenador, ACS e alto contraste. A animação foi verificada por testes automatizados, incluindo instantes intermediários e cancelamento em cada fase; não houve reprodução visual no S25 nesta rodada.

APK universal: `android/app/build/outputs/apk/homologation/app-homologation-guia-fade.apk`. Evidências e hashes: `docs/evidencias-guia-fade/verificacao.json`. Logs: `android/app/build/help-splash-fade-*`. Prévia da ilustração: `android/app/build/help-preview/preview.png`.

Sem commit, push, troca de branch ou publicação de serviços Firebase.
