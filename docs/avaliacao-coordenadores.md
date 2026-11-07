# Avaliação dos coordenadores no Spark

Entrega na branch exclusiva `feature/redesign-coordenadores-20261031`, após `c338ffa`. A autenticação foi simplificada por solicitação do proprietário: **e-mail e senha compartilhados, entrada automática e nenhum backend próprio**.

## Estado real

O Firebase `sismorcego-50b25` permanece no plano gratuito Spark, sem faturamento vinculado. O Firestore existente é Standard, banco `(default)`, região `southamerica-east1`, com free tier. Nenhum serviço pago foi ativado.

Conta existente, sem duplicação:

| Item | Estado |
| --- | --- |
| Nome no Authentication | `Sismorcego Teste` |
| UID | `sismorcego-teste-coordenadores` |
| E-mail técnico | `avaliacao-coordenadores@sismorcego-50b25.firebaseapp.com` |
| Provedor | E-mail e senha, já habilitado no projeto |
| Conta | Habilitada |
| Perfil Firestore | `usuarios/{uid}.role = "coordenador"` |
| Custom claim preservada | `sismorcegoEvaluationAccount: true` |

O e-mail técnico identifica a conta do aplicativo; não é uma caixa de entrada para recuperação por e-mail. A administração da conta continua no Console/SDK autorizado. Minha conta no aplicativo permanece mascarada.

**A avaliação está habilitada por 30 dias**, com timestamps reais:

- Início: `2026-11-07T01:56:35.185Z` — **06/11/2026 às 22:56:35.185**, Fortaleza.
- Expiração: `2026-12-07T01:56:35.185Z` — **06/12/2026 às 22:56:35.185**, Fortaleza.

São datas globais, iguais para todos os aparelhos. A data de instalação não cria outro período.

Os três registros reais foram lidos e comparados por hash antes/depois dos testes: conteúdo e atualização preservados. Os dois usuários normais e suas informações, claims e permissões IAM anteriores também foram preservados.

## Como o aplicativo entra

Depois da splash existente, o SDK Firebase autentica automaticamente com `signInWithEmailAndPassword`. Não há login visível, código de instalação, QR Code, JSON, ativação manual ou cadastro de celulares.

Uma sessão já persistida é reutilizada; uma sessão perdida ou um refresh token revogado pode ser recuperado automaticamente com a credencial compartilhada. A persistência continua no adaptador criptografado existente, usando Android Keystore/iOS Keychain. Suspensão e expiração da avaliação não apagam a sessão ou a fila local.

Antes de abrir o Shell, o app exige o UID esperado, conta não anônima, claim de avaliação, configuração válida e perfil coordenador obtido do servidor. O caminho de autenticação normal foi mantido quando a opção nativa de avaliação está desativada.

