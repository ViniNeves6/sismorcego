# Prévia no navegador

Renderiza as **mesmas telas e a mesma navegação** do app (via `react-native-web`), dentro de uma moldura de celular.
Serve para ver o visual enquanto não há Xcode/Android Studio. **Não é o app nativo**: fontes, sombras, teclado,
gestos e desempenho mudam no aparelho.

## Como usar

```bash
cd preview
npm install      # só na primeira vez
npm start        # abre em http://localhost:5173
```

- Entre com qualquer e-mail e senha. Nada vai ao Firebase: os dados são fictícios (`stubs/demoData.js`).
- Barra superior: alterna tema claro/escuro. Alto contraste: **Mais → Configurações**.
- Em `?logged=1` o app abre já logado.
- `npm run shots` percorre o app e salva capturas de tela em `preview/shots/` (requer o Google Chrome).

## O que é simulado

Mapa, PDF, GPS, câmera/galeria, rede, Firebase e SQLite têm versões de exemplo em `stubs/`.
As telas do app (`src/`) rodam sem alterações.
