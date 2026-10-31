# Confirmação ao sair

Data: 30/10/2026. Branch: `feature/redesign-teste`.

O botão **Sair**, no menu Mais, agora abre a popup **Sair da conta?**, com **Cancelar** e **Sair**. Cancelar, tocar fora da caixa ou usar Voltar mantém a sessão e a tela atual. Confirmar fecha a popup e só então chama o encerramento da sessão, preservando o conteúdo durante toda a saída animada.

A implementação reutiliza os estilos e a composição de transparência das outras popups, com entrada e saída, alto contraste, escala de texto, leitura por voz e movimento reduzido. A confirmação evita chamadas duplicadas ao sair. Se o encerramento falhar, o tratamento de erro existente é preservado e uma nova tentativa pode ser confirmada.

Arquivos desta revisão: `src/navigation/SismorcegoShell.js`, `src/ui/ThemedDialogs.js`, `__tests__/adminShellIntegration.test.js` e `__tests__/popupCompositing.test.js`.

Validação: **531 testes aprovados em 51 suítes**, ESLint sem erros nos quatro arquivos, bundle Android e APK de homologação gerados. Os testes cobrem cancelar, confirmar após o fade, Voltar, repetição de toques, recuperação após falha, reabertura durante a saída, composição do fade e redução de movimento. Não houve conferência visual no S25.

APK universal: `android/app/build/outputs/apk/homologation/app-homologation-confirmacao-sair.apk`. Evidências e hashes: `docs/evidencias-confirmacao-sair/verificacao.json`. Logs e resultados completos: `android/app/build/sign-out-confirmation-*`.

Sem commit, push, troca de branch ou publicação de serviços Firebase.
