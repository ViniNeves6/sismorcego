# Filtros responsivos do Painel e de Registros

Correção de 29/10/2026, usando
`C:/Users/bradg/Downloads/gemini-code-1793309705509.html` como referência de layout.

Os pares Município/Período do Painel e Município/Vítima de Registros agora usam
quebra automática de linha, com base de 158 pontos por seletor, seguindo a regra
do HTML. Quando o grupo não comporta os dois campos com o espaçamento existente,
cada um ocupa uma linha inteira. Havendo espaço, os dois continuam lado a lado
com a mesma largura.

A decisão considera a largura disponível dentro da tela e do card. Não depende
do modelo do aparelho nem de um valor físico de DPI. Por isso, o Painel pode
empilhar um pouco antes de Registros, devido ao espaço interno adicional do card.
O seletor de tipo de vítima do Painel permanece em sua própria linha, inclusive
ao mudar entre retrato e paisagem.

Os textos dos seletores podem quebrar linha para exibir nomes de municípios ou
tipos de vítima mais longos. Em Registros, a altura passou a ser mínima de 46
pontos, crescendo com o conteúdo; no Painel, a altura mínima de 52 pontos foi
preservada. As fontes, cores, espaçamentos, seleção dos filtros e busca foram
mantidos. Não foi adicionada animação ao ajuste de largura.

## Conferência

342 testes aprovados em 36 suítes, incluindo os fluxos existentes de seleção,
filtragem, tipografia e guia. ESLint dos dois arquivos sem erros, com dois avisos
preexistentes de estilo inline em Registros.

A conferência adicional executou 36 layouts no Yoga 3.2.1, lendo os estilos dos
dois componentes. As mesmas árvores foram redimensionadas em sequência, em
direções LTR e RTL, verificando colunas, igualdade das larguras, ausência de
transbordamento horizontal e a linha inteira do seletor de vítima do Painel.

| Largura do viewport | Espaço no Painel | Colunas no Painel | Espaço em Registros | Colunas em Registros |
| ---: | ---: | ---: | ---: | ---: |
| 325 | 260 | 1 | 285 | 1 |
| 360 | 295 | 1 | 320 | 1 |
| 400 | 335 | 2 | 360 | 2 |
| 768 | 703 | 2 | 728 | 2 |

Os cálculos usam as medidas de layout dos componentes. Não houve teste manual
no Galaxy S25 nem conferência de pixels/fontes em aparelho nesta etapa.
A ferramenta Yoga ficou isolada na pasta temporária de conferência; as
dependências do aplicativo não foram alteradas.

## Arquivos e entrega

- `src/pages/Admin/AdminPanelScreen.js`
- `src/pages/Main/RegistrosScreen.js`
- Evidências em `docs/evidencias-filtros-responsivos/`, incluindo o verificador,
  os resultados de layout e os logs.

APKs universais Debug e Homologação gerados. O APK de entrega foi conferido nas
quatro arquiteturas e contém o bundle JavaScript produzido nesta etapa.

APK:
`android/app/build/outputs/apk/homologation/app-homologation-filtros-responsivos.apk`.
