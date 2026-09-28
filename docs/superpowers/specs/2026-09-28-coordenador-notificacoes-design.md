# Notificações para o Coordenador (checagem local em segundo plano)

## Objetivo

Quando um ACS envia um novo registro (ocorrência), o Coordenador deve
ficar sabendo: uma notificação aparece na barra de avisos do Android e
o registro entra numa aba nova, "Notificações", com contador de não
lidos.

## Decisão de arquitetura (e por que não é push de verdade)

Notificação real (FCM/push, chega mesmo com o app fechado, quase
instantânea) exige um componente de servidor confiável dentro do
ecossistema Firebase — na prática, uma Cloud Function. Isso exige
upgrade do projeto Firebase pro plano Blaze, que por sua vez, no
cadastro do método de pagamento em Pix nesta conta, exigiu um depósito
de R$ 200 de verificação. O usuário optou por **não mexer com
dinheiro** para isso agora.

Alternativa adotada: **checagem periódica em segundo plano, no próprio
aparelho do coordenador**, disparando uma notificação *local* (gerada
no aparelho, não recebida de um servidor). Zero custo, zero cadastro
de pagamento, mas com uma trade-off explícita que o usuário aceitou:
a notificação não é instantânea. O alvo é checar a cada 1 hora, mas o
Android (em especial fabricantes com otimização agressiva de bateria,
como Xiaomi/Samsung) pode adiar essa execução — não há garantia de
pontualidade sem servidor.

Este documento cobre só o mecanismo local. Se no futuro o usuário
quiser trocar para push de verdade, a peça a adicionar é a Cloud
Function (o repo já tem uma tentativa quebrada em
`functions/index.js`, com o caminho de trigger errado) — fora do
escopo aqui.

## Não-objetivos

- Push notification via FCM/Cloud Functions (adiado, decisão do usuário).
- Notificação para o ACS (só o Coordenador recebe).
- Múltiplos dispositivos por coordenador (assume-se um aparelho).
- Notificação em foreground como banner do sistema (a checagem só
  roda em segundo plano; se o coordenador está com o app aberto, ele já
  vê os dados atualizados na aba Buscar/Notificações, então não
  precisa de um banner adicional nesse caso).

## Modelo de dados

Nova subcoleção no Firestore, por coordenador:

```
usuarios/{uid}/notificacoes/{notifId}
  registroId: string       // recordId do registro que originou a notificação
  uidAcs: string            // uid do ACS que criou o registro
  nomeAcs: string | null
  municipio: string | null
  createdAt: Timestamp      // quando o registro foi criado (não quando a notificação foi gerada)
  lida: boolean             // false ao criar; true quando o coordenador abre o item
```

Local (no aparelho, `AsyncStorage`): `ultimaChecagemNotificacoes` — ISO
string do timestamp do registro mais recente já processado. Evita
reprocessar/reduplicar notificações a cada execução.

Regras do Firestore (`firestore.rules`): a subcoleção
`usuarios/{uid}/notificacoes/{notifId}` só é lida/escrita pelo próprio
dono (`isOwner(uid)`). Quem escreve é sempre o próprio coordenador (o
cliente dele, ao detectar registros novos), então não precisa de regra
especial pra "outro usuário escrever" — diferente do padrey `itens`.

## Fluxo da tarefa em segundo plano

1. Registrada apenas quando `role === "coordenador"` (ver `useAuth`).
   Chamada uma vez ao montar o app (`App.js` ou um hook dedicado),
   nunca para ACS.
2. Biblioteca: `react-native-background-fetch` (usa `WorkManager` no
   Android; é o padrão de facto pra isso em React Native — mantida,
   amplamente usada, funciona com o app minimizado/fechado dentro dos
   limites do Android).
