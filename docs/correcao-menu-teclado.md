# Menu inferior durante a digitação

Data: 30/10/2026.

O menu inferior estava ancorado no fim da área que encolhia com o teclado. Por isso, subia junto com os campos e permanecia visível acima do teclado. O ajuste global por altura também podia conservar uma dimensão inadequada após a restauração da janela.

O menu agora é retirado da interface enquanto o teclado está aberto e retorna depois do fechamento. A tela e seus campos permanecem montados, preservando a aba, a rolagem e os valores digitados. Essa regra atende Registros, Nova notificação, telas de Mais e popups com campos.

A janela usa ajuste por preenchimento inferior, mantendo a raiz flexível. No Android, esse ajuste só fica habilitado enquanto o teclado está visível: ao fechar, o preenchimento volta a zero mesmo se a coordenada informada pelo sistema descontar a barra do aparelho. O Android continua configurado com `adjustResize`; quando a janela nativa já foi redimensionada, nenhum espaço adicional é aplicado. A rolagem que revela o campo acima do teclado foi preservada.

A visibilidade acompanha os eventos do teclado, incluindo fechamento pelo Voltar, estado inicial e retorno do segundo plano. No iOS, o menu já fica oculto no início da abertura e reaparece depois do fechamento. Não foi acrescentada animação própria ao menu.

## Validação

- **486 testes aprovados em 49 suítes.**
- Dois ensaios de integração exercitam todas as abas de ACS e coordenador: menu ausente durante a digitação, retorno com o estilo original, mesma instância da tela e dados do formulário preservados.
- Dois casos usam a implementação real do `KeyboardAvoidingView` da versão instalada: três ciclos de teclado por cenário, com redimensionamento nativo ou janela sem redimensionamento. Exercitam a restauração da janela antes do evento de fechamento e a coordenada de fechamento com desconto da barra do sistema. A raiz conserva `flex: 1`, sem altura fixa e com preenchimento zero ao fechar.
- Cinco casos do detector de teclado: montagem com teclado aberto, ciclos repetidos, eventos do iOS, retorno do segundo plano e limpeza das assinaturas.
- Ensaios anteriores de campos inferiores, cancelamento de medições atrasadas, transições, popups e acessibilidade continuam aprovados.
- ESLint: zero erros e um aviso preexistente de estilo inline em seis arquivos verificados.

Os eventos e dimensões nativas são simulados nos testes; não houve reprodução visual no S25 nesta rodada.

APK universal: `android/app/build/outputs/apk/homologation/app-homologation-menu-teclado.apk`.

Evidências e hashes: `docs/evidencias-menu-teclado/verificacao.json`.
