# Botões das ações da ocorrência em telas pequenas

Correção de 29/10/2026 em `src/ui/RecordDetailsModal.js`.

Os textos dos botões Cancelar ocorrência, Editar, Cancelar, Salvar alterações,
Fechar e Confirmar cancelamento agora têm alinhamento central e altura de linha
definida. Os botões têm margem interna de 10 pontos na vertical e 12 na
horizontal. Continuam lado a lado e podem crescer na vertical para acomodar
textos em mais de uma linha, mantendo a mesma altura dentro de cada par.

A borda transparente do botão primário iguala a espessura dos demais botões e
garante larguras iguais. A fonte permanece no tamanho original, com suporte à
escala de acessibilidade. A correção não altera ações, permissões ou animações.

## Conferência

- 352 testes aprovados em 39 suítes existentes. Não foram adicionados testes
  unitários para espelhar os estilos.
- ESLint: nenhum erro e 8 avisos de estilos inline já existentes.
- 72 cenários de geometria com Yoga 3.2.1: larguras de tela de 280, 300, 320,
  360, 393 e 430; escala de fonte de 100%, 130% e 150%; ações de consulta,
  edição, confirmação de cancelamento e fechamento. Verificados largura e altura
  iguais dos pares, centralização e margens dos textos sem recorte.
- A medição usa os avanços dos caracteres da fonte PlusJakartaSans-ExtraBold
  incluída no aplicativo. A composição de texto do Android pode diferir dessa
  aproximação. Não houve conferência visual em aparelho físico nesta etapa.

Verificador, métricas e logs em `docs/evidencias-botoes-ocorrencia/`.

APK universal de homologação:
`android/app/build/outputs/apk/homologation/app-homologation-botoes-ocorrencia.apk`.

Dados da conferência do APK e do bundle:
`docs/evidencias-botoes-ocorrencia/apk-verificado.json`.
