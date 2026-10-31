# Fade da splash para o login

Data: 30/10/2026. Branch: `feature/redesign-teste`.

A passagem da splash inicial para a tela de login usa agora o mesmo fade da splash pós-login para o passo 1: cobertura em **100 ms** e revelação em **200 ms**, com as curvas de `src/ui/screenFade.js`.

A arte da splash permanece montada até a cobertura ficar opaca. O navegador de autenticação então é preparado por trás dela. A revelação só começa depois do evento de layout do login; essa mesma instância permanece montada quando a splash é retirada, evitando uma segunda montagem no fim da animação. Os controles e a exposição da tela de login à acessibilidade só são liberados ao terminar a saída.

O mínimo de 2,9 segundos, a espera pela autenticação e o movimento reduzido foram preservados. Em movimento reduzido, o login abre após o mínimo sem depender das animações ou do sinal de layout. Sessões já autenticadas continuam aguardando a saída completa da abertura antes de montar o Shell e seu tutorial. A splash pós-login mantém o comportamento anterior.

Arquivos desta revisão: `src/navigation/index.js`, `src/navigation/StartupSplash.js` e `__tests__/startupSplash.test.js`.

Validação: **541 testes aprovados em 52 suítes**, ESLint sem erros ou avisos nos três arquivos, bundle Android e APK universal gerados. Os testes verificam os quadros intermediários, a retenção da mesma tela de login, espera pelo layout, autenticação atrasada, restauração de sessão durante a revelação, movimento reduzido e os fluxos anteriores de abertura e pós-login. Não houve conferência visual no S25 nesta rodada.

APK: `android/app/build/outputs/apk/homologation/app-homologation-fade-login.apk`. Evidências e hashes: `docs/evidencias-fade-login/verificacao.json`. Logs e resultados: `android/app/build/startup-login-fade-*`.

Sem commit, push, troca de branch ou publicação de serviços Firebase.
