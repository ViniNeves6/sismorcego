# Avaliação controlada com coordenadores

Implementação de 06/11/2026, exclusivamente na branch local
`feature/redesign-coordenadores-20261031`, sobre `495dacf`.
O histórico e as melhorias comuns dessa base foram preservados. Nenhum push,
merge, pull request, alteração na `main` ou publicação no Firebase foi realizado.

## Comportamento do aplicativo

O APK desta branch usa a opção nativa `SISMORCEGO_COORDINATOR_EVALUATION`.
Após a splash de abertura, um aparelho provisionado entra diretamente no
`SismorcegoShell` com as cinco abas e o tutorial existente. Login, cadastro,
recuperação de senha e saída da conta não aparecem nesse modo. A splash não é
reapresentada ao trocar de aba. O caminho de autenticação normal continua
disponível no código quando essa opção nativa está desativada.

Sem uma sessão válida, o app mostra **Configuração necessária** e não monta
o Shell nem permite acesso não autenticado. O aviso dá acesso ao provisionamento
pela equipe e à tentativa de revalidação, sem oferecer um login ao avaliador.
As páginas de configuração reutilizam a transição existente, incluindo saída,
entrada, botão Voltar do Android e movimento reduzido.

Em Minha conta, o nome é `Sismorcego` e o e-mail é `************`, inclusive no
primeiro render e na leitura por voz. Os campos são somente leitura, sem ação
de senha ou envio de credenciais. A foto local e suas ações foram mantidas.
Esses textos não alteram o usuário real no Firebase.

O responsável pelo registro começa sem o nome da conta compartilhada. A pessoa
informa seu nome por **Alterar responsável pelo registro**; ele pode ser alterado
para cada ocorrência e fica salvo por aparelho. O formulário identifica o perfil
de avaliação como Coordenador. O UID compartilhado permanece como proprietário
técnico; o nome humano permanece no registro, histórico, sincronização e PDF.
O campo de nuvem existente é `nomeAcs`; nenhuma mudança de esquema foi necessária.

## Autenticação e provisionamento

Não há autenticação simulada ou anônima no modo de avaliação, nem senha,
refresh token, custom token, chave administrativa ou UID de conta real embutidos
no código/APK. Um APK debug sem backend apropriado também não ganha acesso falso.

A autenticação é realizada pelo SDK real do Firebase com
`signInWithCustomToken`. O provisionamento é uma operação da equipe em cada
aparelho, antes de entregá-lo ao coordenador:

1. Instalar o APK **homologation**, cujo nome exibido é **Sismorcego** e cujo
   pacote é `com.sismorcego.homologacao`.
2. Abrir **Configurar aparelho** e copiar o código público da instalação.
   Esse código identifica o aparelho; ele não é uma credencial de acesso.
3. Na estação autorizada, emitir um arquivo de ativação para o UID compartilhado
   e esse código, usando o script abaixo. O script consulta a conta e seu papel;
   ele não cria usuários, não muda papéis nem altera regras.
4. Transferir o arquivo por um canal privado e selecioná-lo em
   **Importar configuração**, pelo seletor de documentos do Android.
5. Conferir a abertura do Shell e remover o arquivo do aparelho, da estação e do
   canal de transferência quando não for mais necessário.

Exemplo para execução **pela equipe autorizada**, após preparar a conta real:

```powershell
node scripts/provision-coordinator-device.cjs --production --project sismorcego-50b25 --uid <UID_COMPARTILHADO> --installation <CODIGO_DO_APARELHO> --output C:/ProvisionamentoPrivado/aparelho-01.json
```

A autenticação administrativa da estação usa ADC/permissões IAM externas ao
repositório. Se o ambiente exigir assinatura remota explícita, o script aceita
`--service-account <EMAIL_DA_CONTA_DE_SERVICO>`; isso é um identificador, não uma
chave privada. A equipe precisa configurar as permissões de consulta a Auth e
Firestore e de assinatura de custom tokens para o emissor escolhido.
Não colocar arquivos de chave, ADC ou variáveis secretas dentro do projeto.

O script exige `--production` ou `--emulator` explicitamente. Em produção só
aceita `sismorcego-50b25`, recusa variáveis de emulador e exige saída fora do
repositório. Nunca sobrescreve um arquivo existente. Aplica acesso somente ao
usuário atual com ACL no Windows ou modo 0600 em Unix, antes de escrever o token.
Não imprime o conteúdo ou erro bruto do SDK no terminal.

