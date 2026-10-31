# Alertas, ciclo dos registros e cadastro — preparação do aplicativo

Atualizado em 29/10/2026. Implementação local no projeto `sismorcego-redesign`.

## Estado da entrega

O aplicativo foi preparado para o fluxo abaixo. A geração e distribuição reais de alertas **ainda não estão operacionais**: dependem de servidor, regras e FCM. A foto de perfil continua local. Nenhum serviço foi habilitado, nenhuma conta/documento real foi alterado, nenhuma regra foi publicada e nenhum deploy, commit ou push foi executado nesta tarefa.

`LOCAL_TEST_MODE = true` e `LOCAL_TEST_ROLE = 'acs'` permanecem no arquivo original. O novo `FIREBASE_PUSH_BACKEND_READY = false` impede registro de tokens e execução de handlers FCM enquanto o backend não for revisado. Autenticação real continua bloqueada no modo local. Testes com mocks não demonstram entrega real de push.

## 1. Estrutura encontrada no código local

| Local | Uso atual |
| --- | --- |
| Authentication | UID, e-mail, `displayName`, eventual `photoURL` HTTPS |
| `usuarios/{uid}` | E-mail e papel `acs`/`coordenador`; novas contas recebem `acs` |
| `registros/{uidAcs}/itens/{recordId}` | Ocorrência, vítima, agente, município/localidade, detalhes, datas, localização e foto da ocorrência |
| `usuarios/{uidCoordenador}/notificacoes/{alertId}` | Feed existente, incluindo `uidAcs`, `registroId`, `createdAt`, `lida` e metadados disponíveis |
| `duvidas/{duvidaId}` | Pergunta, autor e resposta; preservado |
| SQLite `offline_queue_v2` | Payload criptografado e metadados da fila, com chave composta `(uid, recordId)` |
| AsyncStorage por UID | Foto local, preferência de notificações, papel em cache, identidade do rascunho e toque pendente em notificação |

A fila anterior `offline_queue` é migrada numa transação SQLite. Os payloads existentes são copiados sem descriptografar/regravar; a tabela anterior só é removida dentro da mesma transação. UID ausente é preservado como chave vazia, sem atribuir o registro a outro agente. Isso não recupera colisões já ocorridas na versão antiga.

As consultas administrativas ainda usam o histórico limitado existente, até 500 documentos, enquanto o feed de alertas não recebeu limite ou exclusão por idade. Para indicadores globais acima desse volume, será necessário revisar paginação/agregação no servidor. A edição do Firestore e a configuração efetivamente publicada não foram consultadas; deverão ser confirmadas na etapa de infraestrutura. O app mantém a API Core já utilizada pelo projeto, sem trocar instância/edição.

## 2. Identidade, sincronização e edições

Ao entrar em Notificar, o app obtém um ID aleatório permanente, persistido por UID junto da data de início do rascunho. Ele é reutilizado em tentativas de salvar e depois de reiniciar o processo. Só é descartado após a gravação local concluir. A persistência dos demais campos do formulário não foi ampliada nesta tarefa.

A identidade completa é `(uidAcs, recordId)`. O caminho no Firestore não muda em edição ou reenvio. A mesclagem de histórico, o cache e as operações da fila consideram o proprietário. O ID não é mais substituído por um novo ID no momento de salvar.

A sincronização preparada usa transação: lê o documento, grava a mesma ocorrência e seus eventos de auditoria de forma atômica. Se falhar, a fila continua pendente/com erro. Um reenvio não cria outro documento. `localRevision` protege a fila contra respostas de uma versão anterior. A reivindicação do envio compartilha a trava da edição/exclusão local, evitando enviar um registro removido antes do início da transmissão.

As datas têm significados distintos:

- `dataAgressao`/`dataMordedura`: data da ocorrência informada no formulário.
- `dataRegistro`/`createdAt`: criação local, baseada no relógio do aparelho.
- `serverReceivedAt`: primeira recepção, com relógio do servidor; não muda no reenvio.
- `updatedAt`: última atualização no servidor.
- `clientRevision`: revisão local enviada.

Na central, a data do cartão usa a recepção quando disponível. Alertas legados continuam usando seu próprio `createdAt`/`dataHora`; o cliente não transforma a data da mordedura ou criação local em data de recebimento. Não é possível reconstruir a recepção exata de documentos históricos apenas com os campos antigos.

