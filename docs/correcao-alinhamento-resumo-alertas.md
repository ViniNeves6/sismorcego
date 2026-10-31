# Alinhamento do resumo de alertas

Data: 30/10/2026.

O card “Alertas não lidos” tinha borda de 1,5 ponto somente quando havia alertas pendentes. Isso alterava o espaço interno entre os estados. A centralização vertical também deslocava título e contador quando a descrição mais longa ocupava outra linha.

A borda agora ocupa o mesmo espaço nos dois estados, sendo transparente no estado neutro. Título, descrição e contador ficam ancorados pelo topo, com espaçamento e alturas de linha comuns. O contador tem largura mínima e algarismos tabulares para evitar a diferença de largura entre zero e um. A descrição continua podendo quebrar de linha, e as preferências de contraste e fonte permanecem ativas.

Verificação: 51 testes aprovados nas quatro suítes de Alertas, telas administrativas, acessibilidade das telas e redução de movimento. ESLint sem erros, com um aviso preexistente de estilo inline. Nenhuma animação foi acrescentada ou alterada. Não houve conferência visual no aparelho nesta rodada.

APK universal: `android/app/build/outputs/apk/homologation/app-homologation-alertas-alinhamento.apk`.

Hashes, confirmação do bundle empacotado e arquiteturas: `docs/evidencias-alinhamento-alertas/verificacao.json`. Logs e resultados dos testes estão na mesma pasta.

## Descrição compacta

A descrição do estado com alertas foi encurtada para “Novos alertas para leitura”, evitando a quebra adicional mostrada no aparelho. Essa revisão altera somente o texto. Os 31 testes de Alertas e acessibilidade das telas passaram.

APK desta revisão: `android/app/build/outputs/apk/homologation/app-homologation-alertas-texto-compacto.apk`.