O custom token tem validade de até uma hora e inclui o código da instalação.
O arquivo não deve ser tratado como uso único: durante sua validade, quem tem
uma cópia possui uma credencial temporária. A importação confere projeto, prazo,
instalação e UID, e o Firebase confere a assinatura. Depois da troca, o app
confere as claims assinadas da conta e da instalação e consulta o papel no
servidor antes de aprovar o aparelho. Emuladores permitem tokens de desenvolvimento
somente no projeto `demo-sismorcego-spark`, nunca no APK conectado à base real.

O SDK renova a sessão usando sua persistência em
`react-native-encrypted-storage` (Android Keystore/iOS Keychain), incluindo o
marcador de aprovação e o identificador da instalação. O arquivo de ativação
não é necessário para reabrir o app. Cada aparelho mantém sua própria sessão,
embora todos utilizem o mesmo UID; desconectar localmente um deles não encerra
as sessões dos demais.

## Dependências da equipe para a base real

Estas etapas **não foram executadas em produção**:

- Escolher/criar e autorizar um único usuário real habilitado, de nome
  `Sismorcego Teste`, e informar seu UID ao operador do provisionamento.
- Garantir `usuarios/{uid}.role = 'coordenador'` no Firestore.
- Autorizar a claim administrativa `sismorcegoEvaluationAccount: true` nesse
  usuário. O script verifica essa claim e o nome; não os escreve.
- Preparar ADC/IAM para emitir custom tokens na estação da equipe e definir o
  canal privado de transferência dos arquivos de curta duração.
- Provisionar cada instalação e validar, com autorização, a leitura da base real.

As regras atuais continuam responsáveis pela autorização dos dados. Nenhuma
regra ou credencial real foi criada, alterada ou publicada para este trabalho.
Os testes locais não provam que a futura conta real já existe ou está autorizada.

## Expiração e revogação

O app revalida nas mudanças de ID token, ao voltar ao primeiro plano, ao
reconectar à rede e a cada cinco minutos enquanto estiver ativo. A alteração
do papel também é acompanhada por listener do Firestore. Um pedido de renovação
forçada não é descartado quando já existe uma verificação em andamento.
Sessões inválidas removem a aprovação local, bloqueiam o Shell e pedem nova
configuração; não há fallback para acesso anônimo ou login simulado.

Uma sessão anteriormente aprovada pode usar o cache offline enquanto o ID token
ainda for válido. Sem conexão não é possível detectar instantaneamente uma
revogação remota. Se o token expirar sem renovação, o acesso fica bloqueado;
falhas transitórias de rede não apagam a sessão renovável. A mudança ou remoção
de papel no servidor invalida a aprovação quando observada.

