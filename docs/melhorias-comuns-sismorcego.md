# Melhorias comuns do Sismorcego

## Isolamento e reaproveitamento

- Worktree: `C:/Users/bradg/.codex/worktrees/melhorias-comuns-sismorcego/sismorcego-redesign`.
- Branch: `codex/melhorias-comuns-sismorcego`.
- Base obtida por `git fetch origin`: `origin/main` em `f28fd210fa3630da7b0d8cc9c0bfe4d07328979f`.
- A referência `origin/feature/redesign-coordenadores-20261031` permaneceu em `9506146e9118a39eb18cfacc8e4037afe58fcef0`.
- As duas referências têm a mesma árvore: `25aed8ea1321366d05445bc029cf7c933a232f50`. A main remota já contém o merge da experiência dos coordenadores.
- O checkout original `C:/Users/bradg/sismorcego-redesign` foi preservado: 657 arquivos conferidos por SHA-256, incluindo os não rastreados; HEAD, branch, status e todas as referências locais anteriores inalterados.

Não foram executados pull, reset, clean, push, merge ou criação de PR. O commit local desta branch pode ser reaproveitado com `git cherry-pick <hash informado na entrega>` em cada branch de destino, depois da autorização para atualizar/integrar essas branches. A main local original continua em seu commit anterior; não foi atualizada silenciosamente. Se os destinos avançarem, repetir a verificação de conflitos e os testes.

A aplicação do patch completo foi verificada em índices Git temporários sobre as duas referências remotas acima. Ambas produziram a mesma árvore final, sem alterar seus checkouts ou branches. A evidência fica em `android/app/build/qa-branch-application.json`.

## Problemas e correções

### Splash

A navegação ainda tinha uma segunda splash exclusiva da homologação, acionada na mudança de sessão após login. Essa lógica foi retirada. A splash existente permanece na inicialização da raiz, inclusive com sessão restaurada, mantendo fundo violeta, marca, enxame, mínimo de 2,9 segundos e saída existente. Login, cadastro, logout, atualização do perfil/papel e navegação não reiniciam a splash na mesma raiz. Autenticação lenta continua sendo aguardada. `SismorcegoShell`, rotas, tela de boas-vindas, tutorial e suas proteções de carregamento foram preservados.

### Desempenho e movimento reduzido

O módulo Android consulta RAM total/disponível, sinal de pouca memória, núcleos disponíveis, frequência máxima quando legível e versão do Android. A consulta roda em uma thread de trabalho e é reutilizada durante a sessão. Não há benchmark sintético, nova permissão ou serviço de rede para essa classificação. Leituras de frequência inválidas do emulador são descartadas.

| Perfil | Critérios principais | Comportamento |
| --- | --- | --- |
| Fraco | RAM abaixo de 3500 MB, até 2 núcleos, Android anterior à API 26, sinal low-RAM ou CPU lenta com até 4 núcleos | Movimento simplificado automaticamente; opção manual oculta |
| Intermediário | Capacidades entre os grupos extremos | Enxame com 10 morcegos e 2 morcegos decorativos na boas-vindas; opção manual disponível |
| Avançado | RAM de pelo menos 5500 MB, pelo menos 6 núcleos, API 29+ e frequência compatível quando conhecida | Animações completas, 18 morcegos no enxame e 4 decorativos; opção manual disponível |

Pressão de memória confirmada pode limitar um perfil avançado ao intermediário. Uma amostra passiva de 12 intervalos de frames, depois de quatro frames de aquecimento, registra a cadência do JavaScript durante a abertura. São necessárias duas aberturas lentas para limitar o perfil e três saudáveis para recuperar a qualidade. A observação vale para uma abertura futura, associada à mesma configuração de hardware; não muda a qualidade de uma tela em uso. Ao ir para segundo plano, uma amostra incompleta é descartada.

A preferência manual é preservada no armazenamento. A preferência de movimento reduzido do sistema sempre prevalece, inclusive quando a opção fica oculta em aparelhos fracos. Sem métricas nativas, o app continua abrindo, mantém os efeitos originais e disponibiliza a opção manual. A classificação é uma heurística; essa amostra de JavaScript não mede diretamente o desempenho da GPU.

### Salvamentos

“Salvar alterações” fica cinza e desabilitado na conta atual, na conta antiga e no editor de ocorrências quando os dados equivalem à base carregada. Editar habilita; desfazer desabilita. Nome e e-mail são normalizados quando apropriado, sem ignorar mudanças reais de conteúdo. Fotos salvas imediatamente no aparelho não fazem uma alteração de nome ainda não salva ser enviada por acidente.

