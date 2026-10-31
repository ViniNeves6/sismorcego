# Abertura do painel antes do mapa

Correção de 29/10/2026.

## Comportamento

O painel monta seu cabeçalho, filtros, contadores e gráfico sem criar o MapView.
O espaço de 218 pontos do mapa fica reservado com o texto “Carregando mapa…”.
Depois do término real da entrada da tela, são cedidos dois frames e uma tarefa
ociosa antes da criação do mapa nativo. Não há um atraso fixo de vários segundos
nem dependência de resposta de rede para mostrar o restante do painel.
O placeholder sai quando o SDK informa que o mapa está pronto para uso; os tiles
continuam sob responsabilidade do SDK.

A tarefa ociosa tem timeout de 750 ms para evitar adiamento indefinido em uma
interface ocupada. Sair antes da montagem cancela os frames/tarefa pendentes;
uma resposta atrasada não inicia o mapa de uma visita encerrada. O sinal de
entrada identifica cada visita, inclusive voltar rapidamente à mesma aba.
Sem registros com GPS, o SDK não é inicializado por esse componente.

O mapa foi separado em um componente memoizado. Pontos do heatmap são preparados
somente quando mudam; mudanças de filtro usam a região atual após o SDK estar
pronto. O tamanho reservado permanece igual e os alvos do guia não são deslocados.
Não foi adicionada uma animação ao mapa. A transição visual existente foi mantida.
As preferências de movimento reduzido do aplicativo e do sistema são respeitadas,
mantendo a espera pelos frames mesmo quando não há animação de entrada.

## Rede e threads: o que foi verificado

- O toque em Painel utiliza o papel já carregado e muda a aba; não aguarda uma
  consulta de rede antes de abrir a tela.
- As leituras do histórico utilizam `await NetInfo.fetch()` e `await getDocs()`;
  o painel recebe os registros do estado do Shell. A central usa listeners
  assíncronos. Não foi encontrada uma chamada de rede síncrona nesse caminho.
- A configuração Android mantém Hermes e a nova arquitetura do React Native.
  Isso não equivale a executar todo o JavaScript em workers: cálculos e callbacks
  da aplicação continuam sujeitos ao orçamento da thread JavaScript.
- No pacote instalado `react-native-maps`, o construtor nativo chama
  `getMapAsync`. A criação/manipulação da View do Google Maps exige a thread de UI,
  conforme a [documentação oficial do MapView](https://developers.google.com/android/reference/com/google/android/gms/maps/MapView).
  Por isso, a correção muda o momento da montagem; não executa Views nativas em
  uma thread incompatível com o SDK.
- `requestIdleCallback` é agendamento cooperativo, não uma thread extra.
  A [documentação do React Native 0.81](https://reactnative.dev/docs/0.81/interactionmanager)
  recomenda essa API para esse tipo de trabalho adiado. Há fallback cancelável
  por timer nos ambientes que não disponibilizam a API.

Essas conclusões são da inspeção do código e dos contratos dos SDKs. Não houve
captura Perfetto/Hermes nem medição de FPS/latência em aparelho nesta etapa;
portanto, não foi demonstrado que todo o atraso anterior vinha do mapa nem que
a criação nativa ficou sem qualquer custo depois da abertura.

## Arquivos

- `src/pages/Admin/DeferredPanelMap.js` (novo): montagem adiada, cancelamento,
  placeholder, mapa/heatmap/marcadores e recenter após prontidão.
- `src/pages/Admin/AdminPanelScreen.js`: usa o componente adiado, mantendo os
  filtros, contadores e layout.
- `src/ui/AnimatedScreenTransition.js`: publica o término da entrada por contexto,
  com proteção contra callbacks de transições interrompidas e StrictMode.
- `src/navigation/SismorcegoShell.js`: encaminha a preferência de movimento
  reduzido ao painel.
- `__tests__/deferredPanelMap.test.js` (novo) e ajuste no teste de mapa em
  `__tests__/coordinatorScreens.test.js` para aguardar a montagem adiada.

## Validação e entrega

304 testes aprovados, em 36 suítes. Os oito novos cenários cobrem a ordem
entrada/frames/idle, movimento reduzido por duas origens, cancelamento ao sair,
retorno rápido, filtros durante inicialização, ausência de GPS e StrictMode.
ESLint sem erros, com um aviso de estilo inline preexistente no Shell.
Compilações universais Debug e Homologação; logs e conferência do APK em
`docs/evidencias-abertura-painel/`.

APK da entrega:
`android/app/build/outputs/apk/homologation/app-homologation-painel.apk`.

Não houve alteração de regras, contas ou ocorrências no Firebase real.
