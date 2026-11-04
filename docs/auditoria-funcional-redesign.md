# Auditoria funcional do redesign

Comparação com `C:\Users\bradg\sismorcego`, mantendo o visual do redesign e as animações de entrada e saída. O projeto antigo foi consultado sem alterações.

| Problema encontrado | Correção |
| --- | --- |
| A navegação ignorava o login e o contexto desativava o Firebase em desenvolvimento. | Login, cadastro, recuperação e encerramento de sessão usam o Firebase real. A sessão persistida abre offline; o papel do usuário é atualizado pela base e mantido em cache por conta. |
| Histórico inicial preenchido com dois exemplos, nome e email fictícios e data fixa. | Histórico começa vazio e perfil vem da conta autenticada. A data é escolhida pelo usuário. Somente as duas amostras exatas são removidas; registros reais do HTML são migrados para a fila criptografada. |
| Salvar chamava funções inexistentes da fila e escondia erros. Edição e exclusão alteravam apenas AsyncStorage. | Salvamento e edição usam SQLite/AES/Keychain. Exclusões offline ficam pendentes para envio. Os erros são exibidos e os formulários só são limpos depois da gravação confirmada. |
| Sincronização podia enviar a fila de outra conta e apagar uma edição feita durante o envio. | Fila filtrada por UID, atualização condicionada à revisão enviada e nova passagem quando necessário. Falhas continuam disponíveis para nova tentativa. Os enviados mantêm cópia criptografada para consulta offline. |
| O formato do HTML não correspondia ao Firestore, ao painel e aos PDFs existentes. | Adaptador entre os rótulos visuais e os códigos originais, preservando os dados antigos. Campos de praia, motivo de não buscar atendimento e descrição do abrigo foram recuperados. Datas sem horário mantêm o dia correto no Brasil. |
| GPS inventava coordenadas e município após falha ou permissão negada. O mapa tinha ruas desenhadas como fallback. | Captura apenas coordenadas reais, respeita permissões e comunica falhas. Geocodificação não sobrescreve o município digitado. Mapa nativo do projeto antigo, com câmera e galeria abaixo. |
| Câmera, galeria e foto de perfil podiam confirmar sucesso em caso de erro. | Seleção real, cópia durável da imagem e redução para envio. Prévia e remoção do anexo. A foto de perfil continua local e pode ser alterada sem enviar o restante do formulário da conta. |
| Alteração de perfil e senha mostrava sucesso sem executar a operação. | Atualização real do Firebase, recuperação por email e tratamento de falhas, incluindo necessidade de refazer login. |
| Dúvidas eram apenas locais e as perguntas frequentes eram exemplos fixos. | Envio/exclusão reais no Firestore e respostas acompanhadas em tempo real. Perguntas antigas não enviadas são preservadas como rascunhos criptografados, com ação explícita de revisar e enviar. |
| Configurações não estavam ligadas ao contexto existente; fonte só mudava na amostra. | Preferências persistidas; fonte e contraste aplicados às telas do redesign; leitura usa TTS; redução de movimento respeitada pelas transições. Notificações verificam a permissão do sistema e a preferência por conta. |
| As telas de coordenador e a geração de PDFs ficaram inacessíveis. | Painel e notificações restaurados para coordenadores. PDF disponível nos detalhes, com escolha de incluir nomes/localização, visualização e salvamento. Tocar em uma notificação abre o feed. |
| Inicialização do SQLite aplicava PRAGMAs incompatíveis dentro de uma transação. | Configuração feita fora da transação; falha na chave de proteção não usa mais uma chave fictícia. |
| Havia um bundle antigo incluído no APK. | Bundle regenerado e comando `npm run android:apk` criado para gerar o APK com o JavaScript atual. |

## Validação

- 72 testes automatizados passaram, cobrindo compatibilidade dos quatro tipos de vítima, migração, isolamento entre contas, falha de gravação/envio, edição durante sincronização, exclusão offline, busca sem acentos, permissões do GPS, câmera/galeria, conta, senha, dúvidas e configurações.
- ESLint sem erros nos arquivos de aplicação, testes e script de geração do APK.
- Bundle Android e `app:assembleDebug` compilados.
- Conteúdo de `assets/index.android.bundle` dentro do APK conferido por SHA-256 contra o bundle recém-gerado.
- Emulador iniciado com imagem de dados separada da imagem habitual. Abertura do app e navegação entre login, cadastro e recuperação verificadas; formulários vazios exibiram os erros esperados.

## Pendências externas e limites da verificação

- As regras de acesso a `duvidas` estão preparadas em `firestore.rules` e precisam ser publicadas no Firebase para aplicar essa configuração ao servidor. Nenhuma regra foi publicada nesta tarefa.
- Não foram criadas contas nem enviados registros/perguntas de teste para a base real. GPS/câmera físicos e operações autenticadas no Firebase ainda precisam de validação com conta e dispositivo reais.
- O emulador Android 37 com páginas de 16 KB exibiu aviso de compatibilidade das bibliotecas nativas, incluindo `libpdfiumandroid.so`. O app abriu em modo de compatibilidade; esse aviso exige uma verificação específica das dependências nativas antes de distribuição para esses dispositivos.
- Emulador e servidor Metro usados na verificação foram encerrados. A revisão automática bloqueou a exclusão das imagens temporárias do emulador, sem detalhar o motivo; elas permaneceram em `android/app/build/audit-emulator`.

APK gerado: `android/app/build/outputs/apk/debug/app-debug.apk`.
