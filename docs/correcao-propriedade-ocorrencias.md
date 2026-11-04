# Propriedade, edição e cancelamento de ocorrências

Solicitação de 29/10/2026. Implementação e validação locais concluídas.
Após autorização explícita posterior, as regras foram publicadas em
`sismorcego-50b25` em 29/10/2026. Testes de escrita em ocorrências reais continuam
fora da autorização desta etapa.

## Inventário antes da correção

- React Native/JavaScript, Firebase Auth e SDK web do Firestore; fila SQLite
  criptografada e segregada por conta. A propriedade usa o UID autenticado e o caminho
  `registros/{uid}/itens/{id}`, nunca o nome do responsável.
- `usuarios/{uid}`: perfil privado, papel `acs`/`coordenador`; criação pelo
  cliente somente como ACS, papel imutável depois. Mantém cadastro público.
- Histórico próprio: coleção `registros/{uid}/itens`, ordenada por `updatedAt`
  decrescente, limite 300. Coordenador: collection-group `itens`, ordenado por
  `updatedAt`, limite 500 ou listener da central.
- Alterações atômicas: ocorrência e `alteracoes/{mutationId}` na mesma transação;
  revisões crescentes, `before`/`after` vinculados pelas regras, eventos imutáveis.
- Alertas derivados da identidade da ocorrência; leituras individuais em
  `usuarios/{uid}/leiturasOcorrencias`. Feed legado `notificacoes` somente leitura
  e alteração de `lida` pelo coordenador destinatário.
- Dúvidas: autor consulta próprias/publicadas; coordenador consulta/responde.
  Dispositivos/FCM, Functions e Storage continuam fora desta etapa.
- Falhas encontradas: bloqueio geral `isCoordenador` no Shell; exclusão de
  ocorrência local sem envio; nome do responsável editável depois da criação;
  ausência de consulta da trilha de auditoria nos detalhes.
- Regras já permitem escrita do proprietário sem discriminar ACS/coordenador.
  A alteração local deverá explicitar esse contrato e preservar os validadores,
  limites, dados legados, revisões e proibição de exclusão física.

## Comportamento implementado

| Operação | ACS | Coordenador |
|---|---|---|
| Criar e consultar próprias | Permitido | Permitido |
| Consultar terceiros e sua auditoria | Negado | Permitido |
| Editar/cancelar própria ativa | Permitido | Permitido |
| Editar/cancelar terceiros | Negado | Negado |
| Alterar ocorrência cancelada | Negado | Negado |

`recordOwnerUid`, `isRecordOwner`, `canModifyRecord` e seus validadores em
`recordLifecycle.js` centralizam a decisão. A interface usa a sessão autenticada;
os serviços de alteração consultam novamente `auth.currentUser` e o registro
persistido. UID e ID contraditórios falham. O nome exibido não concede autoridade.
No Firestore, o caminho original e o UID anterior são comparados ao Auth UID.
Registros legados sem UID usam o proprietário do caminho; um UID contraditório
não pode ser apropriado pelo cliente.

Foram removidos os bloqueios gerais de coordenador para editar, cancelar e
resolver conflito de **ocorrências próprias** no Shell. Os botões dependem de
propriedade e situação ativa, e os manipuladores repetem a validação antes de
executar. O coordenador mantém a leitura dos detalhes de todos os usuários.
As substituições na lista usam o par UID/ID para não misturar IDs iguais de
proprietários diferentes.

O responsável original fica somente para leitura depois da criação. Nome e tipo
de notificador são preservados pelo adaptador, pelo protocolo de sincronização
e pelas regras. Espaços existentes no nome legado também são preservados.

## Cancelamento, auditoria e sincronização

- Todo cancelamento exige justificativa não vazia, com até 2.000 caracteres.
  A ocorrência permanece na fila e no histórico, inclusive se nunca foi enviada.
  Nenhuma ação de ocorrência chama exclusão física. Exclusões antigas pendentes
  ficam bloqueadas para conversão explícita em cancelamento.
- Edição/cancelamento preservam o ID, guardam UID do autor, data, revisão e
  alterações anteriores/posteriores. A transação grava a ocorrência e o evento
  imutável em conjunto. O `before`/`after` confirmado é vinculado pelas regras;
  o contexto de eventos locais é identificado como declaração do aparelho.
- A fila SQLite continua criptografada. Operações offline ficam pendentes e
  sincronizam na reconexão. As respostas usam comparação de revisão e payload
  para não apagar uma edição feita durante o envio.