Referências: [custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens)
e [gerenciamento de sessões e revogação](https://firebase.google.com/docs/auth/admin/manage-sessions).

## Push e serviços existentes

O cadastro de tokens continua identificado por instalação sob o UID; não foi
substituído por um token único da conta compartilhada. O teste de contrato cobre
dois aparelhos e a desconexão independente de um deles.

Entretanto, `FIREBASE_PUSH_BACKEND_READY` já está desativado e as regras atuais
recusam escritas em `usuarios/{uid}/dispositivos/*`. Isso foi preservado. O teste
com SDKs reais locais confirma a recusa, sem enfraquecer regras para aprová-lo.
Não houve validação de entrega FCM em produção. Ativar push depende de uma
revisão/autorização separada da equipe sobre backend e regras. Storage, plano
Spark e os demais serviços não foram alterados.

## Validação realizada

- **606 testes do app, 59 suítes: aprovados.** Incluem sessão, provisionamento,
  restauração, ausência/expiração/revogação, proteção das credenciais, navegação,
  responsável, histórico/sync/PDF, splash, acessibilidade e melhorias comuns.
- **60 testes, 3 suítes com Auth/Firestore locais: aprovados.** Foram utilizados
  SDKs reais contra `127.0.0.1:9099/8088`, projeto demo e contas fictícias.
  Cobrem o emissor de custom token, dois aparelhos com mesmo UID, renovação,
  restauração, usuário desabilitado e remoção de papel.
- ESLint nos arquivos JS/CJS alterados/novos: **0 erros**, 29 avisos nas telas
  existentes (estilos e convenções); `git diff --check` aprovado.
- Bundle de produção e builds `assembleEmulator` / `assembleHomologation`:
  **BUILD SUCCESSFUL**, com `arm64-v8a` e `x86_64`.
- Execução no Android API 37, AVD exclusivo `SismorcegoEvaluationQA`, serial
  `emulator-5556`: aviso sem autenticação, importação pelo seletor nativo,
  tutorial, cinco abas, Painel/Alertas, Minha conta protegida, troca do responsável
  entre Ana e Bruno, sessão restaurada após force-stop sem arquivo de ativação,
  bloqueio após remover o perfil coordenador local e bloqueio de usuário
  desabilitado no Auth local ao voltar ao primeiro plano. A restauração e o
  bloqueio também foram repetidos no APK final.
- O APK homologation também foi instalado e aberto nesse AVD: nome Sismorcego,
  ausência de login, aviso de configuração sem credencial, entrada/saída da tela
  de equipe e Voltar do Android. Nenhuma conta real foi provisionada nele.

O AVD disponível utiliza páginas de 16 KB. O Android executou as bibliotecas
nativas atuais em modo de compatibilidade e exibiu um aviso sobre alinhamento.
Esta entrega não certifica essas dependências para distribuição com páginas de
16 KB nem substitui um teste em aparelho físico. Não foram alteradas dependências
nativas para resolver esse tema fora do escopo.

Os testes não criaram nem modificaram ocorrências reais. Não houve validação
autenticada na base Firebase real; ela depende do provisionamento autorizado.

### APK e evidências locais

APK para a equipe: `android/app/build/outputs/apk/homologation/app-homologation.apk`.
Tamanho: 170780617 bytes. SHA-256:
`f79c33d6b43b9eb7ca4aca187108cd75663da1121fd5abb6ec67cdf410d4e2e0`.

Logs, capturas PNG/XML e snapshot inicial estão em
`android/app/build/coordinator-evaluation-qa/`, ignorado pelo Git. Destaques:
`tests-final.log`, `tests-firebase.log`, `lint-final.json`, `build-delivery.log`,
`account-masked.png`, `tutorial-provisioned.png`, `reporter-ana.png`,
`reporter-bruno.png`, `session-restored.png`, `role-revoked.png`,
`account-final.png`, `reporter-final.png`, `session-restored-final.png`,
`auth-disabled-final.png`, `homologation-unconfigured.png` e
`homologation-team-back.png`.

O bundle e os recursos desta compilação foram gerados no diretório de QA e
sobrepostos por um init Gradle temporário, evitando sobrescrever o bundle e
recursos locais não rastreados em `src/main`. O init também usa o alias curto
`W:` para contornar caminhos longos do CMake no Windows. O comando de build foi:

```powershell
./gradlew.bat -I app/build/coordinator-evaluation-qa/qa-build.gradle app:assembleEmulator app:assembleHomologation -PreactNativeArchitectures=arm64-v8a,x86_64 --console=plain
```

## Arquivos da alteração

- Configuração: `.eslintrc.js`, `android/app/build.gradle`,
  `android/app/src/main/java/com/sismorcego/MainApplication.kt`,
  `android/app/src/main/java/com/sismorcego/SismorcegoBuildPackage.kt` e novo
  `android/app/src/main/java/com/sismorcego/SismorcegoProvisioningModule.kt`.
- Sessão: `src/services/appEnvironment.js`, `debugTestSession.js`, `firebase.js`,
  novos `evaluationSession.js`, `secureEvaluationStorage.js` nesse mesmo diretório;
  `src/hooks/useAuth.js`, novos `EvaluationAuthProvider.js` e `authContext.js`.
- Navegação/interface: `src/navigation/index.js`, `SismorcegoShell.js`,
  novo `src/pages/Auth/EvaluationSetupScreen.js`, `src/pages/Extras/Conta.js`,
  `MaisScreens.js`, `src/pages/Main/NovaNotificacaoScreen.js`,
  `src/services/redesignData.js`.
- Ferramenta: novo `scripts/provision-coordinator-device.cjs`.
- Novos testes: `__tests__/evaluationSession.test.js`,
  `evaluationProvisioningTool.test.js`, `evaluationAuthProvider.test.js`;
  `emulator-tests/coordinatorEvaluation.test.js`.
- Testes ampliados em `__tests__`: `appEnvironment.test.js`,
  `pushIntegrationContract.test.js`, `recordFlows.test.js`,
  `redesignScreens.test.js`, `registroPdfExport.test.js`, `startupSplash.test.js`.
- Este relatório: `docs/avaliacao-coordenadores.md`.

Antes da alteração havia 270 arquivos não rastreados: todos foram preservados
com seus hashes originais. As demais branches locais mantiveram seus commits.
Somente os arquivos explicitamente listados acima fazem parte do commit desta
entrega; APK, credenciais de teste temporárias e evidências de QA não são commitados.
