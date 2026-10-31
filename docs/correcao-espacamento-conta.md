# Espaçamento na tela Minha conta

Correção de 29/10/2026 em `src/pages/Extras/MaisScreens.js`.

O intervalo entre o card Dados pessoais e o botão Alterar senha era de 32
pontos: 16 da margem inferior do card mais 16 da margem superior do botão.
Foi adicionado um estilo específico dessa tela que zera a margem superior do
botão. Assim, esse intervalo usa os mesmos 16 pontos existentes entre o card
da foto e o card Dados pessoais. O botão de recuperação de senha, em outra
tela, mantém seu estilo.

O ajuste não depende da largura, altura, DPI ou modelo do aparelho. O fluxo
vertical e a rolagem acompanham a altura natural do conteúdo.

Conferência automatizada:

- 10 testes existentes de `redesignScreens` aprovados.
- ESLint sem erros; 18 avisos preexistentes de estilos inline.
- 72 cenários no Yoga 3.2.1: larguras de 280 a 768, alturas de 480 a 1024 e
  três variações de altura do conteúdo. Em todos, ambos os intervalos medem
  16 pontos. As alturas de conteúdo são simuladas; não houve conferência visual
  em aparelho físico nesta etapa.

Logs, verificador e resultados em `docs/evidencias-espacamento-conta/`.

APK universal de homologação:
`android/app/build/outputs/apk/homologation/app-homologation-espacamento-conta.apk`.
