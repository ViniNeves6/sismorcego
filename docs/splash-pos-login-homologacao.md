# Splash após login na homologação

Data: 30/10/2026. Branch: `feature/redesign-teste`.

A splash de abertura foi mantida. Na homologação, um login realizado depois da abertura do aplicativo também exibe a mesma splash por cima da troca de telas. A sessão restaurada automaticamente usa apenas a abertura inicial; atualizações de perfil ou papel não repetem a animação.

O login permanece montado até a apresentação da cobertura nativa. Em seguida, o Shell monta por trás dela. No primeiro acesso, o guia prepara o passo 1 e informa que sua entrada terminou. A splash aguarda esse sinal e o mínimo de 2,9 segundos antes de desaparecer com fade de 250 ms. O guia continua montado no primeiro passo durante toda a saída. Para quem já concluiu o guia, a prontidão depende do layout inicial do Shell, sem repetir o tutorial.

O encerramento da splash não habilita dados do tutorial: a sincronização e as leituras continuam condicionadas ao término ou ao pulo do guia, conforme o fluxo existente. A tela de boas-vindas posterior ao tutorial foi preservada.

A cobertura bloqueia interação e exposição dos elementos inferiores aos serviços de acessibilidade. A leitura do guia aguarda sua revelação, e a fala da splash tem prioridade. Movimento reduzido desativa os voos e o fade, preservando a duração mínima e a espera pela tela pronta. No Android, Voltar durante a cobertura usa a saída nativa do aplicativo, sem pular ou avançar o guia. Logout e desmontagem cancelam a animação; callbacks antigos não liberam uma nova sessão, inclusive ao entrar novamente com o mesmo usuário.

## Arquivos alterados nesta revisão

- `src/navigation/index.js`: cobertura pós-login restrita à homologação e coordenação da troca de telas.
- `src/navigation/SismorcegoShell.js`: sinalização da prontidão do guia ou layout inicial.
- `src/ui/SpotlightGuideModal.js`: sinalização ao terminar a entrada e proteção de callbacks cancelados.
- `src/navigation/StartupSplash.js`: prioridade da leitura por voz durante a cobertura.
- `__tests__/startupSplash.test.js`: cobertura dos fluxos de login, sessão restaurada, prontidão atrasada, logout, novo login, movimento reduzido e Voltar.
- `__tests__/spotlightFeatures.test.js`: prontidão real do primeiro passo e cancelamento da entrada.
- `__tests__/adminShellIntegration.test.js`: prontidão com e sem tutorial, sem liberar dados antes da hora.
- `__tests__/App.test.tsx`: adaptação do mock de navegação ao renderizador da tela autenticada.

## Validação e APK

**521 testes aprovados em 51 suítes.** ESLint nos oito arquivos: zero erros e sete avisos preexistentes. Bundle Android e build de homologação concluídos. Não houve teste visual no S25.

APK universal: `android/app/build/outputs/apk/homologation/app-homologation-splash-pos-login.apk`. Foram verificadas as arquiteturas ARM64, ARMv7, x86 e x86_64, a presença da cobertura pós-login e a igualdade entre o bundle atual e o bundle empacotado. A configuração nativa confirma homologação real, sem emuladores Firebase.

Hashes e resultados: `docs/evidencias-splash-pos-login/verificacao.json`. Os logs e resultados completos estão em `android/app/build/post-login-splash-*`.

Sem commit, push, mudança de branch ou publicação de serviços Firebase.
