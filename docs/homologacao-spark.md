# Homologação do Sismorcego no Spark

29/10/2026. Projeto: **sismorcego-50b25**.

**Regras aprovadas pelo usuário e publicadas em 29/10/2026 no projeto `sismorcego-50b25`.** A regra ativa foi consultada após a publicação e seu SHA-256 é idêntico ao arquivo aprovado. A Central de Alertas da homologação carregou as três ocorrências reais sem erro após atualizar a tela. A validação de escrita/sincronização com contas da equipe continua sendo uma etapa de testes controlados; nenhum registro real foi criado, editado ou cancelado nesta publicação.

## Publicação autorizada — 29/10/2026

- Alvo exclusivo: `firestore:rules`, banco `(default)`, edição Standard, configuração `C:/Users/bradg/sismorcego-redesign/firebase.json`.
- SHA-256 local e publicado: `5e7eb32448ad2f502779408b9509b83210087ef1936c8bd5ab9713e129a18e39`. Nenhuma alteração foi feita no arquivo apresentado para aprovação.
- **35 testes do Emulator Suite passaram novamente** antes da publicação. A compilação das regras foi aprovada; manteve dois avisos estáticos já existentes sobre valores nulos nos caminhos de criação/auditoria.
- **3 ocorrências antes e 3 depois**, com conteúdo e timestamps idênticos. Faturamento desativado antes e depois; não houve ativação de serviços, publicação de índices, Functions, Storage ou push, nem alteração de usuários/papéis.
- Na conta de coordenador já autenticada no emulador Android, atualizar Alertas exibiu três cards reais, sem a mensagem de falha. A verificação não acionou leitura/não leitura nem qualquer outra escrita na nuvem.

O plugin informou sucesso na primeira tentativa, mas a consulta de confirmação ainda encontrou as regras antigas. A publicação efetiva foi feita pelo CLI com projeto, arquivo de configuração e alvo explícitos:

```powershell
npx.cmd -y firebase-tools@15.34.2 deploy --only firestore:rules --project sismorcego-50b25 --config C:/Users/bradg/sismorcego-redesign/firebase.json --account sismorcego@gmail.com --non-interactive
```

[Backup imediatamente anterior](backups/firestore-antes-publicacao-aprovada-2026-10-29.rules) · [Log da publicação](evidencias-spark/publicacao-regras-aprovadas-2026-10-29.log) · [Fonte ativa conferida](evidencias-spark/regras-publicadas-aprovadas-2026-10-29.rules) · [Preservação e plano](evidencias-spark/publicacao-regras-verificada-2026-10-29.json) · [Revalidação dos testes](evidencias-spark/revalidacao-regras-2026-10-29.log).

As demais seções documentam a implementação e a auditoria anteriores, complementadas pela publicação acima.

## Implementado

### Uma versão separada para testar o Firebase real

| APK | Identificador Android | Comportamento |
| --- | --- | --- |
| [Homologação](C:/Users/bradg/sismorcego-redesign/android/app/build/outputs/apk/homologation/app-homologation.apk) | `com.sismorcego.homologacao` | Login Firebase real, usando o projeto existente e seus papéis; launcher “Sismorcego Homologação” |
| [Debug local](C:/Users/bradg/sismorcego-redesign/android/app/build/outputs/apk/debug/app-debug.apk) | `com.sismorcego` | Mantém a sessão local ACS e o comportamento de testes anterior |

A escolha é uma constante nativa do tipo de compilação `homologation`, não uma opção da tela nem uma preferência que possa ativar a nuvem por acidente. Debug e release continuam no modo local. A homologação tem armazenamento Android separado: instalá-la não substitui o aplicativo local nem seu banco de dados.

Auth e Firestore continuam usando o SDK JavaScript e o app Web já cadastrado. Esta fase não ativa FCM nativo nem requer cadastrar um novo Android no Firebase para esse fluxo JavaScript. O cadastro Android/`google-services.json` para FCM permanece uma etapa futura.

