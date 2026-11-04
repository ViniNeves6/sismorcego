# Indicador único de atualização

Correção de 29/10/2026 para o indicador adicional que deslocava os cards.

- `src/pages/Main/RegistrosScreen.js`: removido o ActivityIndicator que entrava
  no fluxo antes do card de armazenamento offline. O RefreshControl sobreposto
  e a ação de puxar para atualizar foram preservados.
- `src/pages/Admin/AdminAlertsScreen.js`: removido o segundo indicador e seu
  espaço vertical. Os alertas existentes continuam visíveis durante o refresh,
  e o estado vazio só aparece depois que o carregamento termina.
- `src/pages/Main/Buscar.js` e `src/pages/Extras/Duvidas.js`: as telas anteriores
  também usam apenas o indicador nativo sobreposto, inclusive na carga inicial.
  Removidos os blocos extras de carregamento dentro do conteúdo.
- Indicadores de ações como sincronização, envio, GPS e PDF foram preservados.

## Validação

44 testes aprovados em 5 suítes existentes: redesignScreens, coordinatorScreens,
coordinatorAlertsIntegration, duvidasNotifications e pdfViewerTransitions.
ESLint dos quatro arquivos sem erros, com dois avisos de estilos inline.
`git diff --check` aprovado (avisos locais de normalização LF/CRLF).
Bundle atualizado e compilação Debug/Homologação universal executada.
Logs em `docs/evidencias-refresh-unico/`.

APK desta entrega:
`android/app/build/outputs/apk/homologation/app-homologation-refresh-unico.apk`.

Não houve alterações no Firebase real nem operações em contas ou ocorrências.
Nenhuma nova instância de emulador foi iniciada para esta correção.
