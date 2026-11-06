# Avaliação dos coordenadores — acesso automático

Atualizado em 06/11/2026 na branch exclusiva `feature/redesign-coordenadores-20261031`, sobre `a8b6b92`.

## Estado da entrega

O aplicativo e o emissor automático foram implementados e testados localmente. **A entrada automática no Firebase real ainda depende da publicação do backend**, que exige Blaze e autorização de faturamento. O endpoint real respondeu HTTP 404 na conferência de 06/11/2026. Nenhum faturamento foi habilitado.

Confirmado no projeto real `sismorcego-50b25`:

- Conta única habilitada: nome `Sismorcego Teste`, UID `sismorcego-teste-coordenadores`, sem senha/e-mail cadastrados.
- Perfil `usuarios/sismorcego-teste-coordenadores` com `role: "coordenador"` e claim `sismorcegoEvaluationAccount: true`.
- Emissor `sismorcego-eval-issuer@sismorcego-50b25.iam.gserviceaccount.com`, assinatura remota e ADC sem chave privada.
- Documento `configuracoes/avaliacaoCoordenadores` preparado e **suspenso (`enabled: false`)**.
- Regras de prazo publicadas e conferidas no servidor. Uma sessão Firebase real autenticou e leu o controle; a consulta de ocorrências foi negada durante a suspensão.

Nenhuma ocorrência real foi criada, modificada ou excluída. As outras contas e suas autorizações foram preservadas. A avaliação não foi ativada nesta entrega.

## Fluxo implementado

Após a splash existente, o APK consulta automaticamente o serviço HTTPS. O servidor confere o período global, a conta habilitada, a claim e o perfil coordenador; emite um custom token somente para o UID fixo da avaliação e revalida a política depois da assinatura. O SDK Firebase troca o token por uma sessão real. O app confere claim assinada e perfil antes de abrir o `SismorcegoShell`.

Foram removidos importador JSON, código de instalação, módulo Android e script de provisionamento manual. Não há login, senha, QR Code ou aprovação de aparelhos. O status pode ser consultado sem sessão, permitindo recuperar automaticamente uma instalação cuja sessão local se perdeu.

A sessão é persistida pelo adaptador criptografado existente, usando Android Keystore/iOS Keychain. Cada instalação tem sua própria sessão renovável, embora compartilhe o UID. Nenhum custom token, refresh token, senha, ADC ou chave privada foi colocado no código, APK ou Git. UID, URL e configuração pública do Firebase são identificadores, não segredos.

Quando a opção nativa de avaliação está desativada, permanece a autenticação normal. O APK `emulator` usa somente o projeto demo local; o `homologation` usa somente o Firebase real. Não há fallback entre ambientes.

## Prazo e recuperação

O backend usa seu relógio; as regras usam `request.time`. Quando o prazo vence, ainda não começou, está suspenso ou malformado/ausente, leituras e escritas protegidas desse UID são negadas. Usuários normais não dependem da configuração da avaliação.

O UID compartilhado pode fazer `get` no controle mesmo vencido. Nenhum cliente pode listar a coleção ou modificar o documento. Edição no Console depende do IAM administrativo.

O app acompanha alterações do controle pelo servidor, revalida a cada 45 segundos em primeiro plano e ao reconectar. Ao retornar do segundo plano exige nova verificação. A autorização local dura no máximo 60 segundos, limitada pelo prazo e ID token, com relógio monotônico e desconto da duração da requisição. Abertura sem internet bloqueia as telas protegidas. Falha transitória durante o uso conserva apenas o restante dessa autorização curta; cache e data do celular não removem bloqueios conhecidos.

Suspender ou vencer não apaga sessão nem fila criptografada. Prorrogar/reativar reutiliza ou restabelece a sessão automaticamente. Não é preciso reinstalar, emitir arquivos ou tocar nos celulares.