Os handlers também rejeitam chamadas sem mudanças. `updateUser` compara os valores atuais do Auth e chama apenas as operações realmente necessárias. A persistência de ocorrências mantém os controles de autoria, cancelamento, revisão e conflito; uma edição equivalente não cria revisão, auditoria ou item na fila. Alterações reais e erros do servidor mantêm seu tratamento anterior.

Login, cadastro, e-mail e alteração de senha continuam disponíveis. Não foi criada conta compartilhada nem modificada a experiência específica dos coordenadores.

### Teclado, menu e rolagem

Havia três causas combinadas: ajuste de teclado no JavaScript sobre o ajuste da janela, reserva fixa do espaço do menu na tela de dúvidas mesmo com o menu oculto, e remontagem do menu em eventos do teclado. O Fabric também reaplica a visibilidade depois de atualizar o layout, o que podia revelar o menu na posição elevada.

No Android API 30+, um controlador de insets assume o espaço do teclado, acompanhando sua animação nativa. O `KeyboardAvoidingView` fica restrito ao iOS; Android anterior mantém `adjustResize`. O menu permanece montado, porém oculto durante digitação e transições do teclado. Ele só reaparece quando sua geometria real voltou ao rodapé. A proteção também trata a atualização de visibilidade feita pelo Fabric depois do layout. Não há temporizador artificial para mostrar o menu.

O estado compartilhado do teclado rejeita respostas antigas, reconcilia o retorno do segundo plano e comunica ao JavaScript as mudanças relevantes. O deslocamento do campo focado aguarda o fim do ajuste nativo. A tela de dúvidas remove a reserva do menu com teclado aberto e as outras telas retiram a reserva extra de conteúdo nesse estado. Em “Nova dúvida”, apenas o indicador customizado fica oculto durante a digitação: o formulário e o texto continuam rolando, inclusive em uma janela menor até alcançar Cancelar/Enviar.

