# Modelo e consultas da homologação Spark

Base da implementação: auditoria real de 29/10/2026, projeto sismorcego-50b25. Regras propostas dependem de aprovação antes de publicação. Backup em backups/firestore-publicado-2026-10-29.rules.

- usuarios/{uid}: email opcional e role acs/coordenador; somente dono lê seu perfil; cliente cria apenas ACS e nunca altera role.
- registros/{uid}/itens/{recordId}: leitura pelo dono ou coordenador; escrita só pelo dono, sem delete. Identidade, criação e primeira recepção imutáveis. serverRevision numérico e lastMutationId para concorrência/idempotência; lastAuditId referencia evento atômico. Edição/cancelamento precisa de auditoria. Legados continuam legíveis e entram no protocolo na primeira edição autorizada.
- alteracoes/{eventId}: eventos imutáveis por lote sincronizado, autor autenticado, snapshot antes/depois e eventos locais; getAfter vincula a revisão da ocorrência. Nenhuma imagem base64 nova.
- usuarios/{coordenador}/leiturasOcorrencias/{stateId}: somente o coordenador dono; referência a uma ocorrência existente, lida booleana e updatedAt do servidor. O estado não cria ou altera a ocorrência; alertas são derivados da consulta real de itens.
- usuarios/{uid}/notificacoes/{id}: feed legado preservado; leitura do dono coordenador, atualização apenas lida. ACS sem acesso.
- dispositivos: FCM permanece desligado; nenhum registro de token nesta fase.
- duvidas/{id}: próprio autor e coordenador leem perguntas pessoais; respostas publicadas explicitamente podem ser lidas por autenticados. Só coordenador responde/publica; autor não troca userId nem resposta.

Consultas: histórico ACS em registros/uid/itens com updatedAt desc; coordenador collectionGroup(itens) com updatedAt desc. Central Spark escuta collectionGroup(itens) e coleção própria de leituras, sem polling e sem duplicar documentos de alerta. Dúvidas próprias com where(userId == uid), públicas com where(publicada == true), coordenador consulta todas. Feed legado ordenado por createdAt desc. Leitura de papel é get do próprio usuarios/uid.

Foto de perfil e novas fotos de ocorrência ficam locais. Imagens legadas no Firestore permanecem legíveis e não são substituídas/removidas. Homologação usa aplicativo Android separado; debug/release mantêm o modo local existente.