Um aparelho desconectado não recebe suspensão instantaneamente. As regras negam novos pedidos ao servidor; elas não retiram dados já vistos, capturas ou PDFs exportados.

## Controle pelo computador

Abra o [Firestore do projeto](https://console.firebase.google.com/project/sismorcego-50b25/firestore/databases/-default-/data) e localize `configuracoes` → `avaliacaoCoordenadores`.

| Campo | Tipo no Console | Uso |
| --- | --- | --- |
| `enabled` | boolean | `true` habilita, `false` suspende |
| `startAt` | timestamp | Início global |
| `expiresAt` | timestamp | Fim global, exclusivo |

Não grave datas como strings. Fortaleza é UTC−3; confira o fuso exibido pelo Console.

O documento preparado contém `startAt: 2026-11-06T19:39:31.360Z` e `expiresAt: 2026-12-06T19:39:31.360Z`, com `enabled: false`. **Na ativação efetiva, depois de publicar e verificar o serviço, redefinir o início para o horário do servidor e a expiração para 30 dias depois; só então habilitar.** A espera por faturamento não deve consumir o período.

Para prorrogar, edite somente `expiresAt`. Partindo de 06/12/2026 às 16:39:31.360 em Fortaleza:

| Acréscimo | Nova expiração |
| --- | --- |
| 15 dias | 21/12/2026, mesmo horário |
| 30 dias | 05/01/2027, mesmo horário |
| 60 dias | 04/02/2027, mesmo horário |

Para o exemplo solicitado de 06/01/2027, escolha essa data diretamente: mês civil e 30 dias não são equivalentes.

Para suspender, defina `enabled: false`. Para reativar, coloque uma expiração futura, confira que o início já chegou e defina `enabled: true`. Os aplicativos verificam e recuperam o acesso automaticamente.

Para encerrar definitivamente, mantenha `enabled: false`. Como defesa adicional, desabilite a conta compartilhada no Authentication e revogue suas sessões. Desabilitar a conta ou revogar apenas refresh tokens não substitui o bloqueio nas regras: ID tokens já emitidos podem durar até uma hora. Enquanto avaliação e conta estiverem autorizadas, revogar somente refresh tokens permite obter outra sessão automaticamente. Não há revogação individual nesta arquitetura sem identificação/controle por dispositivo.

## Infraestrutura e IAM

Novo backend isolado em `functions-evaluation`, codebase `coordinator-evaluation`, função HTTP gen2 `evaluationAccess`, região `southamerica-east1`, Node.js 22. A função antiga de FCM em `functions/` não foi incluída nem publicada.

URL prevista: `https://southamerica-east1-sismorcego-50b25.cloudfunctions.net/evaluationAccess`.

Permissões existentes reutilizadas:

| Papel customizado | Permissões | Vinculação |
| --- | --- | --- |
| `SismorcegoEvaluationRead` | `firebaseauth.users.get`, `datastore.entities.get` | Emissor no projeto |
| `SismorcegoEvaluationSignBlob` | `iam.serviceAccounts.signBlob` | Emissor sobre ele próprio |
| `SismorcegoEvaluationImpersonate` | `iam.serviceAccounts.getAccessToken` | Operador sobre o emissor |

O operador `sismorcego@gmail.com` mantém Owner preexistente. Nenhum papel administrativo adicional foi atribuído. O runtime não precisa criar usuários, escrever ocorrências/configurações ou alterar claims. ADC usa impersonação; não há chave privada baixada.

Auth, Firestore, IAM Credentials e API Cloud Functions já estavam disponíveis. Cloud Run, Cloud Build e Artifact Registry permaneciam desabilitados na auditoria; não havia funções v1/v2 publicadas. Projeto continua Spark, sem faturamento habilitado.

**Cloud Functions exige Blaze para publicação.** Emuladores não exigem esse upgrade. Referências: [pré-requisitos oficiais](https://firebase.google.com/docs/functions/get-started), [planos Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens) e [sessões](https://firebase.google.com/docs/auth/admin/manage-sessions).

Após autorização, conferir a conta de faturamento, serviços e identidades gerenciadas exigidas pela plataforma. Não conceder privilégios novos ao runtime sem consultar o proprietário. Escopo de implantação previsto:

```powershell
firebase deploy --only functions:coordinator-evaluation --project sismorcego-50b25
```

Não executar antes da autorização de faturamento. Regras foram publicadas separadamente com `--only firestore:rules`, sem índices, Functions ou outros serviços.

## Proteções e limites

Endpoint aceita GET de status e POST JSON somente com `{ "version": 1 }`. O chamador não define UID, papel ou datas. Respostas têm `no-store`; o código não registra tokens, corpos de pedidos, usuários ou IPs brutos.

Configuração: zero instâncias mínimas, uma máxima, concorrência 16, memória 256 MiB e timeout 15 segundos. Limitador em memória: 60 emissões/IP/10 minutos e 120 globais/10 minutos; status 180/IP/minuto e 600 globais/minuto. Chaves são hashes; tabela limitada e janelas expiram. Contadores reiniciam em cold starts: **não são quota durável/distribuída nem teto de gastos**. Redes compartilhadas podem atingir limites e precisar aguardar.

O endpoint é público pelo fluxo sem ativação individual. Quem souber URL/protocolo pode solicitar a conta enquanto autorizada, inclusive sem instalar o APK. Ele não comprova identidade humana. Essa é uma consequência da distribuição/conta compartilhada aceita pelo proprietário; CORS não impede clientes nativos ou scripts.

App Check/Play Integrity não foi imposto: APK fora da Play exige configuração compatível e isso não identifica coordenadores. Não foram criadas listas ou barreiras individuais. Encerre o controle global ao terminar a avaliação.

Blaze possui franquias, mas build, artefatos, execução, rede e logs podem gerar cobranças. Instância máxima e limitadores reduzem exposição, sem garantir custo zero ou teto financeiro.

## Preservação

Mantidos splash somente na abertura, tutorial, cinco abas, Painel/mapa/gráficos, formulários, alertas, sincronização, PDFs, responsável humano, animações adaptativas, acessibilidade e correções de teclado/dock/scrollbar. A tela de status usa transição existente com entrada, saída e movimento reduzido.

Minha conta mostra `Sismorcego`, e-mail `************`, sem alteração de senha. O responsável informado no aparelho continua em `nomeAcs`, histórico e PDF; a conta compartilhada não é usada como nome humano. Push e Storage continuam desativados. APK homologation mantém nome `Sismorcego` e pacote `com.sismorcego.homologacao`.

## Validação

- **624 testes / 60 suítes do app aprovados.**
- **83 testes / 5 suítes Firebase aprovados.** SDKs reais contra Auth/Firestore/Functions locais e transporte HTTP real. Dois clientes independentes usam o mesmo UID; restauração, expiração, prorrogação, suspensão, revogação, conexão e recuperação exercitados. Contas normais preservadas; configuração protegida contra escrita do cliente.
- ESLint dos JS/CJS novos/alterados: zero erros e um aviso de nome de parâmetro em teste. `git diff --check` aprovado.
- Bundle de produção e builds `assembleEmulator` / `assembleHomologation`: sucesso, ABIs `arm64-v8a` e `x86_64`.
- Integração real: conta/perfil/claim, assinatura remota, troca do custom token em memória e bloqueio de ocorrências durante suspensão confirmados. Nenhum arquivo de ativação gerado. **Novo fluxo automático real ainda não foi validado**, pois o endpoint não está publicado.
- Functions local executou Node 24 do host; produção declara Node 22 e ainda depende de implantação.
- Admin SDK 14.5.0 / Functions SDK 7.4.0. Auditoria npm: seis moderadas transitivas, zero altas/críticas; não foram forçadas dependências incompatíveis.

No Android 15/API 35, AVD exclusivo `SismorcegoAutomaticQA35`, a instalação limpa entrou automaticamente no passo 1 do guia. Foram confirmados Registros, Painel, Alertas, formulário coordenador com responsável individual, conta mascarada, reabertura após force-stop, bloqueio por expiração e suspensão, recuperação automática por prorrogação/reativação e abertura sem rede seguida de recuperação automática ao reconectar. Nenhum arquivo de ativação foi usado. Os dois clientes simultâneos foram exercitados pelos SDKs nos testes de integração; não se trata de dois celulares físicos.

O ambiente Android 37/16 KB avisou sobre incompatibilidade das dependências nativas existentes e encerrou durante desenho SVG. A falha não se repetiu no Android 15 com o mesmo APK. Ela permanece uma limitação observada: não há certificação de suporte a páginas de 16 KB e a distribuição deve considerar essa conferência pendente. Não foram alterados SVGs, telas ou dependências nativas para tentar contornar o problema fora do escopo.

As regras mantêm os validadores existentes e acrescentam o prazo somente para a conta de avaliação. Dois avisos de tipos preexistentes permanecem na compilação. Antes da distribuição ampla, revisar o protótipo:

> I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for requiring authenticated role/ownership checks, enforcing the evaluation deadline with server time, and denying client changes to the evaluation configuration. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

## Arquivos, APK e evidências

Implementação: `src/services/{evaluationApi,evaluationSession,appEnvironment}.js`, `src/hooks/EvaluationAuthProvider.js`, `src/pages/Auth/EvaluationSetupScreen.js`, registro Android `SismorcegoBuildPackage.kt`, `functions-evaluation/{index.js,access.js,package.json,package-lock.json}`, `firebase.json` e `firestore.rules`.

Testes: `__tests__/evaluation{Api,StatusScreen,Session,AuthProvider}.test.js`, `__tests__/startupSplash.test.js`, `emulator-tests/{coordinatorEvaluation,evaluationAccess,evaluationRules}.test.js`, `.eslintrc.js` e `scripts/run-firebase-emulators.cjs`.

Removidos: `scripts/provision-coordinator-device.cjs`, `SismorcegoProvisioningModule.kt` e `__tests__/evaluationProvisioningTool.test.js`. Este documento substitui as instruções antigas de ativação manual.

APK real preparado e instalado no AVD: `android/app/build/outputs/apk/homologation/app-homologation.apk`, ainda dependente do backend. Tamanho: 166163977 bytes. SHA-256: `bd807ce1fb00f303f3c5824fbe7c9d39cf57eb5f3be1fbdea9f632c7b45708da`.

APK local: `android/app/build/outputs/apk/emulator/app-emulator.apk`. SHA-256: `40f8b3633f4a2902ec9b78c8e1955ca1bcf863240af63b8178819b07e1fc2911`. Ambos contêm o bundle atual e ABIs `arm64-v8a`/`x86_64`, conferidos dentro do ZIP.

Evidências ignoradas pelo Git em `android/app/build/evaluation-auto-qa/`: snapshot inicial, `tests-app-delivery.log`, `tests-firebase-delivery.log`, `lint-delivery.log`, `build-verified.log`, `rules-deploy-verified.log`, backup `firestore-before.rules`, `real-policy-verification.json`, `iam-final.json`, `apk-verification.json`, `android-verification.json` e capturas `automatic-*.png/xml`. A validação real não escreve credenciais nos logs. A conferência IAM confirmou os dois usuários originais e as vinculações anteriores preservados, papéis customizados iguais ao plano aprovado e zero chaves privadas geradas.

Bundle e recursos foram gerados na pasta QA e sobrepostos com init Gradle temporário. Os 270 arquivos originalmente não rastreados, inclusive bundle/recursos de `src/main`, são preservados. Nenhuma outra branch, main ou remoto deve ser alterado; somente commit local na branch solicitada.