Essa abordagem segue os eventos de [animação dos insets do teclado do Android](https://developer.android.com/develop/ui/views/layout/sw-keyboard). As informações de memória vêm de [ActivityManager.MemoryInfo](https://developer.android.com/reference/android/app/ActivityManager.MemoryInfo).

### Nome

Os nomes dos APKs de homologação e do emulador agora são exibidos como **Sismorcego**. IDs dos pacotes, flags dos ambientes, autenticação e configuração Firebase não mudaram. O APK de validação mantém `com.sismorcego.emulador`.

## Validação

- Referência antes das alterações: 541 testes, 52 suítes aprovadas.
- Resultado final do app: **572 testes, 56 suítes aprovadas**, incluindo preferências, transições nos dois sentidos/Back, splash, teclado, edição, conflitos e autoria.
- Firebase local: **57 testes, 2 suítes aprovadas**, incluindo Auth, regras, ownership e fluxo SQLite/Firestore.
- ESLint dos arquivos JavaScript alterados/novos: **0 erros**, 34 avisos de estilo já presentes nos trechos existentes.
- `git diff --check`: aprovado.
- Compilação Android: **BUILD SUCCESSFUL**, `app:assembleEmulator`, x86_64, Java 17. O APK foi instalado e executado.
- A identificação extraída com `aapt` confirmou `application-label: Sismorcego` e o pacote original `.emulador`.

Os testes de Firebase usaram somente `demo-sismorcego-spark`, Auth em `127.0.0.1:9099` e Firestore em `127.0.0.1:8088`. O APK usa exclusivamente os correspondentes locais `10.0.2.2`, sem fallback para o projeto real. Foram usados conta e ocorrência fictícias. Nenhum dado real foi alterado; regras e configurações remotas não foram publicadas.

O AVD exclusivo de QA foi executado na porta **5556**, API 37, com resoluções 1080×2400 e 1080×1800. Não foi operado o emulador do usuário. Foram exercitados cadastro com teclado, saída com confirmação, novo login sem splash, sessão restaurada, conta sem edição/edição/desfazer, nova dúvida e rolagem até os botões, busca, popup de responsável, detalhes/editar/cancelar/voltar e navegação inferior. Também foi gravada a abertura/saída de popups com animação completa e ciclos do teclado.

| Perfil executado | Capacidades recebidas pelo app | Resultado |
| --- | --- | --- |
| Intermediário | Cerca de 3915 MB e 4 núcleos | Opção manual visível; movimento reduzido do Android respeitado; formulários, teclado e menu verificados |
| Avançado | Cerca de 7940 MB e 6 núcleos disponíveis | Abertura automática com enxame completo; opção manual visível |
| Fraco | Cerca de 1967 MB, 256 MB disponíveis e 2 núcleos | Movimento reduzido automaticamente mesmo com animações do Android habilitadas; opção manual oculta, demais configurações mantidas |

O emulador disponível tem páginas de 16 KB e apresentou o aviso de compatibilidade de bibliotecas já existente na versão de referência. O app foi executado no modo de compatibilidade. Esta entrega não certifica todas as bibliotecas para distribuição com páginas de 16 KB; também não substitui o teste em aparelho físico ou em versões antigas do Android.

### Reprodução e evidências locais

Os artefatos ficam em `android/app/build/` no worktree e não integram o commit: `common-tests.log`, `common-firebase-tests.log`, `common-lint.log`, `common-final-build.log`, `original-integrity.json`, capturas `qa-*.png`/XML e vídeos `qa-motion.mp4`, `qa-high-startup.mp4`, `qa-low-startup.mp4`. O APK usado é `android/app/build/outputs/apk/emulator/app-emulator.apk`, SHA-256 `f6ab5a9d27356348454f42c20dbc220c420754d6a90b589c81fe52a67263f078`.

Para contornar o limite de caminhos do Ninja no Windows nesse worktree longo, a compilação utilizou temporariamente a unidade W: apontada para o worktree e um init script local ignorado, `android/app/build/qa-cmake.gradle`, com diretório de staging curto. Primeiro foi gerado o bundle no diretório raiz do worktree:

```powershell
node node_modules/react-native/cli.js bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res --max-workers 2
```

Com W: disponível, o comando de compilação usado em `W:/android` foi:

```powershell
.\gradlew.bat -I app/build/qa-cmake.gradle app:assembleEmulator '-PreactNativeArchitectures=x86_64' --console=plain
```

O runner de Firebase precisou de uma configuração Jest temporária com glob relativo no Windows (`android/app/build/qa-firebase-jest.cjs`); as duas suítes existentes foram executadas sem alteração. Dependências vieram de `npm ci`; package.json e lockfile não mudaram. Bundle/assets gerados e configurações locais de SDK, AVD e compilação não entram no commit.

## Arquivos alterados ou adicionados

Todos os caminhos abaixo são relativos ao worktree informado no início.

**Inicialização, navegação e preferências**

- `App.js`
- `src/navigation/index.js`
- `src/navigation/SismorcegoShell.js`
- `src/navigation/BatSwarm.js`
- `src/hooks/useAccessibility.js`
- `src/hooks/useDevicePerformance.js` (novo)
- `src/hooks/useKeyboardState.js` (novo)
- `src/hooks/useKeyboardVisible.js`
- `src/services/devicePerformance.js` (novo)
- `src/services/keyboardState.js` (novo)
- `src/ui/KeyboardDock.js` (novo)
- `src/ui/KeyboardScrollView.js`
- `src/ui/SpotlightWelcomeModal.js`

**Edição e persistência**

- `src/pages/Extras/MaisScreens.js`
- `src/pages/Extras/Conta.js`
- `src/hooks/useAuth.js`
- `src/services/accountProfile.js`
- `src/services/editChanges.js` (novo)
- `src/services/recordMutations.js`
- `src/ui/RecordDetailsModal.js`
- `src/ui/Button.js`

**Android**

- `android/app/build.gradle`
- `android/app/src/main/java/com/sismorcego/MainActivity.kt`
- `android/app/src/main/java/com/sismorcego/SismorcegoBuildPackage.kt`
- `android/app/src/main/java/com/sismorcego/SismorcegoDeviceModule.kt` (novo)
- `android/app/src/main/java/com/sismorcego/SismorcegoWindow.kt` (novo)

**Testes e documentação**

- `__tests__/adaptiveMotion.test.js` (novo)
- `__tests__/devicePerformance.test.js` (novo)
- `__tests__/editChanges.test.js` (novo)
- `__tests__/nativeKeyboardState.test.js` (novo)
- `__tests__/adminShellIntegration.test.js`
- `__tests__/authSession.test.js`
- `__tests__/batSwarm.test.js`
- `__tests__/extras.test.js`
- `__tests__/keyboardScroll.test.js`
- `__tests__/recordDetailsMotion.test.js`
- `__tests__/recordFlows.test.js`
- `__tests__/redesignScreens.test.js`
- `__tests__/startupSplash.test.js`
- `docs/melhorias-comuns-sismorcego.md` (este relatório)
