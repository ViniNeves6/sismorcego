# Área de perguntas e barra inferior

Correção local de 29/10/2026.

Atualização: a rolagem da página inteira descrita abaixo foi substituída pelo
histórico fixo com rolagem interna em `docs/correcao-duvidas-scroll.md`.

## Mudança

- `src/pages/Extras/MaisScreens.js`: removidos a altura fixa de 360 e o scroll
  aninhado da lista. O quadro agora acompanha seus cards, e a tela inteira usa
  uma única rolagem com a barra roxa já existente no aplicativo.
- A área útil termina antes dos 94 pontos ocupados pelo menu, somados ao inset
  inferior do aparelho. A margem de fim do conteúdo fica dentro dessa área.
- Status/data e ações do card podem quebrar linha em larguras menores.
- `src/navigation/SismorcegoShell.js`: fornece o inset inferior real à tela Mais.
- As ações de enviar, expandir, excluir, cancelar e voltar foram preservadas,
  assim como as transições existentes e a preferência de movimento reduzido.

## Verificação

- 25 testes aprovados em 3 suítes existentes: redesignScreens,
  duvidasNotifications e spotlightFeatures.
- ESLint dos dois arquivos: nenhum erro; 19 avisos de estilos inline.
- Bundle atualizado. Compilações Android Emulador x86_64 e Debug/Homologação
  universais concluídas com BUILD SUCCESSFUL.
- Logs em `docs/evidencias-duvidas-layout/`.
- A conferência visual em duas alturas não foi concluída: o emulador principal
  estava sendo usado, e a instância separada encontrou pouca memória disponível.
  A instância separada foi encerrada. A revisão automática bloqueou a limpeza de
  seus arquivos temporários com a mensagem "blocked by policy", sem mais detalhes.
  Os arquivos foram mantidos em `tmp/pdfs/SismorcegoLayoutQA.avd` e o registro
  `C:/Users/bradg/.android/avd/SismorcegoLayoutQA.ini`.

## APKs atualizados

- `android/app/build/outputs/apk/debug/app-debug.apk`
- `android/app/build/outputs/apk/homologation/app-homologation-duvidas-layout.apk`
  (cópia da compilação universal, com nome próprio para preservar esta entrega)

Nenhuma regra, conta ou ocorrência do Firebase real foi alterada nesta correção.
Os únicos dados de teste criados foram dúvidas fictícias no Firebase Emulator
Suite, projeto `demo-sismorcego-spark`. Os servidores locais foram encerrados.
