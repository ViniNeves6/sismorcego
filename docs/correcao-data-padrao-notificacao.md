# Data de hoje por padrão em Nova notificação

Correção de 29/10/2026 em `src/navigation/SismorcegoShell.js`.

O passo 3 recebe a data local de hoje preenchida em `DD/MM/AAAA`. Ao abrir o
calendário, o mesmo dia já fica selecionado. O estado e o registro salvo usam
o correspondente `AAAA-MM-DD`, calculado pelos componentes locais de data do
aparelho, sem conversão para UTC.

Um formulário novo recalcula hoje quando é aberto, inclusive se o aplicativo
ficou na tela inicial desde o dia anterior. Limpar os campos também recalcula
a data. Após salvar uma ocorrência, a próxima começa com a data atual quando
for aberta. Durante um preenchimento em andamento, a data é preservada ao
alternar abas ou abrir os dados da vítima; o usuário pode alterá-la pelo
calendário. A edição de ocorrências existentes mantém a data do registro.

## Conferência

Foram adicionados seis cenários de integração: padrão de hoje e seleção do
calendário, primeira abertura em outro dia, preservação da escolha manual,
limpeza após mudança de dia, limpeza após mudança de ano e salvamento seguido
de abertura de outra ocorrência em dia posterior.

A suíte completa foi executada com `TZ=America/Fortaleza`, incluindo o horário
local de 23h55, quando UTC já representa o dia seguinte. Nenhum fuso foi fixado
no aplicativo: ele continua seguindo o relógio local do aparelho.

Resultado da suíte completa: 374 testes aprovados em 40 suítes.

ESLint dos arquivos alterados sem erros, com um aviso preexistente de estilo
inline. Resultados, logs e conferência do APK estão em
`docs/evidencias-data-padrao-notificacao/`.

APK universal de homologação:
`android/app/build/outputs/apk/homologation/app-homologation-data-hoje.apk`.
