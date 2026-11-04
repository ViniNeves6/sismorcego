# Auditoria das alterações posteriores ao texto compacto dos alertas

Data: 30/10/2026. Branch: `feature/redesign-teste`. HEAD: `a02103805286b2e1ce463cccc044d80b6f669c32`.

## Resultado

Não foram encontradas regressões no código executado em relação à revisão que alterou a descrição para **“Novos alertas para leitura”**. A splash implementada posteriormente também está preservada. Há, porém, dois problemas no APK disponível: seu JavaScript ainda é o da revisão anterior à splash, e suas bibliotecas nativas atendem somente a x86_64.

O código do aplicativo não foi modificado nesta auditoria. Não houve commit, push, troca de branch, instalação em aparelho ou publicação no Firebase.

## Comparação com a revisão anterior

O APK com nome específico `app-homologation-alertas-texto-compacto.apk` não está mais no diretório de saída. Entretanto, o bundle extraído do atual `android/app/build/outputs/apk/homologation/app-homologation.apk` tem SHA-256 **idêntico** ao registrado em `android/app/build/alerts-compact-text-verification.json`:

`1ca1f7b1a7faedbee0bc580a179b5059a46b8ab6fcbfe9e4d74f16c2fac0f90f`

Isso permitiu comparar o JavaScript efetivamente empacotado naquela revisão com um bundle Android de produção gerado agora, em diretório separado:

- 1.440 módulos na revisão do texto compacto.
- 1.439 corpos de módulos preservados integralmente na versão atual, sem redirecionamentos inesperados de dependências.
- Nenhum módulo anterior removido.
- O único módulo anterior alterado é `src/navigation/index.js`, com a integração solicitada da splash.
- Os módulos adicionais vêm da splash, dos morcegos e das dependências antes não utilizadas por esse fluxo.
- O bundle gerado nesta auditoria é idêntico ao bundle validado ao concluir a implementação da splash: `729b37a9ae6b43eb7b364cdb6cfe664fc0870997674f64542535c40352b61727`.

Também foram comparadas cópias de fontes salvas nos relatórios anteriores de ESLint. Dez arquivos conferem integralmente, normalizando apenas as quebras de linha: `SismorcegoShell`, `MaisScreens`, `NovaNotificacaoScreen`, `RegistrosScreen`, `Badge`, `RecordDetailsModal`, `SpotlightGuideModal`, `SpotlightWelcomeModal`, `SyncNowButton` e `ThemedDialogs`. Nos outros dois arquivos com cópia disponível, as diferenças são as esperadas: texto compacto em `AdminAlertsScreen` e integração da splash em `navigation/index`.

Os hashes registrados antes da splash também conferem para Shell, autenticação, preferências de acessibilidade, rotas de autenticação e cadastro, boas-vindas, tutorial e imagens originais. A data de modificação posterior de um arquivo não comprovou, por si só, alteração de conteúdo: o Shell, por exemplo, permanece igual à cópia anterior.

## Correções verificadas

- Texto compacto e estilos de alinhamento do resumo de alertas preservados.
- Menu oculto durante a digitação e restauração do espaço após fechar o teclado.
- Limpeza do formulário com retorno ao topo.
- Entrada e saída de detalhes, popups e telas, incluindo composição do fade, cancelamento, Voltar e movimento reduzido.
- Alto contraste, tamanho de texto e leitura por voz nos cenários automatizados existentes.
- Carregamento adiado do mapa e bloqueio de carregamento/sincronização durante o primeiro tutorial.
- Calendário, campos condicionais, rolagem das perguntas, PDF, edição, cancelamento, histórico e regras de acesso nos testes existentes.
- Splash automática com e sem sessão autenticada, duração mínima, saída, cancelamento e preferências de acessibilidade.
- Manifesto atual e manifesto do APK preservam orientação retrato, `adjustResize`, consulta ao serviço TTS e propriedade de compatibilidade da rotação.

## Problema encontrado no pacote

Arquivo inspecionado: `android/app/build/outputs/apk/homologation/app-homologation.apk`.

SHA-256 do APK: `0ea8477aa1c3208457fa45df16d6340f2e8ddbb8b0fcfa998bc7a337b58d45431`.

1. O bundle ainda corresponde exatamente à revisão do texto compacto. A splash está no código atual, mas não é executada por esse APK.
2. As bibliotecas nativas estão presentes somente para **x86_64**. As evidências do APK anterior registravam quatro arquiteturas. Esse pacote atual não atende um S25 ARM64.

Para distribuir o estado atual ao aparelho, é necessário gerar novamente o bundle e um APK com ARM64, ou universal. Nenhum APK foi regenerado nesta auditoria.

## Validação e limites

**507 testes aprovados em 51 suítes**, sem falhas. Nenhum caso foi removido ou alterou seu nome em relação à validação final da splash. Um novo bundle Android de produção foi gerado com sucesso. ESLint em 15 arquivos relevantes: zero erros e 15 avisos de estilo já existentes.

Não houve reprodução visual no S25. Os testes de eventos nativos usam simulações; a comparação de módulos não substitui a inspeção visual no aparelho. Como as alterações locais não foram divididas em commits, não é possível atribuir cada gravação de arquivo a uma IA específica. As conclusões se apoiam no conteúdo recuperado, hashes e testes, não apenas nas datas dos arquivos.

Evidências locais, mantidas na pasta de build ignorada pelo Git:

- `android/app/build/regression-audit/verification.json`
- `android/app/build/regression-audit/source-comparison.json`
- `android/app/build/regression-audit/eslint.json`
- `android/app/build/regression-audit/bundle.log`
- `android/app/build/regression-audit-tests.json`
- `android/app/build/regression-audit-tests.log`
