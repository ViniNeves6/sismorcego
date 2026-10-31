# Correção de GPS e mapa — 28/10/2026

## Diagnóstico

A prévia ativava `loadingEnabled` em `react-native-maps` 1.26.1, com React Native 0.81.1 e Fabric. Essa combinação possui um crash nativo conhecido no Android ao criar o indicador de carregamento. O código instalado usa um parâmetro de cor nulo em `ColorStateList.valueOf` nesse caminho. A ocorrência está documentada na [issue 5723 da biblioteca](https://github.com/react-native-maps/react-native-maps/issues/5723).

Esse gatilho estava presente no aplicativo e foi removido. Como não havia dispositivo conectado ao ADB, não foi possível obter a pilha do crash do aparelho do usuário nem confirmar fisicamente que ele deixou de ocorrer. A correção aplicada corresponde à causa encontrada no código; a confirmação no dispositivo permanece pendente.

Também foram encontrados:

- Mapas mantidos montados, embora ocultos, após a remoção do GPS.
- Recriação completa do mapa a cada atualização de coordenadas.
- Ausência de autorização explícita por callbacks no iOS na captura do redesign. A API instalada não retorna uma Promise de status de autorização.
- Permissão aproximada no Android podendo ser apresentada como captura de alta precisão.
- Arredondamento das coordenadas antes do armazenamento.
- Falta de validação de limites das coordenadas nas fronteiras de persistência e envio.

O fallback com coordenadas fictícias mencionado no texto anexado já não existia no código atual. As tentativas de 20 segundos e 12 segundos também já estavam presentes; foram preservadas e verificadas.

## Funcionamento corrigido

- `MapView` e `Marker` continuam integrados ao cartão do redesign. O carregamento é indicado por um componente React fora do mapa, com o indicador nativo problemático desativado.
- O mapa só monta com coordenadas numéricas válidas e depois que a área de exibição possui tamanho positivo. Atualiza a região e o marcador sem trocar a instância a cada captura.
- Ao remover o GPS, o mapa permanece durante a saída e é desmontado ao terminar. Entrada, saída e movimento reduzido são respeitados.
- Android verifica os resultados das permissões fina e aproximada. Quando só a aproximada é permitida, utiliza essa modalidade e informa a qualidade correspondente.
- iOS solicita autorização durante o uso e espera os callbacks de sucesso ou erro antes da captura.
- Com permissão fina, mantém a primeira tentativa de alta precisão de 20 s e o fallback aproximado de 12 s. Permissão negada interrompe a captura; falhas não geram coordenadas substitutas.
- Latitude e longitude conservam a precisão retornada pelo dispositivo. Apenas o texto de exibição é arredondado. Precisão em metros e metadados `source`/`isHighAccuracy` seguem pelo formulário, fila e payload de sincronização.
- Coordenadas fora dos limites são rejeitadas antes de salvar no redesign. Registros inválidos que já estejam pendentes não são apagados nem enviados: permanecem locais com erro para correção.
- A versão legada do formulário passa a usar a mesma captura validada, preservando sua interface de hook.
- Conforme o pedido anterior à tarefa de GPS, foi adicionado um espaço de 12 px entre a imagem e “Remover fotografia”.

Foram consultados o projeto antigo em `C:\Users\bradg\sismorcego`, o formulário e hook commitados em `origin/redesign/frontend` e os fluxos atuais. O projeto antigo e a referência remota foram somente lidos. Autenticação, bypass de testes, navegação inferior e demais formulários não foram modificados nesta correção de GPS.

## Arquivos modificados nesta correção

Caminhos relativos a `C:\Users\bradg\sismorcego-redesign`:

| Arquivo | Alteração |
| --- | --- |
| `src/ui/GpsMapPreview.js` | Gatilho do crash, indicador externo, layout, validação, atualização e ciclo de vida do mapa. |
| `src/services/deviceCapture.js` | Permissões Android/iOS, validação da resposta e qualidade aproximada. |
| `src/services/gpsCoordinates.js` | Validação comum de coordenadas e precisão. |
| `src/hooks/useLocationCapture.js` | Reutilização da captura validada e descarte de respostas após limpar/desmontar. |
| `src/pages/Main/NovaNotificacaoScreen.js` | Coordenadas sem truncamento, informação de qualidade e espaço do botão da fotografia. |
| `src/ui/RecordDetailsModal.js` | Coordenadas sem truncamento e informação de qualidade na edição. |
| `src/services/registroAdapter.js` | Validação antes de persistir e manutenção dos metadados. |
| `src/services/syncRegistros.js` | Rejeição de localização inválida antes de enviar. |
| `__tests__/deviceCapture.test.js` | Permissões, tentativas, erros, qualidade e coordenadas inválidas. |
| `__tests__/gpsMapPreview.test.js` | Montagem, região/marcador, carregamento, recaptura, saída e link externo. |
| `__tests__/registroAdapter.test.js` | Rejeição de GPS inválido antes de salvar. |
| `__tests__/recordFlows.test.js` | Percurso dos metadados pela fila, envio e histórico; falha sem perda de dados. O teste isola o modo de produção por mock, sem alterar o bypass do aplicativo. |
| `docs/correcao-gps-mapa.md` | Este relatório. |

O bundle Android em `android/app/src/main/assets/index.android.bundle` foi regenerado para o APK atual.

## Validação

- 61 testes passaram em 6 suítes: `deviceCapture`, `gpsMapPreview`, `registroAdapter`, `recordFlows`, `registro` e `extras`.
- ESLint dos arquivos envolvidos: sem erros.
- `git diff --check`: sem erros de whitespace.
- `npm run android:apk`: `BUILD SUCCESSFUL`.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

Os testes de GPS/permissões simulam as fronteiras nativas. O percurso de armazenamento e sincronização foi validado com fila e Firestore simulados; nenhum registro real foi criado, alterado ou apagado para o teste.

## Pendências e limites

`adb devices` retornou uma lista vazia. Permanecem pendentes os testes físicos de captura, diálogos de permissão, localização desativada/timeout, carregamento dos tiles, marcador visível e reprodução/confirmação do crash. O iOS foi verificado por código e testes de callbacks, sem compilação ou aparelho iOS neste ambiente Windows.

Não é possível identificar com segurança uma coordenada fictícia antiga apenas pelo seu valor quando ela está dentro dos limites geográficos. Por isso, registros existentes não foram removidos ou corrigidos automaticamente. O código de captura atual não utiliza coordenadas inventadas.

Os testes selecionados emitem avisos preexistentes de chave de lista e um log de erro intencional do cenário de falha da conta; as seis suítes concluíram com sucesso. A compilação também informa depreciações de Gradle. A compatibilidade de bibliotecas nativas com páginas de 16 KB, registrada na auditoria anterior, não foi alterada por esta correção.