- A consulta antiga do histórico não pode rebaixar uma versão já confirmada
  nem substituir uma mudança pendente. Essa disputa foi encontrada na conferência
  Android, corrigida no cache/merge e incluída na regressão automatizada.
- Conflitos preservam a cópia local e mostram que o servidor mudou. A reaplicação
  exige revisão e novo salvamento; aceitar a versão do servidor arquiva a cópia
  local. Versão cancelada no servidor não admite reaplicação de edição.
- A identidade do alerta continua sendo a identidade da ocorrência. Editar ou
  cancelar não cria novo alerta nem apaga o estado de leitura do coordenador.
  Cancelamento antes do primeiro envio fica registrado, sem novo alerta de caso.
- Os detalhes incluem consulta de histórico com UID, versão, data e antes/depois.
  ACS consulta apenas próprias; coordenador consulta todas, com a autorização
  efetiva aplicada pelas regras do Firestore.

## Segurança local e testes

Regras validadas localmente e **publicadas após autorização**, SHA-256:
`2723353f8f3e7f667b10156e33f2f6e3ce72192041d623b99fd62af24caff8e1`.

Preservados: esquema/limites, papéis provenientes do perfil protegido,
criação pública de conta apenas ACS, proibição de elevar papel pelo cliente,
UID/ID/criação imutáveis, compatibilidade com campos legados inalterados,
transações com auditoria obrigatória, revisão crescente, idempotência,
eventos imutáveis, situação cancelada terminal e negação padrão.

O Firebase Emulator Suite usou exclusivamente `demo-sismorcego-spark`, Auth em
`127.0.0.1:9099` e Firestore em `127.0.0.1:8088`. As suítes de regras executam
operações reais no emulador, incluindo tentativas maliciosas; os testes de fluxo
usam Auth real do emulador, SDK do Firestore e SQLite/AES reais, substituindo
somente as fronteiras nativas do ambiente Node. Não são apenas mocks de regras.

| Verificação | Resultado |
|---|---|
| App: `npm test -- --runInBand` | **292 testes, 34 suítes aprovadas** |
| Firebase: `npm run test:firebase:running` | **57 testes, 2 suítes aprovadas** |
| `npm run test:firebase` com inicialização/encerramento próprios | 57 aprovados; execução anterior à última regressão de cache |
| ESLint nos arquivos desta correção | 0 erros; 9 avisos de estilos inline |
| `git diff --check` | Aprovado; avisos locais de normalização LF/CRLF |
| Android x86_64: Debug, Homologação e Emulador | BUILD SUCCESSFUL |
| Android universal: Debug e Homologação | BUILD SUCCESSFUL |

Os 15 cenários solicitados estão cobertos: alterações próprias de ACS e
coordenador; negação de alterações de terceiros (inclusive coordenador para outro
coordenador); leitura de supervisão; adulteração de UID/ID/proprietário/autoria;
offline/reconexão; histórico; cancelado terminal; legados e alertas sem duplicação.
As tentativas de remover/forjar auditoria, repetir revisão, atualizar esquema
inválido, exceder limites, elevar papel e excluir ocorrência foram negadas.
A revisão de segurança está em `evidencias-propriedade/auditoria-regras.json`.

## Conferência Android

APK separado `com.sismorcego.emulador`, conectado ao projeto demo com destinos
locais fixos (`10.0.2.2` no Android). Não há fallback para o Firebase real.
As contas e três ocorrências dessa conferência são fictícias. Os pacotes Debug
e Homologação existentes ficaram fechados durante os testes de escrita.

Foram verificados os botões próprios, ausência de ações para terceiros, consulta
da auditoria de outro coordenador, responsável original desabilitado no editor,
justificativa obrigatória, voltar do Android sem confirmar cancelamento,
edição/cancelamento com Wi-Fi e dados desligados e sincronização ao reconectar.
A edição foi preservada também após reabrir o app. As transições existentes de
entrada/saída e a preferência de movimento reduzido foram preservadas.

Resultado final: `native-owned` permaneceu com o mesmo ID, município Marapanim,
justificativa preservada, situação cancelada e revisão 3. Sua auditoria contém
criação/edição/cancelamento nas versões 1/2/3, todas com `actorUid: coord-native`.
As duas ocorrências de terceiros permaneceram ativas na revisão 1. O total de
ocorrências e o indicador de alertas ficaram em 3, antes e depois. A coleta final
do PID do APK não retornou erros AndroidRuntime/ReactNativeJS.

Evidências: `evidencias-propriedade/validacao-android.json`, snapshots completos
antes/depois da reconexão e capturas próprias/terceiros/cancelamento/auditoria.
Os logs de testes e compilação estão na mesma pasta. Wi-Fi/dados do Android
foram restabelecidos e os servidores Firebase locais encerrados ao concluir.

