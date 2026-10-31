# Limpar notificação e voltar ao topo

Ao tocar no X da aba Notificar, o app agora fecha o teclado, limpa os campos e solicita rolagem do formulário para o início. A rolagem é suave no modo normal e imediata com redução de movimento ativa. Se estiver no formulário de uma vítima, continua retornando ao formulário principal, que inicia no topo. Apenas abrir a aba Notificar preserva o rascunho.

Verificação: 72 testes aprovados em cinco suítes — integração do Shell, transições, teclado, avanço do formulário e redução de movimento. Dois casos novos exercitam a limpeza com e sem movimento reduzido, o retorno ao topo e a preservação do rascunho ao apenas trocar de aba. ESLint sem erros, com um aviso preexistente de estilo inline. Não houve conferência visual no aparelho nesta rodada.

APK universal: `android/app/build/outputs/apk/homologation/app-homologation-limpar-voltar-topo.apk`.

Evidências e hashes: `docs/evidencias-limpar-voltar-topo/verificacao.json`.
