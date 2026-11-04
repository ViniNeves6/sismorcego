# Resposta do botão de sincronização

Correção de 29/10/2026, usando `C:/Users/bradg/Downloads/Refresh_Anim.html` como
referência visual e de tempo.

## Diagnóstico

O botão misturava animações nativas de opacidade/rotação com uma animação de
largura por JavaScript. O giro e os pontos podiam avançar enquanto a largura do
rótulo e a posição do ícone ficavam atrasadas. A sincronização também era chamada
antes da preparação das animações; a segunda fase dependia de um callback no
JavaScript após a pressão inicial.

## Implementação

- O rótulo mantém uma largura fixa. A translação nativa do ícone reproduz a
  geometria do grupo centralizado do HTML, incluindo o espaço final de 28 pontos
  para as reticências. Não há mais animação de largura por JavaScript.
- Toda a sequência inicial é preparada antes de chamar a sincronização real,
  que continua sendo disparada no mesmo toque.
- Os 90 ms iniciais de pressão são codificados nos frames da animação nativa.
  Não há temporizador JavaScript entre a pressão e o giro/troca do texto.
- O giro usa os pontos de referência 0°, −18°, 190° e 360° ao longo de 2,2 s,
  com as curvas do HTML. O rótulo se move em 360 ms, a opacidade muda em 280 ms,
  a posição do ícone em 380 ms e o destaque do botão em 300 ms.
- O brilho continua em ciclos de 1,6 s. Os três pontos usam um único relógio
  nativo de 1,1 s, com fases deslocadas, sem temporizadores para iniciar cada um.
- Ao terminar, o texto retorna e o botão faz o movimento final de 450 ms. Os
  pontos e o brilho permanecem disponíveis durante a saída, sendo encerrados ao
  fim do retorno. O botão fica disponível novamente ao terminar essa sequência.

A animação acompanha a promessa retornada pelo callback e o estado real de
sincronização. Se o trabalho continuar após a primeira volta, o giro segue em
novos ciclos; a animação não antecipa o fim de uma requisição pendente. Toques
repetidos no mesmo evento não disparam solicitações duplicadas.

Movimento reduzido do sistema ou do aplicativo usa um rótulo estático de estado.
Mudar essa preferência durante a operação cancela/reinicia a parte visual de
forma consistente. Sair da tela, inclusive ao voltar pela navegação, encerra
somente as animações do botão; a sincronização já solicitada segue seu fluxo.
Callbacks visuais antigos são invalidados para não reativar uma fase encerrada.

## Arquivos e validação

- `src/ui/SyncNowButton.js`: apresentação com posicionamento nativo do ícone e
  indicadores de acessibilidade de ocupado/desabilitado.
- `src/ui/useSyncButtonAnimation.js`: sequência nativa e ciclo de vida da operação.
- `__tests__/syncNowAnimation.test.js`: 18 cenários de tempo, geometria, callback,
  retorno, requisição lenta, erros, preferência de movimento e desmontagem.

**342 testes aprovados em 36 suítes.** ESLint dos três arquivos sem erros ou
avisos. As compilações universais Debug e Homologação concluíram; o APK contém as
quatro arquiteturas e o bundle JavaScript correspondente à entrega.

As propriedades e os frames nativos foram verificados com o código instalado do
React Native 0.81.1 (`NativeAnimatedAllowlist.js` e `TimingAnimation.js`). Não houve
medição de FPS/latência nem teste manual em Galaxy S25 nesta etapa.

Evidências: `docs/evidencias-botao-sincronizar/`.

APK: `android/app/build/outputs/apk/homologation/app-homologation-sync-suave.apk`.
