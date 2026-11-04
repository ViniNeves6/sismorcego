# Feedback de cor nos tipos de vítima

Data: 30/10/2026. Branch: `feature/redesign-teste`.

Os quatro botões de tipo de vítima agora usam o estado nativo de pressionamento para mudar a cor de fundo e da borda durante o toque, inclusive quando mantido pressionado. Os botões não selecionados usam o lilás `#DDD3FA` da referência `feedback-tipo-vitima.html`; o selecionado usa roxo escuro `#4C1D95`, preservando sua identificação atual. Ao soltar ou cancelar o toque, as cores originais são restauradas pelo Pressable. No alto contraste, o feedback usa amarelo, com as cores de texto e ícones ajustadas pelas primitivas acessíveis.

Não foram adicionados saltos, deslocamentos ou mudanças de escala. O toque curto continua abrindo o formulário e o toque longo de 500 ms continua abrindo a explicação. Foram incluídos nome, dica e estado selecionado para acessibilidade.

Único fonte alterado: `src/pages/Main/NovaNotificacaoScreen.js`.

Validação: **538 testes existentes aprovados em 52 suítes**, ESLint sem erros, bundle Android e APK universal gerados. Não houve conferência visual no S25 nesta rodada.

APK: `android/app/build/outputs/apk/homologation/app-homologation-feedback-vitima.apk`. Hashes e confirmação do bundle empacotado: `docs/evidencias-feedback-vitima/verificacao.json`. Logs e resultados: `android/app/build/victim-press-feedback-*`.

Sem commit, push, troca de branch ou publicação de serviços Firebase.