3. A cada disparo (configurado para `minimumFetchInterval: 60` min):
   - Lê `ultimaChecagemNotificacoes` do `AsyncStorage`.
   - Consulta `collectionGroup(db, "itens")` filtrando
     `where("createdAt", ">", ultimaChecagem)`, ordenado por
     `createdAt` (reaproveita o padrão de consulta já usado em
     `historico.js`).
   - Para cada registro novo encontrado:
     - Grava um doc em `usuarios/{uid}/notificacoes/`.
     - Atualiza `ultimaChecagemNotificacoes` para o `createdAt` mais
       recente processado.
   - Se houve pelo menos 1 registro novo, dispara **uma** notificação
     local resumindo a quantidade (ex.: "3 novos registros" ou "Novo
     registro de Fulano, em Curuçá" quando só 1) via `notifee` — evita
     enxurrada de notificações individuais se o aparelho ficou muito
     tempo sem checar.
4. Chama `BackgroundFetch.finish(taskId)` ao final (obrigatório pela
   lib, sinaliza ao SO que a tarefa terminou).

## Notificação local (notifee)

- Canal Android (`notifee.createChannel`): id `registros`, importância
  padrão, criado uma vez no boot do app (idempotente).
- Permissão: `POST_NOTIFICATIONS` (obrigatória a partir do Android 13)
  — pedida via `notifee.requestPermission()` no momento em que o app
  detecta `role === "coordenador"` (não pedida para ACS, que não
  recebe notificação nenhuma).
- Toque na notificação: abre o app na aba "Notificações" (deep link
  simples via `notifee.onForegroundEvent`/`onBackgroundEvent`
  redirecionando a navegação).

## Aba "Notificações"

- Nova `Tab.Screen` em `AppTabs.js`, renderizada condicionalmente: só
  aparece quando `role === "coordenador"` (ACS não vê essa aba).
- Ícone com badge de contagem de não lidas (`tabBarBadge`), lida via
  `onSnapshot` (tempo real) na subcoleção `notificacoes` filtrando
  `lida == false`.
- Lista ordenada por `createdAt` desc. Cada item: nome do ACS,
  município, tempo relativo ("há 2h"). Toque: marca `lida: true` e
  abre o registro correspondente (reaproveita `PdfOptionsSheet`,
  já usado em `Buscar.js`, buscando o registro por `registroId`).
- Estado vazio: reaproveita o componente `EmptyState` já existente no
  design system.

## Arquivos tocados

- `package.json` — novas deps: `react-native-background-fetch`,
  `@notifee/react-native`.
- `android/app/src/main/AndroidManifest.xml` — permissão
  `POST_NOTIFICATIONS`.
- `src/hooks/useCoordenadorNotifications.js` (novo) — registra a
  tarefa de background, o canal de notificação, e expõe o contador de
  não lidas.
- `src/services/notificacoes.js` (novo) — consulta collectionGroup por
  registros novos, grava docs em `usuarios/{uid}/notificacoes`, marca
  como lida.
- `App.js` — chama o hook novo (condicionado ao papel).
- `src/navigation/AppTabs.js` — nova aba condicional "Notificações".
- `src/pages/Main/Notificacoes.js` (novo) — tela da aba.
- `firestore.rules` — regra para `usuarios/{uid}/notificacoes/{notifId}`.

## Testes / validação

- Sem testes automatizados novos (o repo não tem suíte de integração
  Firestore); validação manual: criar um registro com uma conta ACS,
  forçar a tarefa de background (a lib tem um modo de teste,
  `BackgroundFetch.scheduleTask`/simulação via `adb shell cmd
  jobscheduler run`), confirmar que a notificação aparece e o item
  surge na aba Notificações do coordenador, com contador correto.
- Rebuild de APK obrigatório (mudança nativa — novas libs e permissão).

## Riscos conhecidos (aceitos pelo usuário)

- Atraso na entrega da notificação (minutos a horas, dependendo do
  fabricante/otimização de bateria do aparelho do coordenador).
- Se o app for "forçado a parar" (force-stop) pelo usuário no Android,
  a tarefa de background para de rodar até o app ser reaberto — isso é
  uma limitação do Android para qualquer mecanismo em background, não
  específica desta lib.