O cadastro segue visível: e-mail/senha/confirmação → Continuar → foto opcional e nome obrigatório. Novas contas recebem somente ACS. Foram mantidos login, sessão persistida, papel por UID e recuperação de senha. Foi corrigida a falha parcial em que Auth já criou a conta e uma etapa de perfil falhou: a sessão fica recuperável, com uma mensagem apropriada, sem exigir repetir o cadastro do mesmo e-mail. Ao trocar de conta, o papel anterior é limpo antes da resolução do próximo perfil.

O ingresso institucional de novos ACS por convite/aprovação não foi imposto nesta entrega: o cadastro permanece disponível como solicitado. A autorização administrativa continua exclusivamente em `usuarios/{uid}.role == coordenador`. Nenhum papel ou usuário real foi criado/modificado.

### Registros, fila, revisão e histórico

- Continua usando a fila SQLite criptografada, separada por `(uid, recordId)`, com IDs permanentes de ocorrência.
- Cada transação grava a ocorrência e um evento imutável de auditoria correspondente. O evento inclui autor autenticado, horário do servidor, revisão e snapshots clínicos antes/depois. Passos locais anteriores ficam como contexto declarado em `localEventsJson`, limitado; imagens não entram nessa trilha.
- Primeira recepção e criação permanecem imutáveis. Dados legados sem recepção conhecida não recebem uma data inventada.
- `serverRevision` e a revisão-base impedem sobrescrever silenciosamente uma versão mais recente de outro aparelho. Uma confirmação perdida pode ser reenviada sem criar outra ocorrência ou outro evento.
- Havendo conflito, a cópia local permanece na fila. No editor, salvar após a revisão reaplica os campos sobre a base remota consultada. Uma nova alteração concorrente volta a ser detectada.
- Também existe **Usar versão do servidor e preservar cópia local**: a versão anterior é arquivada na fila criptografada do aparelho. Esse arquivo local de conflito não é enviado ao Firestore e ainda não possui uma tela de gerenciamento própria.
- Um caso cancelado no servidor não pode ser reaberto pelo cliente. Cancelamento exige motivo, autor e evento atômico. Exclusão física de ocorrência e alteração/exclusão de eventos são negadas nas regras propostas.
- Ocorrências canceladas permanecem no histórico e nos alertas; deixam de compor os indicadores de casos ativos.
- As consultas administrativas em tempo real alimentam também registros e painel durante a sessão do coordenador. A central não recebe um corte silencioso de 500 ocorrências; o histórico legado de consultas pontuais ainda tem seus limites anteriores.

### Alertas gratuitos dentro do aplicativo

A fonte dos alertas é a própria coleção de ocorrências. O cliente não cria documentos administrativos fingindo que foram emitidos por servidor.

São usados listeners para ocorrências, estado pessoal de leitura e feed legado. Eles são desligados quando o app vai para segundo plano ou perde o perfil administrativo. Não há polling nem tarefa que gere alertas com o app fechado.

Cada identidade `(ACS, ocorrência)` produz um cartão estável para cada coordenador. Cinco ocorrências são cinco alertas. Edições e cancelamentos mantêm o mesmo cartão e seu estado de leitura. Cada coordenador pode marcar como lido, não lido ou marcar todos como lidos; o estado fica em:

```text
usuarios/{uidCoordenador}/leiturasOcorrencias/{uidAcs}:{recordId}
```

As regras vinculam esse estado a uma ocorrência existente e ao coordenador dono. Isso não permite criar/alterar a ocorrência nem o feed administrativo. O feed antigo permanece preservado; seus estados de leitura são aproveitados quando ainda não há estado novo. Alertas históricos sem ocorrência disponível continuam apresentados com seus metadados conhecidos, e abrir um documento ausente produz uma mensagem de erro honesta.