O ACS pode editar seus registros ativos. A edição atualiza a fila/documento existente e cria eventos com ID da revisão, autor, horário local e valores antes/depois. Campos de foto são identificados por hash e MIME, sem repetir base64 no histórico. O conteúdo das fotos anteriores não é versionado pelo aplicativo; se a auditoria precisar preservar os arquivos, será necessário versioná-los no Storage.

## 3. Exclusão local e cancelamento

Um registro novo, com versão de ciclo 2 e sem tentativa de envio/cópia remota, é removido da fila. Respostas atrasadas não recriam a linha. Uma edição atrasada de um registro local já excluído é rejeitada.

Depois que um envio foi iniciado, sua confirmação pode ser incerta. O app conserva `serverWriteAttempted` e passa a exigir cancelamento, mesmo que o aparelho tenha perdido a confirmação. Registros legados sem metadados suficientes também são tratados conservadoramente como possivelmente enviados. Isso evita apagar o único histórico de um caso que já possa estar no servidor.

O controle usa o diálogo existente e exige motivo. O documento é preservado com:

```text
lifecycleStatus: active | cancelled
cancellation: { actorUid, actorName, reason, clientAt, serverAt }
```

Cancelados ficam disponíveis para consulta, com situação/motivo/responsável/data, e deixam de entrar em KPIs, gráfico e mapa de casos ativos. Não são reabertos pelo editor. O alerta continua no histórico e consulta o estado atual do documento.

Exclusões físicas antigas já enfileiradas (`syncAction: delete`) não são executadas. A linha volta a ficar consultável, com erro explicativo; o responsável pode convertê-la em cancelamento informando o motivo. Casos com essa operação antiga também ficam fora dos indicadores ativos. Documentos que já tenham sido apagados antes desta alteração não podem ser recuperados pelo cliente.

## 4. Auditoria proposta para o Firestore

O cliente prepara `registros/{uid}/itens/{recordId}/alteracoes/{eventId}`:

```text
eventId = localRevision
action = edit | cancel
actorUid, actorName
clientAt, receivedAt
changes = { campo: { before, after } }
reason (quando aplicável)
```

Eventos ficam criptografados na fila enquanto não forem confirmados. Na transação, um evento já existente não é regravado. Após a confirmação, a lista de eventos pendentes é limpa localmente; o histórico permanente deverá estar nessa subcoleção. A interface de histórico completo de edições não foi adicionada.

**Bloqueio esperado até a revisão:** o arquivo local de regras ainda não autoriza essa nova subcoleção. Um envio com auditoria poderá ser negado quando o modo real for habilitado. A transação não deverá gravar metade da operação. Não habilitar produção antes de configurar e testar essa autorização.

Para auditoria confiável, recomenda-se validar revisão/base e alterações no servidor, adicionar autor autenticado e horário confiável e impedir adulteração/exclusão de eventos. O log calculado no cliente ajuda na integração, mas sozinho não é prova independente. Conflitos simultâneos entre dois aparelhos do mesmo ACS precisam de política de revisão no servidor; não há mesclagem automática entre aparelhos nesta entrega.

## 5. Geração automática e idempotência dos alertas — servidor pendente

Removida a geração por varredura/BackgroundFetch no celular do coordenador. O app não cria alertas administrativos. A função de checagem antiga retorna explicitamente que a integração de servidor é necessária.

Implementar no servidor um gatilho de **criação** em `registros/{uidAcs}/itens/{recordId}`, para todas as vítimas humanas e animais, sem filtrar por município ou excluir o ACS remetente. Edições e cancelamentos não são novas ocorrências e não devem disparar outro alerta de criação.

O destinatário deve vir da lista de coordenadores autorizados determinada pelo servidor. Para cada destinatário, criar uma entrada própria:

```text
alertId = SHA256(JSON.stringify([uidCoordenador, uidAcs, recordId]))
usuarios/{uidCoordenador}/notificacoes/{alertId}
recipientUid, uidAcs, registroId, tipoVitima, municipio,
localidade, nomeAcs, serverReceivedAt, createdAt, lida: false
```

`alertContract.js` contém esse contrato puro, sem acesso administrativo ou disparo no cliente. O servidor deve usar transação/create-if-absent. Ao repetir um evento, preservar a entrada existente, inclusive `lida`; nunca substituir por `lida: false`. Dois coordenadores têm documentos diferentes e leituras independentes. Cinco ocorrências criam cinco entradas por coordenador, mesmo quando sincronizadas de uma vez.