## Arquivos desta correção

| Área | Arquivos |
|---|---|
| Propriedade e mutação | `src/services/recordLifecycle.js`, `recordMutations.js`, `registroAdapter.js`, `recordSyncProtocol.js` |
| Fila/cache/alertas | `src/services/offlineQueue.js`, `historico.js`, `coordinatorInbox.js` |
| Consulta da auditoria | `src/services/recordAudit.js` (novo), `src/ui/RecordAuditTrail.js` (novo) |
| Interface e tela anterior | `src/navigation/SismorcegoShell.js`, `src/ui/RecordDetailsModal.js`, `src/pages/Main/Buscar.js`, `src/pages/Main/buscar/RegistroCard.js` |
| Regras locais | `firestore.rules` |
| Ambiente Android isolado | `src/services/appEnvironment.js`, `debugTestSession.js`, `firebase.js`; `android/app/build.gradle`; `android/app/src/main/java/com/sismorcego/SismorcegoBuildPackage.kt`; `android/app/src/emulator/AndroidManifest.xml` (novo) |
| Testes do app | `__tests__/recordOwnership.test.js`, `recordAuditTrail.test.js` (novos); `recordFlows.test.js`, `offlineQueueLifecycle.test.js`, `adminShellIntegration.test.js`, `appEnvironment.test.js` |
| Integração Firebase | `emulator-tests/spark.test.js`, `ownershipFlows.test.js` e `sqliteBoundary.cjs` (dois últimos novos) |
| Infraestrutura local | `scripts/run-firebase-emulators.cjs`, `scripts/test-firebase-emulators.cjs`, `scripts/seed-record-ownership-emulator.cjs` (novo), `firebase.json` com Auth Emulator |
| Entrega/evidências | Este relatório, `docs/evidencias-propriedade/` e assets/bundle regenerados para os APKs |

Os demais arquivos que já estavam modificados no checkout foram preservados;
essa lista descreve a intervenção desta etapa, não todo o diff acumulado.

## APKs

- Debug universal: `android/app/build/outputs/apk/debug/app-debug.apk`.
- Homologação universal: `android/app/build/outputs/apk/homologation/app-homologation.apk`.
- Teste Android local: `android/app/build/outputs/apk/emulator/app-emulator.apk`.

Debug conserva o modo de teste local preexistente; Homologação conserva o login
real. O APK Emulador é exclusivo dos dados fictícios. Nenhum APK foi instalado
no aparelho físico nesta etapa.

## Limitações e autorização pendente

- Publicação concluída após autorização explícita, com o comando
  `firebase deploy --only firestore:rules --project sismorcego-50b25`.
  A compilação e a liberação foram confirmadas pelo CLI; uma leitura posterior
  das regras ativas confirmou o mesmo conteúdo validado. O faturamento segue
  desabilitado. Evidências em `evidencias-propriedade/publicacao-regras-2026-10-29.json`
  e no log de mesmo nome. O compilador emitiu dois avisos de tipos opcionais/
  ramos de ternário (linhas 120 e 147), sem impedir compilação ou publicação.
  Testes de escrita no Firebase real dependem de autorização específica;
  nenhuma ocorrência real foi alterada para testar a publicação.
- Histórico anterior à implementação da auditoria não é inventado. Offline, o
  proprietário consulta a última página confirmada em cache e alterações locais;
  auditoria de terceiros exige conexão. Páginas anteriores são consultadas online.
- O Android API 37 exibiu aviso preexistente de compatibilidade de bibliotecas
  nativas com páginas de 16 KB; executou em modo de compatibilidade. A compilação
  também mantém avisos de APIs/Gradle depreciados. Corrigi-los exige uma etapa
  própria de atualização das dependências nativas.
- Nenhuma regra pode comprovar a veracidade do conteúdo declarado pelo usuário.
  As validações asseguram a identidade autorizada, a estrutura e a rastreabilidade
  das transações testadas. A avaliação não equivale a garantia absoluta de segurança.
- A única publicação desta fase foi a das regras do Firestore, autorizada
  explicitamente depois da entrega local. Não houve alteração de faturamento,
  habilitação de Functions, Storage ou serviços pagos. Nenhuma conta ou ocorrência real foi criada,
  editada, cancelada ou excluída, inclusive as três ocorrências antigas. O backup
  anterior, o cadastro público e as alterações preexistentes foram preservados.
  Não houve commit, push, reset ou rebase.
