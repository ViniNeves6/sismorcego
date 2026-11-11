# Sismorcego web (iPhone e navegador)

As mesmas telas do app (`../src`), rodando no navegador com **react-native-web** e o **Firebase real**.
Serve principalmente para o iPhone, sem App Store: abre no Safari e vira um ícone na tela de início.

## Comandos

```bash
cd web
npm install          # só na primeira vez (e `npm install` na raiz do projeto)
npm start            # http://localhost:5174, recompila ao salvar
npm run build        # gera web/dist para publicar
```

## Publicar no Netlify (gratuito)

- **Arrastar e soltar:** `npm run build` e arraste a pasta `web/dist` em https://app.netlify.com/drop.
- **Pelo GitHub:** conecte o repositório no Netlify; o `netlify.toml` da raiz já define build e pasta.

## No iPhone

Safari → abrir o link → botão Compartilhar → **Adicionar à Tela de Início**. Abre em tela cheia, como um app.

## Como funciona

- `build.mjs`: esbuild com os pacotes nativos trocados por versões de navegador (`shims/`).
- `overrides/`: módulos do app com implementação web:
  - `db.js`: o mesmo SQL da fila offline, executado pelo SQLite em WebAssembly (sql.js) e salvo no IndexedDB;
  - `firebase.js`: sessão no IndexedDB do navegador;
  - `deviceCapture.js`: GPS do navegador e foto pelo seletor do Safari (câmera ou fototeca), reduzida para JPEG;
  - (a abertura usa a cena `src/ui/WelcomeScene.js`, que roda no navegador sem ajustes)
- Mapa: Leaflet + OpenStreetMap. PDF: gerado em JavaScript, aberto/compartilhado pelo navegador.
- Sem notificações push nem leitura de voz garantida no iPhone (limitações do Safari).