O toque consulta a ocorrência correspondente e passa pelo adaptador de detalhes. O painel recebe atualizações de casos sincronizados enquanto o aplicativo está aberto e conectado. ACS não pode assinar as consultas administrativas nem escrever estados de leitura de coordenadores.

**Push permanece indisponível:** `FIREBASE_PUSH_BACKEND_READY` continua `false`. O código FCM preparado foi preservado, sem registro de tokens, ativação de handlers ou envio simulado. Não foi solicitado acesso a notificações do Android para simular essa funcionalidade.

### Fotos e dúvidas

Fotos de perfil continuam opcionais e locais, com iniciais quando ausentes. A informação de que não acompanham a conta entre aparelhos aparece no cadastro e em Minha conta.

**Nenhuma imagem nova é enviada como Base64 ao Firestore.** Isso inclui a fotografia da ocorrência nesta fase. Seleção, visualização e remoção local foram mantidas; a mesclagem do histórico preserva as fotos do próprio aparelho após atualizar a nuvem. Campos/fotos legados já presentes no servidor não são removidos nem substituídos por esta adaptação.

Dúvidas pessoais são consultadas pelo autor e pelos coordenadores. Respostas explicitamente publicadas podem compor perguntas frequentes para outros autenticados. O cliente ACS usa consultas próprias/públicas compatíveis com as regras; somente coordenadores podem responder e publicar. O autor não pode alterar a autoria ou forjar uma resposta.

## Regras aprovadas e publicadas

[Regras completas](C:/Users/bradg/sismorcego-redesign/firestore.rules) · [Backup das regras publicadas](C:/Users/bradg/sismorcego-redesign/docs/backups/firestore-publicado-2026-10-29.rules) · [Backup do arquivo local anterior](C:/Users/bradg/sismorcego-redesign/docs/backups/firestore-local-antes-spark.rules) · [Modelo e consultas](C:/Users/bradg/sismorcego-redesign/docs/modelo-firestore-homologacao.md).

| Área | Alteração em relação às regras anteriores |
| --- | --- |
| Perfis | Leitura privada do próprio perfil; criação própria somente ACS; atualização não muda papel nem introduz campos de permissão |
| Ocorrências | Dono cria/edita com schema e limites; coordenador consulta; sem delete; identidade/datas protegidas; revisão sequencial e evento atômico obrigatório |
| Alterações | Criação vinculada à transação da ocorrência; snapshots coerentes com antes/depois; leitura por dono/coordenador; sem update/delete |
| Leitura de alertas | Novo caminho do coordenador dono; referência validada e apenas estado pessoal de leitura |
| Feed legado | ACS sem acesso; coordenador destinatário pode ler e alterar somente `lida`; cliente não cria nem apaga alertas |
| Dispositivos | Continua negado, pois o FCM permanece desativado |
| Dúvidas | Criação/consulta/exclusão autorizadas; resposta/publicação apenas pelo coordenador; perguntas pessoais não ficam abertas a todos |
| Legados | Leitura mantida; campos antigos não modificados permanecem no documento. Conteúdo legado sem alteração pode ser preservado ao entrar no protocolo de revisão |

São regras para homologação, com cobertura de cenários conhecidos; não uma garantia absoluta de segurança para uma distribuição ampla.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for this controlled test because access is scoped by owner and coordinator role, privileged roles cannot be self-assigned, record deletion is denied and mutations require an immutable atomic audit. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

## Testes e compilação

