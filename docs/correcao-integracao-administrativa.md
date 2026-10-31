# Correção da integração administrativa

Referência visual: `C:/Users/bradg/Downloads/sismorcego-spotlight-passo7-scroll.html`.
O trabalho mantém os estilos das telas administrativas, da barra inferior e do
guia. Não altera formulários, login, captura nativa de GPS/câmera ou boas-vindas.

## Correções

- **Painel:** leitura de `gps.lat/lng`, compatibilidade com coordenadas antigas,
  validação de limites e rejeição de valores vazios, nulos e não numéricos.
  Mapa, contadores e filtros usam o mesmo conjunto de registros.
- **Indicadores e gráfico:** categorias reais de vítima, períodos por dias de
  calendário, exclusão de datas ausentes/inválidas no filtro temporal e nos
  agrupamentos. O gráfico preserva os cinco intervalos, linha, área e grade.
  Histórico vazio produz contagens zero. O mapa acompanha as mudanças de filtro.
- **Navegação:** Mais e as abas inferiores compartilham o mesmo controlador de
  Painel/Alertas. O navegador ativo deixa de registrar as duas telas antigas.
  Os arquivos legados foram preservados; seus serviços de dados/PDF continuam.
- **Alertas:** um único listener fornece lista e contador. A apresentação combina
  os metadados do alerta com a ocorrência correspondente, usando cache de sessão,
  consultas compartilhadas e no máximo quatro leituras simultâneas. Datas aceitam
  Timestamp, Date, ISO e formato brasileiro. Informações ausentes são identificadas
  explicitamente; não são inventados agentes, resumos, locais ou horários.
- **Detalhes:** resolução por ACS + identificador, normalização com `toRecordView`,
  GPS/foto/detalhes epidemiológicos preservados e exportação da origem completa
  para PDF. Uma fotografia remota usa os bytes recebidos, e não o caminho de outro
  aparelho. Registros de outros ACS permanecem somente leitura. Ocorrências
  excluídas, inacessíveis ou sem identificação completa geram mensagens de erro.
- **Leitura dos alertas:** marcar um/todos utiliza os serviços existentes e só
  atualiza o estado após sucesso. Erros no feed permitem tentar novamente, sem
  apresentar uma falha de conexão como caixa vazia.
- **Guia:** mantém cinco etapas para ACS e oito para coordenador. O passo 5 alcança
  o início do formulário. O passo 7 mostra mapa e gráfico no mesmo passo, com o
  intervalo e a animação existentes. A verificação nativa encontrou um limite de
  rolagem que impedia alcançar o último gráfico: um espaço temporário no fim do
  painel resolve esse limite apenas durante o guia. Ele permanece até a saída
  terminar e depois é removido. Voltar ao passo 6 retorna aos indicadores.

A regra que decide quando uma ocorrência gera alerta não foi modificada.

## Arquivos de implementação modificados

| Arquivo | Responsabilidade |
| --- | --- |
| `src/services/adminPanelData.js` | Filtros, GPS, indicadores e agrupamento do gráfico. |
| `src/services/coordinatorAlerts.js` | Apresentação e resolução compartilhada das ocorrências. |
| `src/services/registroAdapter.js` | Fotografia recebida da nuvem. |
| `src/services/registroDate.js` | Datas válidas e Timestamp, sem deslocar datas sem horário. |
| `src/hooks/useCoordinatorAlerts.js` | Feed, cache por sessão, leitura e controle de acesso. |
| `src/hooks/useCoordenadorNotifications.js` | Evita contador duplicado e chamadas de nuvem no teste local. |
| `src/navigation/SismorcegoShell.js` | Navegação única, detalhes somente leitura e ciclo do guia. |
| `src/navigation/index.js` | Remove rotas administrativas paralelas do navegador ativo. |
| `src/pages/Admin/AdminPanelScreen.js` | Conexão com os dados e espaço temporário de rolagem do guia. |
| `src/pages/Admin/AdminAlertsScreen.js` | Estados honestos de ausência/falha, mantendo os estilos. |
| `src/ui/SpotlightGuideModal.js` | Retorno aos indicadores ao voltar ao passo 6. |

Documentação atualizada também em `docs/perfis-notificacoes.md`.

## Verificação

- Suíte inicial: **157 testes / 20 suítes**.
- Suíte final: **190 testes / 23 suítes**, todos aprovados.
- ESLint dos arquivos envolvidos: sem erros.
- Blocos de estilos comparados com as cópias anteriores: preservados.
- Regressões em `adminDataIntegration.test.js`,
  `coordinatorAlertsIntegration.test.js`, `adminShellIntegration.test.js`,
  `coordinatorScreens.test.js`, `notificationAccess.test.js`, `App.test.tsx`,
  `spotlightFeatures.test.js` e `spotlightLayout.test.js`.
- Android: Mais e abas levam às mesmas telas; cinco abas do coordenador, oito
  etapas, rolagem real do mapa ao gráfico, retorno aos indicadores e saída do guia.
  O gráfico chegou ao topo da área visível sem avançar para o passo 8.
- Android ACS: três abas, sem sino/central administrativa; sincronização e filtro
  Pendentes preservados; cinco etapas, posicionamento do formulário, voltar e sair.

Evidências nativas em
`C:/Users/bradg/.codex/tmp/admin-integration-android`, incluindo
`coord-step7-fixed.mp4`, `coord-step7-fixed-map.png` e
`coord-step7-fixed-chart.png`.

## Modo de testes e limites da validação

`LOCAL_TEST_MODE = true` e `LOCAL_TEST_ROLE = 'acs'` permanecem como estavam.
O perfil coordenador foi usado somente em uma compilação temporária de emulador.
Não foram criadas contas, publicados arquivos/regras ou modificados dados no
Firebase. Os cenários de leitura/gravação da nuvem foram testados com fronteiras
Firestore simuladas, incluindo exclusão, falta de permissão e troca de perfil.
Uma validação com contas reais continua dependendo de uma etapa de testes
autorizada separadamente; não foi reativada a autenticação para isso.
