# Auditoria de acessibilidade — Sismorcego

Data: 30/10/2026.

## Problemas encontrados e correções

| Configuração | Problema | Correção |
| --- | --- | --- |
| Alto contraste | Painel, Alertas, gráfico, gradientes e partes do tutorial usavam cores fixas fora do tema. Algumas combinações ignoravam o fundo real do botão. | Componentes compartilhados aplicam a preferência a superfícies, textos, contornos e ícones. O texto considera o fundo herdado e o estado selecionado do controle; no amarelo, usa uma cor escura legível. |
| Tamanho do texto | O Painel e Alertas contornavam a escala do app. Havia caminhos diferentes para textos novos e antigos e risco de aplicar a escala duas vezes. | Escala centralizada, aplicada uma vez a títulos, corpo, campos e gráfico. A tipografia já escalada pelo tema antigo é identificada. Selos antigos também usam a variante correta do tema. |
| Layout com letras maiores | Filtros podiam continuar estreitos; controles com altura fixa e o texto animado do sincronizador podiam cortar a fonte ampliada. | Filtros do Painel e Registros reservam mais largura conforme a escala e quebram de linha. Alturas de botões/campos podem crescer. O sincronizador usa uma legenda de tamanho natural quando a fonte do app ou do sistema está ampliada. Créditos medem o conteúdo expandido. |
| Leitura por voz | A inicialização não aguardava o mecanismo nativo; a leitura se limitava a poucos títulos e não coordenava telas e popups. | Aguarda o serviço e configura português brasileiro. Lê resumos dos dados visíveis, filtros, gráfico e detalhes; popups têm prioridade. Interrompe a fala ao desativar, fechar, desmontar ou colocar o app em segundo plano. A última solicitação substitui falas pendentes. |
| Disponibilidade da voz | Não havia feedback claro para ausência de mecanismo/idioma nem uma forma direta de conferir o áudio. | Adicionada a consulta de serviços TTS no manifesto Android, erro explicativo e botão **Ouvir exemplo de leitura** nas configurações. A opção aguarda a inicialização e permanece desligada se ela falhar. |
| Campos e senhas | Muitos campos tinham apenas rótulo visual; a leitura ao focar não estava integrada. | Campos recebem nomes acessíveis. O foco lê somente o rótulo, inclusive quando a senha está revelada; o valor da senha não é enviado à voz. |
| Reduzir animações | Parte das telas dependia de uma propriedade recebida do chamador; algumas animações já iniciadas não eram interrompidas. A opção do sistema se confundia com a preferência salva. | Navegação, diálogos, filtros, rolagem assistida e efeitos consultam a preferência efetiva. Filtros e efeitos em andamento são interrompidos. O app distingue a preferência salva da redução de movimento do Android e respeita ambas. |
| Persistência | Alterações rápidas podiam usar um estado antigo ou ser sobrepostas pelo carregamento das preferências. Falhas de gravação não tinham retorno consistente. | Carregamento precede as alterações, atualizações são mescladas e gravações são serializadas. A última falha restaura o último estado persistido e exibe erro. Valores inválidos são normalizados. |

As mudanças preservam a entrada e a saída dos diálogos, retenção do conteúdo durante o fechamento, fechamento pelo Voltar e composições usadas para evitar os rastros retangulares. A orientação em retrato permanece no APK.

## Verificações

- **475 testes aprovados em 48 suítes**, incluindo **53 casos novos** específicos desta auditoria.
- Alto contraste exercitado nos componentes reais de 13 telas/popups: Painel, Alertas, Registros, Nova notificação, Configurações, Conta, Senha, Dúvidas, Créditos, calendário, seletor, responsável e detalhes. Os textos avaliados atingem razão de contraste calculada de pelo menos 4,5:1 contra as superfícies renderizadas; também há verificações de seleção, gradiente e traço do gráfico.
- Títulos e corpo de 11 telas/popups exercitados em 85%, 115%, 130% e retorno a 100%, com teste adicional de texto aninhado, tema antigo e selos sem multiplicação duplicada.
- Leitura: espera do mecanismo, português, ausência de mecanismo/idioma, nova tentativa, prioridade do popup, dados reais do Painel/detalhes/Alertas, seleção do gráfico, cancelamento de inicialização, mudo, segundo plano, desmontagem e proteção do conteúdo de senha.
- Movimento: preferências do app e do sistema, abertura e fechamento sem movimento mesmo com propriedade explícita falsa, interrupção dos filtros e efeito flutuante, navegação nativa e restauração das animações. As suítes anteriores de ida/volta e composição também passaram.
- ESLint: **0 erros e 52 avisos** em 45 arquivos verificados. Os avisos são de estilos inline e uma operação bit a bit preexistente no carregamento das camadas da abertura.
- Bundle Android de produção e APK universal de homologação gerados. O bundle extraído do APK é conferido por SHA-256 contra o arquivo gerado; manifesto e quatro arquiteturas também são inspecionados.

Os ensaios de interface usam React Test Renderer, com fronteiras nativas simuladas. Não houve execução visual em aparelho/S25 nem audição do mecanismo TTS físico nesta rodada; o botão de exemplo permite conferir a saída de voz no celular. Mapas, fotografias, ilustrações e o conteúdo do PDF preservam suas cores e tamanho próprios; a interface ao redor acompanha as preferências. As medições automatizadas não equivalem a uma certificação completa de acessibilidade.

## Entrega e evidências

- APK: `android/app/build/outputs/apk/homologation/app-homologation-acessibilidade.apk`.
- Pacote: `com.sismorcego.homologacao`.
- Evidências e hashes: [evidencias-acessibilidade/verificacao.json](evidencias-acessibilidade/verificacao.json).
- Resultados: [evidencias-acessibilidade/testes.json](evidencias-acessibilidade/testes.json).
- Análise estática: [evidencias-acessibilidade/eslint.json](evidencias-acessibilidade/eslint.json).
- Logs de bundle e compilação na mesma pasta de evidências.

Reprodução: `node node_modules/jest/bin/jest.js --runInBand --silent`; bundle com a CLI local do React Native; `gradlew.bat app:assembleHomologation -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64 --console=plain` no diretório Android.