| Verificação | Resultado e limite |
| --- | --- |
| Testes do aplicativo | **226 aprovados em 27 suítes**, sem falhas. Usam mocks nas fronteiras nativas/Firebase conforme cada teste; não comprovam produção |
| Emulator Suite | **35 aprovados**, com Auth e Firestore locais e as regras efetivamente compiladas pelo emulador. Projeto exclusivo `demo-sismorcego-spark` |
| Auth integrado | Cadastro fictício, nome, perfil ACS, login/logout e recuperação/redefinição de senha pelo emulador Auth |
| Firestore integrado | Cinco ocorrências, retentativa idempotente, dois coordenadores independentes, leitura/não leitura, detalhes, edição, cancelamento e auditoria, legado, listener em tempo real e conflitos entre versões |
| Ataques às regras | Anônimo/outro ACS, elevação de papel, exposição de perfil, exclusão, alteração sem auditoria, evento forjado/reutilizado/órfão, campos arbitrários, strings grandes, tipos inválidos, GPS inválido, revisão inválida, datas protegidas, motivo vazio/branco e escape de caminho: rejeitados |
| Formulário completo | Criação, edição e cancelamento humano com GPS e todos os campos aplicáveis passaram dentro do limite de avaliação das regras |
| Lint dos arquivos de implementação alterados | Aprovado, sem erros |
| Android | Debug e homologação compilados. Ambos têm as quatro ABIs e o bundle atual verificado por hash |
| Validação nativa | APK de homologação x86_64 instalado no emulador Android; abriu **Entrar** e permitiu abrir **Criar conta**, mantendo o fluxo inicial. Nenhum cadastro ou login real foi submetido |

Na instalação de teste, o APK universal não coube no espaço disponível do emulador. A verificação nativa usou um APK x86_64 menor; o artefato de entrega foi depois recompilado com as quatro ABIs. O Android exibiu o aviso de compatibilidade de páginas de 16 KB já existente nas bibliotecas nativas; o app abriu em modo compatível. Esse alinhamento de bibliotecas não foi alterado nesta tarefa de Firebase.

Evidências:

- [Resultados do aplicativo](C:/Users/bradg/sismorcego-redesign/docs/evidencias-spark/testes-app.json).
- [Execução reproduzível dos emuladores e desligamento ao terminar](C:/Users/bradg/sismorcego-redesign/docs/evidencias-spark/testes-emuladores.log).
- [Compilação debug](C:/Users/bradg/sismorcego-redesign/docs/evidencias-spark/build-debug.log) e [homologação](C:/Users/bradg/sismorcego-redesign/docs/evidencias-spark/build-homologacao.log).
- [Hashes e ABIs dos APKs](C:/Users/bradg/sismorcego-redesign/docs/evidencias-spark/apks-verificados.json).
- [Tela de login da homologação](C:/Users/bradg/sismorcego-redesign/docs/evidencias-spark/homologacao-login.png).

Para repetir a suíte local:

```powershell
npm.cmd test -- --runInBand
npm.cmd run test:firebase
npm.cmd run android:apk:homologacao
```

O comando dos emuladores exige Java 21+ e procura um JDK compatível, incluindo o JBR do Android Studio. É possível indicar `SISMORCEGO_EMULATOR_JAVA_HOME`. O Gradle mantém seu ambiente normal. Os testes fixam localhost e um projeto `demo-`; não limpam nem preenchem o projeto real. A suíte inicia e desliga Auth/Firestore automaticamente.

## Preservação, plano e custos

[Verificação antes/depois](C:/Users/bradg/sismorcego-redesign/docs/evidencias-spark/preservacao-verificada.json):

- **Spark confirmado**, com `billingEnabled: false` antes e depois e nenhuma conta de faturamento vinculada.
- **3 ocorrências antes e 3 depois**, com hashes de conteúdo idênticos. Nenhum documento real foi sobrescrito, migrado ou removido.
- Cloud Functions, Firebase Storage, Cloud Run, Cloud Build e Eventarc continuam com API **DISABLED**.
- Na auditoria anterior à autorização, as regras publicadas ainda correspondiam ao backup. A publicação autorizada posterior está registrada no início deste relatório.
- Não foram criados usuários/coordenadores reais, alterados papéis, enviados e-mails reais de teste, registrados tokens FCM ou feitos uploads. Não houve commit ou push.