Referências oficiais: [e-mail e senha](https://firebase.google.com/docs/auth/web/password-auth), [renovação de ID token](https://firebase.google.com/docs/reference/js/auth#getidtokenresult) e [informações do ID token](https://firebase.google.com/docs/reference/js/auth.idtokenresult).

## Credencial no APK e compilação

A senha aleatória da conta de aplicação foi colocada somente no APK de homologação e no arquivo local de compilação:

`C:\\Users\\bradg\\.sismorcego\\evaluation-credentials.properties`

Esse arquivo fica fora do repositório, com ACL restrita ao usuário Windows. Contém apenas `email` e `password` da conta compartilhada. **Não contém credencial administrativa.** A senha não é impressa nos logs nem registrada neste documento/Git.

O Gradle lê esse arquivo por padrão; também aceita `SISMORCEGO_EVALUATION_CREDENTIALS_FILE` ou a propriedade `sismorcegoEvaluationCredentialsFile` para indicar outra cópia local. O build de homologação falha se a credencial estiver ausente. O APK de emuladores tem somente uma credencial fictícia e aponta exclusivamente ao projeto demo local.

Os valores são compilados em campos nativos de `BuildConfig`, acessados pelo módulo `SismorcegoBuild`. **Podem ser recuperados do APK**, conforme a decisão explícita do proprietário para esta avaliação temporária. Não há tentativa de apresentar ofuscação como proteção da senha.

A conferência do APK encontrou a credencial compartilhada no DEX de homologação, sua ausência no DEX do emulador, nenhum arquivo ADC ou bloco completo de chave privada, e nenhuma referência ao antigo endpoint de emissão no bundle. Constantes genéricas de formato de chave nas bibliotecas não são chaves administrativas.

Para compilar novamente nesta estação, mantenha o arquivo externo e use o build de homologação existente. Em outra estação, forneça esse arquivo localmente antes da compilação; isso é preparação do build, não configuração dos celulares. O arquivo não precisa ser entregue aos coordenadores.

Não altere a senha para prorrogar a avaliação. A prorrogação é feita somente no documento de prazo. Se a senha compartilhada for substituída, APKs com a senha anterior não poderão restabelecer uma sessão perdida até que a credencial de compilação seja atualizada e o APK correspondente distribuído.

## Controle de prazo pelo PC

Abra o [Firestore do projeto](https://console.firebase.google.com/project/sismorcego-50b25/firestore/databases/-default-/data) e localize:

`configuracoes/avaliacaoCoordenadores`

| Campo | Tipo | Uso |
| --- | --- | --- |
| `enabled` | boolean | `true` permite avaliação; `false` suspende |
| `startAt` | timestamp | Início global |
| `expiresAt` | timestamp | Fim global, exclusivo |

Não substitua timestamps por textos. Confira o fuso exibido no Console; Fortaleza é UTC−3.

Para prorrogar, altere somente `expiresAt`. Exemplos a partir do prazo atual, em Fortaleza:

| Acréscimo | Nova expiração |
| --- | --- |
| 15 dias | 21/12/2026 às 22:56:35.185 |
| 30 dias | 05/01/2027 às 22:56:35.185 |
| 60 dias | 04/02/2027 às 22:56:35.185 |

Para uma data específica, como 06/01/2027, selecione essa data diretamente. Mês civil e 30 dias não são sempre iguais.

Para suspender, defina `enabled: false`. Para reativar, confirme um início passado, escolha uma expiração futura e defina `enabled: true`. Os aplicativos recuperam o acesso automaticamente, sem reinstalação ou nova ativação.

Para encerrar definitivamente, mantenha `enabled: false`. Opcionalmente desabilite a conta no Authentication e revogue suas sessões. Revogar apenas refresh tokens não encerra a avaliação: a entrada automática pode obter outra sessão enquanto a conta e o prazo estiverem autorizados. ID tokens Firebase normalmente duram até uma hora; o prazo da avaliação é uma autorização separada.

## Regras e comportamento sem rede

As regras já publicadas foram preservadas e comparadas integralmente com o arquivo local. Elas exigem `enabled: true` e `startAt <= request.time < expiresAt` para o UID da avaliação. **O horário do celular não autoriza leituras ou escritas.** As contas normais não dependem desse documento.

A conta de avaliação pode consultar o controle mesmo vencido, permitindo reconhecer uma prorrogação. Nenhum cliente pode editar o controle ou listar sua coleção. A edição no Console continua restrita ao IAM administrativo.

A interface usa a emissão de um ID token recém-renovado como referência para os seus timers, com margem conservadora para segundos/latência e relógio monotônico. Claims interpretadas no cliente não substituem autorização: **uma leitura do perfil exclusivamente do servidor precisa passar pelas regras antes de liberar a interface**. A leitura do perfil valida também o prazo real no Firestore.

Há listener do controle, revalidação a cada 45 segundos em primeiro plano, ao reconectar e ao retornar ao app. A autorização local tem no máximo 60 segundos e é limitada pelo prazo e ID token. Uma abertura sem rede bloqueia o acesso às telas protegidas. Durante perda transitória de conexão, uma sessão em uso conserva somente o restante dessa autorização curta. Suspensão/expiração conhecida nunca é removida por cache ou data do celular.

O app continua verificando após expiração/suspensão e se recupera quando o prazo é estendido. Uma alteração do controle invalida verificações antigas ainda em andamento. O bloqueio não remove registros salvos localmente.

Um aparelho desconectado não recebe uma suspensão instantaneamente. As regras negam novos pedidos ao servidor; dados já vistos, capturas ou PDFs exportados não podem ser retirados por essas regras.

## Cloud Functions e IAM

Foram removidos `functions-evaluation`, o endpoint `evaluationAccess`, o cliente HTTP emissor e a configuração de Functions/emulador de Functions em `firebase.json`. Nenhuma função desse backend chegou a ser publicada; não foi preciso excluir recursos reais.

A aplicação não depende de Cloud Functions, Cloud Run, IAM Credentials, serviço emissor ou chave administrativa para entrar. Os testes locais executam somente Auth e Firestore.

A configuração administrativa/ADC e os papéis mínimos anteriormente autorizados foram preservados fora do APK, sem ampliar permissões. A conta de serviço emissora anterior não é mais utilizada pelo aplicativo. Não foram removidos recursos administrativos que já existiam nem alteradas suas vinculações.

O código legado de FCM em `functions/`, anterior a esta avaliação, continua inativo e fora da configuração de implantação. Push e Storage permanecem desativados. Spark continua sujeito às quotas gratuitas de Auth/Firestore; nenhum faturamento foi habilitado.

O cache ignorado `functions-evaluation/node_modules` permanece no disco, sem uso. Sua limpeza recursiva foi recusada pela revisão automática com a indicação “bloqueado por política”; não foi tentado contornar esse bloqueio. Código, manifesto, lockfile e configuração do backend foram removidos normalmente.

## Interface e funcionalidades preservadas

Mantidos splash somente na abertura, tutorial, cinco abas, Painel/mapa/gráficos, formulários, alertas, sincronização, PDF, responsável humano por ocorrência, animações adaptativas, acessibilidade e correções de teclado/dock/scrollbar.

Minha conta mostra `Sismorcego`, e-mail `************` e sem alteração de senha. O nome humano informado por aparelho continua em `nomeAcs`, histórico e PDF; a identidade técnica compartilhada não substitui o responsável. O tutorial continua adiando a carga dos registros até ser concluído/pulado.

O nome do APK real continua `Sismorcego`; pacote `com.sismorcego.homologacao`. O APK `com.sismorcego.emulador` é somente para dados fictícios locais.

## Testes e evidências

- **627 testes / 60 suítes do app aprovados.**
- **72 testes / 4 suítes Firebase aprovados**, com SDKs reais contra Auth/Firestore locais. Incluem dois clientes no mesmo UID, sessão perdida, renovação, conta desabilitada, alteração de claim/perfil, expiração, prorrogação, suspensão, restauração, conexão e preservação das contas normais.
- **Integração real Spark aprovada:** o controlador atual do aplicativo foi executado com dois clientes independentes, usando senha e Firebase reais. Foram confirmados perfil/claim, três registros e estado dos alertas, reutilização da sessão, perda/recuperação de sessão, bloqueio de leituras pelas regras durante expiração/suspensão e restauração automática após alteração do controle.
- **APK real instalado no Android 15/API 35**, AVD exclusivo `SismorcegoAutomaticQA35`: instalação limpa abre o passo 1 do guia sem login; Registros carregam os três registros reais; Painel e Alertas abrem; expiração e suspensão mostram bloqueio; prorrogação/reativação restauram o acesso. Capturas adicionais documentam Minha conta, reabertura e reconexão.
- **Builds de homologação/emulador aprovados**, bundle atual conferido dentro dos APKs e ABIs `arm64-v8a` / `x86_64`.
- ESLint dos arquivos JS/CJS alterados/novos: **zero erros e avisos**. `git diff --check` aprovado.
- Hashes dos três documentos reais e seus tempos de atualização preservados. Dois usuários normais e IAM preexistente preservados. Nenhuma ocorrência criada, editada ou excluída.

Os dois clientes simultâneos são instâncias independentes dos SDKs, não dois celulares físicos. O teste Android foi feito em um AVD. A limitação de renderização observada anteriormente no Android 37/16 KB permanece sem certificação; essa simplificação não altera as dependências nativas envolvidas nem afirma resolvê-la.

Evidências locais ignoradas pelo Git: `android/app/build/evaluation-spark-qa/`, com `tests-app.log`, `tests-firebase.log`, `lint.log`, `build.log`, `account-configured.json`, `control-active.json`, `real-session-verification.json`, `records-before.json`, `iam-final.json`, `apk-verification.json`, `android-verification.json` e capturas `local-*` / `real-*`. A senha não aparece nesses relatórios.

## APK e arquivos modificados

APK para os coordenadores: `android/app/build/outputs/apk/homologation/app-homologation.apk`.

- Tamanho: 166163977 bytes.
- SHA-256: `49e440ed81a2f5aafca6405e788c11729b2cfef7dc520b1da9fb20012a05fcf7`.

APK local de testes: `android/app/build/outputs/apk/emulator/app-emulator.apk`, SHA-256 `3c4132bb4e2a6581c92e0b71086892b9fc62c8cdfda14dc696324817377d855b`.

Os APKs acima incluem também a correção nativa de retorno da barra após fechar o teclado, descrita em `docs/correcao-fechamento-teclado.md`. Autenticação, credenciais e configuração de prazo permanecem as mesmas desta entrega Spark.

Alterados: `src/services/evaluationSession.js`, `appEnvironment.js`, `src/hooks/EvaluationAuthProvider.js`, texto de indisponibilidade em `EvaluationSetupScreen.js`, `android/app/build.gradle`, `SismorcegoBuildPackage.kt`, `firebase.json`, `scripts/run-firebase-emulators.cjs`, `.eslintrc.js`, testes de sessão/integração e este documento. Novo: `src/services/evaluationPolicy.js` e seu teste.

Removidos: `src/services/evaluationApi.js`, seu teste, `emulator-tests/evaluationAccess.test.js` e os quatro arquivos do backend `functions-evaluation`. Regras, navegação, telas dos coordenadores e dependências comuns não foram revertidas.

Bundle/recursos foram gerados na pasta QA e sobrepostos com init Gradle temporário, sem sobrescrever os arquivos locais de `src/main`. Os 270 arquivos originalmente não rastreados são preservados. A entrega recebe somente commit local na branch solicitada; nenhum push ou alteração da main.