Os gatilhos podem ser entregues mais de uma vez e fora de ordem; a idempotência é obrigatória também no servidor. [Documentação dos gatilhos Firestore](https://firebase.google.com/docs/functions/firestore-events).

Antes da ativação, migrar/reconciliar IDs legados (`uidAcs_recordId`) com os novos IDs, preservando a leitura e evitando entradas paralelas. Nenhuma migração real foi executada. Para muitos coordenadores, usar trabalho paginado e outbox persistente por destinatário; o gatilho não deve depender de uma única execução longa.

Não foi adicionada expiração/TTL nem exclusão de alertas lidos. Leitura individual/todos continua sendo atualização de estado no documento do destinatário. A política legal de retenção permanece uma decisão separada.

## 6. Tokens, push e navegação — integração preparada

O SDK FCM já existia nas dependências; não foi instalado serviço novo. Com a integração futura habilitada, o cliente prepara:

- Permissão Android e canal existentes; preferência por usuário e autorização do sistema.
- Registro inicial e renovação do token por instalação/usuário.
- Recepção em primeiro plano, handler headless, abertura em segundo plano e início por notificação.
- Toque pendente persistido pelo destinatário e abertura da ocorrência por `uidAcs` + `registroId`.
- Revalidação do perfil e destinatário; ACS não acessa Painel/Alertas por callback ou toque.
- Ao abrir um alerta, nova consulta para obter edição/cancelamento recente. Uma cópia já carregada só serve de fallback em indisponibilidade de rede, não em negação de acesso.
- Logout/perda de perfil/preferência desativada desassociam o aparelho e invalidam o token. Falha de desassociação deixa uma pendência local; o servidor também precisa descartar tokens inválidos e validar o papel atual em todo envio.

Estrutura proposta: `usuarios/{uid}/dispositivos/{installationId}` com `token`, `enabled`, `platform` e `updatedAt`. Uma instalação tem ID persistido; operações de associação/desassociação são serializadas. Os tokens não são impressos em logs. O registro do dispositivo requer a mesma sessão autenticada do UID de destino.

O backend deve enviar mensagens **data-only**, com prioridade Android apropriada, para o cliente aplicar perfil, preferência e texto privado:

```json
{
  "type": "occurrence",
  "recipientUid": "UID_DO_COORDENADOR",
  "uidAcs": "UID_DO_REMETENTE",
  "registroId": "ID_PERMANENTE",
  "alertId": "ID_DETERMINISTICO"
}
```

Conteúdo visível: “Sismorcego — Nova ocorrência recebida” / “Toque para consultar a ocorrência.” O cliente ignora título/corpo sensíveis recebidos e usa texto genérico com visibilidade privada. O ID local da notificação é estável por alerta. Não colocar nome da vítima, nome do agente, fotografia, município ou detalhes clínicos no conteúdo da tela bloqueada. Não mandar payload `notification` sensível: em segundo plano ele pode ser exibido pelo sistema antes do código do app.

O handler headless aguarda brevemente a restauração da sessão e valida o papel no Firestore. Se não houver sessão/permissão/rede, não expõe dados; o feed continua sendo a fonte persistente após abrir o app. Data-only está sujeito às restrições do Android, Doze e fabricantes; testar em aparelhos autorizados, inclusive após reinício. Entrega push não é garantia de exatamente uma vez nem substitui o histórico. [FCM no React Native](https://rnfirebase.io/messaging/usage), [ciclo de tokens](https://firebase.google.com/docs/cloud-messaging/manage-tokens).

No servidor, usar Admin SDK/FCM HTTP v1 com identidade de serviço segura. Outbox e registros de entrega devem evitar redisparos desnecessários; tratar erros permanentes de token e remover associações antigas. Não incluir credenciais administrativas no APK. Nenhum disparo definitivo foi implementado ou testado com Firebase real.

## 7. Cadastro, nome e foto

Cadastro agora exige nome, e-mail, senha com letras/números e confirmação. Foto é opcional, com Câmera/Galeria reaproveitadas. Sem foto, o avatar mostra as iniciais. Não existe seleção de papel administrativo.

Quando a autenticação real for habilitada, `signUp` prepara `updateProfile(..., { displayName })`, salva a foto apenas no cache local do UID e mantém a criação do papel ACS existente. A abertura inicial aguarda a atualização do perfil. Nome/e-mail continuam vindo do Authentication; não foi criada uma segunda coleção de nomes contraditórios. Alterar nome atualiza a identificação do responsável para os próximos registros. Registros históricos conservam o nome registrado originalmente, para auditoria.

Minha conta mantém o nome/e-mail autenticados e a foto local. Trocar foto não submete nome/e-mail ainda não salvos. `file://` não é aceito como `photoURL` compartilhável no Authentication. O contrato `profilePhotoUploadRequest` indica `profilePhotos/{uid}/avatar.jpg`, URI local e MIME; ele não executa upload.

Futura integração Storage: redimensionar/validar imagem, enviar somente ao diretório do próprio UID, obter URL HTTPS e então atualizar `photoURL`. Manter a foto local até a confirmação; não apagar a única cópia em falha de upload. Usar armazenamento de objetos, sem base64 grande no Firestore. Para a foto acompanhar outro aparelho, ainda faltam o adaptador de upload, regras e teste de download autenticado. Definir também substituição, exclusão e versionamento dos arquivos.

## 8. Regras e infraestrutura a revisar posteriormente

O arquivo `firestore.rules` encontrado localmente permite exclusão de ocorrências por proprietário/coordenador e escrita ampla no feed pelo coordenador. **Não foi alterado nesta tarefa e não foi comparado ao backend publicado.** Antes da produção:

1. Bloquear exclusão física dos documentos de ocorrência; validar transições de cancelamento e motivo.
2. Fixar UID/recordId, validar tipos/tamanho/campos e impedir troca de proprietário, data inicial ou estado cancelado por ACS.
3. Autorizar leitura apenas ao proprietário ou coordenador autorizado; testar também `collectionGroup('itens')`.
4. Definir regras imutáveis para auditoria e autoria/horários confiáveis. Revisar a transação do cliente ou transferir operações sensíveis a endpoint autenticado.
5. Reservar criação dos alertas ao servidor; no cliente permitir apenas a alteração do próprio estado de leitura, sem trocar destinatário/ocorrência ou apagar histórico.
6. Proteger `usuarios/{uid}.role` contra autopromoção, preservando cadastro ACS e o processo administrativo que será definido depois.
7. Tokens: só o dono gerencia os próprios dispositivos; sem listagem pública. O servidor acessa para envio e revalida autorização/revogação. Revisar desassociação offline e troca de conta.
8. Storage: gravação só no prefixo do próprio UID, limite de tamanho/MIME real e leitura conforme política de privacidade; impedir fotos locais/base64 em campos destinados a URL.
9. Confirmar instância/edição/região do Firestore, índices para histórico e feed, service accounts, FCM e pacote Android. Não há `firebase.json`/`firestore.indexes.json` na raiz lida nesta tarefa.

Cloud Functions ou serviço equivalente ainda são necessários para fan-out, idempotência, outbox/push, limpeza de tokens e auditoria confiável. Não foram criadas funções implantáveis com permissão administrativa.

## 9. Plano e custos

FCM consta como produto sem custo de envio; Firestore cobra conforme uso/edição/região e Functions conforme plano e recursos. O custo cresce com ocorrências × coordenadores × dispositivos, mais consultas/auditoria. Não foi feita estimativa monetária sem volume, região e configuração. [Preços oficiais Firebase](https://firebase.google.com/pricing), [limites de Functions](https://firebase.google.com/docs/functions/quotas).

O Storage exige plano Blaze, embora possa haver franquias gratuitas; a etapa futura precisará de revisão de faturamento e orçamento. Nenhum plano foi habilitado agora. [Requisitos atuais do Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

## 10. Validação e arquivos

Os testes automatizados cobrem identidade em cinco salvamentos offline/reenvio, edição/auditoria, cancelamento, exclusão local e respostas atrasadas, isolamento por proprietário, migração SQLite real em memória, filtros/estatísticas, consulta de cancelados, navegação por perfil, contrato de alertas por destinatário, FCM/tokens com mocks, cadastro/foto/iniciais e consistência do perfil. A parte de geração/idempotência do servidor é um **teste de contrato/modelo**, não validação de um backend implantado.

Resultado final: **218 testes aprovados em 26 suítes**, executados com `npm test -- --runInBand`. ESLint dos arquivos de implementação alterados passou. `npm run android:apk` concluiu com `BUILD SUCCESSFUL`; o APK universal contém as quatro ABIs, o bundle atual e nenhuma entrada de verificação. Logs locais: `android/app/build/alerts-lifecycle-final-tests.log` e `android/app/build/alerts-lifecycle-final-build.log`.

No emulador `emulator-5554`, usando os componentes reais numa entrada temporária explicitamente identificada como teste local, foram verificados: cadastro com nome/foto opcional, iniciais `TL`, validação de e-mail/senha/confirmação, exclusão de uma linha ainda não enviada, exigência de motivo para cancelamento, persistência do cancelamento no SQLite e Voltar do Android fechando a confirmação sem fechar os detalhes. O cenário de registro enviado usou apenas um marcador local de teste; não houve sincronização com servidor nem criação de conta. Câmera/galeria e FCM foram cobertos com mocks, sem afirmar entrega/upload reais.

As duas linhas temporárias foram removidas, com confirmação de zero casos de teste restantes. A entrada temporária foi excluída do projeto e do APK final. O aplicativo normal foi reinstalado e conferido como ACS, com Registros/Notificar/Mais, histórico vazio e sem Painel/Alertas administrativos. O host temporário de desenvolvimento do emulador foi restaurado; o Metro e o aparelho físico não foram interrompidos. O hash de `debugTestSession.js` permaneceu igual ao original.

O Android do emulador exibiu o aviso de compatibilidade de bibliotecas nativas com páginas de 16 KB que já existia neste ambiente. A verificação prosseguiu no modo de compatibilidade. Corrigir o alinhamento das bibliotecas/dependências e validar em dispositivos de 16 KB é uma pendência de compilação separada; não foram trocadas dependências nesta tarefa.

Arquivos de implementação envolvidos:

- Registros: `recordLifecycle.js`, `recordDraftIdentity.js`, `recordMutations.js`, `offlineQueue.js`, `redesignData.js`, `historico.js`, `syncRegistros.js`, `registroAdapter.js`, `adminPanelData.js` em `src/services/`.
- Alertas/push: `alertContract.js`, `coordinatorAlerts.js`, `coordinatorPush.js`, `pushDevices.js`, `firebaseIntegration.js`, `notificationNavigation.js`, `notificationPreferences.js`, `notificacoes.js`, `notificacaoLocal.js`, `checagemNotificacoes.js` em `src/services/`; hooks `useCoordinatorAlerts`, `useCoordinatorNavigation`, `useCoordenadorNotifications`; `index.js` e `AdminAlertsScreen.js`.
- Cadastro/perfil: `accountProfile.js`, `useAuth.js`, `Cadastro.js`, `Avatar.js`; integração em `SismorcegoShell.js` e diálogo em `RecordDetailsModal.js`. O hook legado `useSalvarRegistro.js` também reutiliza a identidade permanente para manter as antigas telas compatíveis.
- Testes novos: `__tests__/offlineQueueLifecycle.test.js`, `__tests__/registrationProfile.test.js`, `__tests__/pushIntegrationContract.test.js`.
- Testes ajustados: `__tests__/recordFlows.test.js`, `__tests__/authSession.test.js`, `__tests__/coordinatorAlertsIntegration.test.js`, `__tests__/adminShellIntegration.test.js`, `__tests__/notificationAccess.test.js`, `__tests__/duvidasNotifications.test.js`, `__tests__/ui.test.js` e `jest.setup.js`.

Design do Painel/gráfico/mapa, barra inferior, guia, boas-vindas e demais telas preservados. Mudanças visuais funcionais restritas ao cadastro, motivo/situação do cancelamento e omissão de campos ausentes nos alertas.

## 11. Testes reais e decisões pendentes

Após autorização/configuração, validar com ACS e pelo menos dois coordenadores reais de teste: cinco casos offline; falha antes/depois do commit; reenvio; edição antes/durante/depois do envio; cancelamento sem rede; leitura independente; consulta do caso cancelado; revogação/troca de papel; tentativas de acesso a outro agente; push em primeiro plano/segundo plano/encerrado/reinício/sem permissão; renovação/logout/troca de conta offline; avatar em dois aparelhos; falha de upload; limites de documento/índices e regras com emuladores Firebase.

Decisões ainda necessárias: critérios de autorização/credenciamento de coordenadores e ACS; acesso a alertas anteriores ao credenciamento; retenção legal e de fotografias/versionamento; revisão de conflitos entre aparelhos; paginação/agregação acima do limite atual; política de reabertura de cancelados (o app não permite); resolução de registros legados sem prova de sincronização; tolerância de entrega push e orçamento. Essas decisões não impedem testar a camada local, mas precisam preceder a ativação em produção.
