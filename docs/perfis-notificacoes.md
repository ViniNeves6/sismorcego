# Acesso às notificações

O projeto usa os papéis `acs` e `coordenador` em `usuarios/{uid}.role`.
O coordenador corresponde ao perfil administrativo. Valores ausentes ou
desconhecidos não autorizam a área administrativa.

- O ACS continua com Registros, Notificar e Mais. O antigo sino e seu modal de
  pendências não são montados pelo aplicativo. Pendências continuam no resumo
  de sincronização, no filtro Pendentes e nos cartões dos registros.
- O coordenador usa as abas Painel e Alertas. **Mais → Painel** e
  **Mais → Notificações** abrem essas mesmas abas, dentro de `SismorcegoShell`.
  As telas antigas foram preservadas como código legado, sem rotas paralelas
  no navegador ativo.
- `canAccessCoordinatorArea` centraliza a política usada pelo menu, pelas rotas,
  pela tela e pelo contador administrativo. `useCoordinatorNavigation` protege
  os atalhos do menu e a abertura por notificações locais, inclusive quando
  o perfil muda durante uma operação assíncrona.
- `useCoordinatorAlerts` compartilha o feed, o contador e a resolução das
  ocorrências para os cartões e detalhes. O cache é restrito à sessão e os
  registros são identificados pelo ACS e pelo identificador da ocorrência.
- Preferências de avisos do sistema, mensagens de erro, sincronização e a fila
  de registros permanecem independentes dessa área.

As regras locais do Firestore também exigem o papel `coordenador` para acessar
`usuarios/{uid}/notificacoes`, mantendo a exigência de ser o dono do perfil.
A alteração dessas regras precisa ser publicada no Firebase para valer na nuvem;
nenhuma publicação é feita pela geração do APK.

No modo local de testes, o login permanece desativado e a central não inicia
consultas ou gravações no Firebase. O papel padrão continua sendo `acs`.
