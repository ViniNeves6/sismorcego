# Centralização da lua e do morcego

Correção de 29/10/2026 em `src/ui/SpotlightWelcomeModal.js`.

A lua estava posicionada em 54% da largura da composição e o morcego recebia um
deslocamento fixo de 12 pontos. Isso alinhava os dois entre si, mas deslocava o
conjunto para a direita em relação ao título e ao centro da tela.

A lua agora usa o centro da composição, que é centralizada pelo layout da tela.
O morcego usa o mesmo centro, compensando as margens transparentes do PNG pelo
centro do corpo visível. As posições são recalculadas com as medidas reais do
modal; não há uma correção específica para um modelo de aparelho. As proporções,
o voo de entrada, o movimento das asas e o fechamento foram preservados.

## Validação

- Centralização da lua e do corpo do morcego nas dimensões de layout 320×568,
  360×800, 412×915, 768×1024 e 915×412.
- Mudança entre retrato e paisagem sem reiniciar a animação de entrada.
- Testes existentes de movimento reduzido, voltar do Android, fechamento,
  reabertura e retenção durante a saída continuam aprovados.
- **324 testes aprovados em 36 suítes.** ESLint sem erros, com cinco avisos
  preexistentes nos dois arquivos analisados.
- APKs universais Debug e Homologação gerados. O APK de entrega contém as quatro
  arquiteturas e o mesmo bundle JavaScript produzido nesta etapa.

Não houve validação manual em um Galaxy S25 nesta etapa. A verificação do
alinhamento foi feita pelos testes de geometria do layout e pela inspeção do
código e da imagem original.

Evidências em `docs/evidencias-centralizacao-boas-vindas/`.

APK: `android/app/build/outputs/apk/homologation/app-homologation-boas-vindas.apk`.
