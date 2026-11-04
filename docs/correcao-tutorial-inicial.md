# Tutorial inicial antes do carregamento

Correção de 29/10/2026.

## Comportamento

Na primeira abertura, o aplicativo mostra o guia sem consultar ou sincronizar
ocorrências, assinar alertas/dúvidas, carregar rascunhos/perfil local ou consumir
uma abertura pendente por notificação. A pausa começa antes da leitura da
preferência do tutorial e cobre também os 500 ms de espera pela sua apresentação.
O aplicativo mantém a sessão e o papel autenticado necessários para escolher os
passos de ACS ou coordenador.

O tutorial usa as telas vazias. Não foram inseridos registros demonstrativos no
banco. A navegação entre os passos continua disponível; entrar em Notificar não
cria a identidade de um rascunho, e o painel sem coordenadas não inicializa o SDK
do mapa. Os indicadores de carregamento de dados ficam desativados nessa fase.

- **Pular:** salva a preferência e libera os dados após a saída do guia.
- **Concluir:** aguarda a saída do guia e, quando exibida, a saída da tela de
  boas-vindas. Então abre Registros e inicia o carregamento normal.
- **Fechar o app durante o guia:** o tutorial continua pendente na próxima abertura.
  Apenas abrir o guia deixou de marcá-lo como concluído.
- **Usuário que já concluiu ou pulou:** carrega normalmente após verificar a
  preferência. Reabrir o guia pelo menu não pausa consultas ou sincronização.
- **Falha na leitura da preferência:** oferece o guia e mantém os dados pausados.

Os listeners de reconexão, retorno ao primeiro plano e alteração de registros só
são ativados depois da liberação. Os callbacks de atualizar/sincronizar também
verificam a pausa, para que um gesto ou callback retido não antecipe esse trabalho.
Depois da liberação, a sincronização segue o fluxo existente de conectividade,
inclusive preservando os registros pendentes quando não houver conexão.

## Transições

As animações existentes de entrada/saída foram preservadas. A liberação ocorre no
callback de término da saída, tanto com movimento reduzido quanto com animação.
O fechamento/voltar continua passando pelos mesmos handlers do guia e das
boas-vindas. Um guia inicialmente invisível deixou de emitir um encerramento na
montagem, que poderia antecipar a liberação dos dados.

## Arquivos

- `src/navigation/SismorcegoShell.js`: controla a liberação inicial e adia os
  carregamentos, listeners e a criação do rascunho.
- `src/hooks/useCoordinatorAlerts.js`, `useCoordinatorNavigation.js`,
  `useCoordenadorNotifications.js` e `useNotifications.js`: aceitam a pausa sem
  iniciar suas consultas ou consumir notificações pendentes.
- `src/ui/SpotlightGuideModal.js`: não persiste conclusão ao abrir e só executa
  a saída quando o guia estava montado.
- Testes de integração do Shell, permissões/notificações e ciclo de vida do guia.

## Validação e entrega

**318 testes aprovados em 36 suítes**, incluindo 14 novos cenários sobre a pausa,
conclusão, pulo, boas-vindas, interrupção/reabertura, erro de armazenamento,
desmontagem e reprodução posterior do tutorial. Os testes existentes de voltar,
movimento reduzido e retenção do conteúdo durante a saída também passaram.
ESLint sem erros; seis avisos preexistentes nos arquivos analisados.

Compilações universais Debug e Homologação concluídas. O APK foi conferido nas
quatro arquiteturas e o hash do JavaScript empacotado corresponde ao bundle da
entrega. Logs e conferência em `docs/evidencias-tutorial-inicial/`.
Não houve teste manual em aparelho/emulador nesta etapa.

APK:
`android/app/build/outputs/apk/homologation/app-homologation-tutorial.apk`.

Esta alteração não publicou regras nem alterou dados ou configurações do
Firebase real.
