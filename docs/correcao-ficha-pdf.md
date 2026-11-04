# Ficha em PDF — 29/10/2026

A exportação usava uma API antiga (`convert`) que não existe no módulo instalado,
e sempre acionava uma ficha simplificada. Agora utiliza `generatePDF` e um HTML
próprio com a identidade Sismorcego, Plus Jakarta Sans incorporada, seções de
notificação/local, vítima e georreferenciamento, fotografia proporcional ao final,
rodapé e numeração de páginas. A alternativa vetorial offline mantém a identidade,
quebra textos extensos e limita a imagem à área útil.

A prévia tem cabeçalho de bottom sheet: alça, cantos arredondados, título à
esquerda e ações de baixar e fechar. As opções terminam de fechar antes da
entrada da prévia; o documento permanece montado durante sua saída. O botão
Voltar e a preferência de movimento reduzido são respeitados.

O download Android usava uma API de documentos inexistente e acabava abrindo um
compartilhamento de texto. `SismorcegoDocumentsModule` agora usa
`ACTION_CREATE_DOCUMENT` e copia o PDF do cache para o destino escolhido, sem
pedir permissão de armazenamento. Cancelar preserva a prévia. O compartilhamento
alternativo usa `react-native-share`, anexando o arquivo como `application/pdf`.

Validação:

- 270 testes do aplicativo, incluindo geração nativa, fallback, privacidade,
  textos extensos, fotografia vertical e transições da prévia.
- PDFs HTML, vetoriais e gerados pelo Android renderizados e inspecionados.
  Plus Jakarta Sans Regular/Bold confirmadas dentro do PDF nativo.
- Emulador: abrir registro real em consulta, gerar ficha, abrir prévia, cancelar
  download, voltar e salvar em Downloads. O arquivo salvo foi reaberto e validado
  quanto a conteúdo, identidade Sismorcego e número de páginas.
- APKs debug e homologação compilados e atualizados no emulador; versões
  universais disponíveis nos diretórios de saída usuais.

Os registros de origem não foram editados por esta correção. As opções de ocultar
nomes (incluindo apelidos) e coordenadas continuam disponíveis.