A central interna usa Auth/Firestore dentro das quotas do Spark. O FCM em si é gratuito, mas sem emissor confiável esta entrega não oferece push com o aplicativo fechado. Cloud Functions e Cloud Storage for Firebase permanecem indisponíveis para esta fase conforme a restrição de faturamento. Não foi contratada alternativa externa. Fontes oficiais: [preços Firebase](https://firebase.google.com/pricing), [Functions](https://firebase.google.com/docs/functions/get-started), [Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

## Arquivos principais desta entrega

O repositório já continha alterações anteriores. A lista abaixo trata desta fase, sem atribuir à entrega os demais arquivos previamente modificados.

| Grupo | Arquivos |
| --- | --- |
| Regras/configuração | `firestore.rules`, `firebase.json`, `firestore.indexes.json`, `.gitignore`, `docs/backups/*` |
| Homologação nativa | `android/app/build.gradle`, `MainApplication.kt`, `SismorcegoBuildPackage.kt`, `src/services/appEnvironment.js`, `src/services/debugTestSession.js`, `scripts/build-android-debug.cjs` |
| Cadastro/autenticação | `src/hooks/useAuth.js`, `src/services/accountBootstrap.js`, `src/pages/Auth/Cadastro.js` |
| Sincronização/conflitos/fotos | `src/services/recordSyncProtocol.js`, `syncRegistros.js`, `recordMutations.js`, `registroAdapter.js`, `historico.js`, `redesignData.js`, `sismorcegoData.js` |
| Central | `src/services/coordinatorInbox.js`, `src/hooks/useCoordinatorAlerts.js`, `useCoordenadorNotifications.js`, `src/navigation/SismorcegoShell.js`, `src/pages/Admin/AdminAlertsScreen.js` |
| Dúvidas/informações de fotos | `src/services/duvidas.js`, `src/hooks/useDuvidas.js`, `src/pages/Extras/MaisScreens.js`, `src/pages/Main/NovaNotificacaoScreen.js`, `src/ui/RecordDetailsModal.js` |
| Testes/ferramentas | `emulator-tests/*`, `scripts/run-firebase-emulators.cjs`, `scripts/test-firebase-emulators.cjs`, `jest.config.js`, `package.json`, `package-lock.json`, testes de ambiente, Auth, registros, central e telas em `__tests__` |
| Evidências/documentação | `docs/modelo-firestore-homologacao.md`, este relatório e `docs/evidencias-spark/*` |

Os scripts de geração atualizaram também o bundle Android empacotado. O código antigo de FCM e a função legada foram preservados, sem ativação/deploy.

## Escopo aprovado e próximos testes

**A publicação autorizada e concluída foi exclusivamente das regras de Firestore acima, no projeto `sismorcego-50b25`.** O índice de `itens/updatedAt` já atendia à consulta verificada na auditoria; não foi necessário publicar índices nesta etapa. O arquivo local de índices serve como referência e não foi implantado.

Escopo da aprovação: aplicar exclusivamente `firestore:rules`. Não inclui criação de contas/documentos de teste na nuvem, alteração de papéis, Functions, Storage, FCM, APIs pagas, faturamento, commits ou push. O backup permite revisar a versão anterior.

A regra ativa já foi conferida, assim como a leitura da Central de Alertas no APK de homologação. A equipe ainda deve avaliar com suas contas autorizadas: login → registros → painel → alertas → leitura/não leitura → detalhes. Para ACS: criar casos fictícios de homologação offline, reconectar, confirmar envio, editar e cancelar com motivo. As três ocorrências legadas devem permanecer preservadas.

**A publicação das regras e a leitura real dos alertas não equivalem à homologação completa de todas as escritas em produção.** Os emuladores demonstram os fluxos locais com as mesmas regras publicadas. Edição, cancelamento, histórico, dúvidas e estados de leitura devem ser avaliados pela equipe com dados próprios de homologação, preservando as ocorrências existentes.
