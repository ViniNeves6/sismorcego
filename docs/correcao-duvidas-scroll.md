# Histórico de perguntas com rolagem interna

Correção de 29/10/2026, conforme a área de Dúvidas do arquivo
`C:/Users/bradg/Downloads/sismorcego-spotlight-passo7-scroll.html`.

A tela de Dúvidas agora usa uma coluna limitada à altura disponível. Cabeçalho,
introdução, botão Nova dúvida, atalho de perguntas frequentes e título do
histórico ficam fora da rolagem. O retângulo do histórico ocupa o espaço restante
e somente as perguntas rolam dentro dele. Adicionar perguntas ou expandir um
texto longo não aumenta a altura da página.

O retângulo tem fundo lilás, bordas arredondadas e uma barra interna persistente,
inclusive com uma única pergunta. A barra acompanha o conteúdo e permite arraste
e ações de acessibilidade quando há conteúdo excedente. Quando tudo cabe, a
barra permanece visível sem capturar gestos nem apresentar um controle de
rolagem sem função. A área termina acima do menu inferior, considerando o inset
real do aparelho.

Essa implementação substitui a rolagem da página inteira descrita anteriormente
em `docs/correcao-duvidas-layout.md`. Nova dúvida e Perguntas frequentes mantêm
suas telas com rolagem própria, assim como as ações e transições existentes.
Não foi adicionada animação nesta correção.

## Verificação

- 350 testes aprovados em 38 suítes. Os novos testes cobrem a rolagem restrita
  ao histórico ao variar de 1 para 2 e 20 perguntas, retorno ao estado vazio,
  atalhos, expansão/recolhimento, barra persistente, arraste, acessibilidade e
  preferência de movimento reduzido. A barra dos formulários mantém seu
  comportamento anterior.
- ESLint dos arquivos alterados: nenhum erro, com 18 avisos preexistentes de
  estilos inline em MaisScreens.
- 198 cenários no Yoga 3.2.1, lendo os estilos do aplicativo: larguras de 320 a
  768, alturas de 568 a 1024, insets de 0/24/48, fontes em 100% e 130% (a partir
  de 640 de altura para 130%), de 1 a 20 perguntas e texto expandido. A altura do
  histórico e da página permanece igual ao variar a quantidade e a expansão;
  o histórico termina antes da área reservada ao menu.
- As medidas de texto nessa conferência de geometria são aproximadas. Não
  houve validação visual em aparelho físico ou emulador nesta etapa.

## Entrega

Arquivos principais:

- `src/pages/Extras/MaisScreens.js`
- `src/ui/ScrollViewWithScrollbar.js`
- `__tests__/redesignScreens.test.js`
- `__tests__/questionsScrollbar.test.js`

Evidências, verificador de layout e logs:
`docs/evidencias-duvidas-scroll/`.

APK universal de homologação:
`android/app/build/outputs/apk/homologation/app-homologation-duvidas-scroll.apk`.

A conferência do APK e do bundle está em
`docs/evidencias-duvidas-scroll/apk-verificado.json`.
