# Descrição do abrigo somente para Outro

Correção de 29/10/2026 em `src/services/sismorcegoData.js`.

A condição do campo `hv-desc` (Descreva o abrigo) passou a depender de
`hv-tipo = Outro`. Antes dependia apenas de haver abrigo no local, mostrando a
descrição também para Natural e Artificial.

Essa definição é compartilhada pelos formulários de nova notificação e edição
de ocorrência do redesign. As animações existentes de entrada e saída do campo
foram preservadas, incluindo redução de movimento. Ao mudar para outro tipo de
abrigo ou responder que não há abrigo, a limpeza de campos dependentes já
existente remove a descrição do formulário.

Verificados no formulário: tipo ainda vazio, Natural, Artificial, Outro,
digitação da descrição, mudança para Artificial, retorno a Outro sem texto
antigo, resposta Não ao abrigo e avanço para o campo revelado por Outro.

Suíte completa: 376 testes aprovados em 40 suítes.

Os testes novos estão em `__tests__/formAutoAdvance.test.js`. Logs e conferência
do APK estão em `docs/evidencias-descricao-abrigo/`. ESLint dos arquivos
alterados sem erros ou avisos.

APK universal de homologação:
`android/app/build/outputs/apk/homologation/app-homologation-abrigo-outro.apk`.
