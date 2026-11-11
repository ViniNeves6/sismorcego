// Build da versão web (PWA). `npm run build` gera web/dist; `npm start` serve em http://localhost:5174.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const dist = path.join(here, 'dist');
const serve = process.argv.includes('--serve');
const shim = f => path.join(here, 'shims', f);

// Módulos do próprio app com implementação de navegador (o resto de src/ roda igual).
const APP_OVERRIDES = {
  'src/services/firebase': path.join(here, 'overrides/firebase.js'),
  'src/database/db': path.join(here, 'overrides/db.js'),
  'src/services/deviceCapture': path.join(here, 'overrides/deviceCapture.js'),
};
const overridesPlugin = {
  name: 'app-overrides',
  setup(build) {
    build.onResolve({ filter: /^\.{1,2}\// }, args => {
      if (args.importer.startsWith(path.join(here, 'overrides'))) return undefined;
      const rel = path.relative(ROOT, path.resolve(args.resolveDir, args.path)).replace(/\.js$/, '');
      return APP_OVERRIDES[rel] ? { path: APP_OVERRIDES[rel] } : undefined;
    });
  },
};

const options = {
  entryPoints: [path.join(here, 'entry.js')],
  bundle: true, outdir: dist, entryNames: 'app', assetNames: 'assets/[name]-[hash]', publicPath: '/',
  format: 'iife', platform: 'browser', target: ['es2020', 'safari15'], jsx: 'automatic',
  minify: !serve, sourcemap: serve, logLevel: 'warning', legalComments: 'none',
  loader: { '.js': 'jsx', '.png': 'file', '.jpg': 'file', '.ttf': 'file', '.wasm': 'file' },
  resolveExtensions: ['.web.js', '.web.jsx', '.web.ts', '.web.tsx', '.js', '.jsx', '.ts', '.tsx', '.json', '.mjs', '.cjs'],
  mainFields: ['browser', 'module', 'main'],
  conditions: ['browser', 'import', 'default'],
  nodePaths: [path.join(ROOT, 'node_modules')],
  define: { __DEV__: String(serve), 'process.env.NODE_ENV': serve ? '"development"' : '"production"', global: 'globalThis' },
  alias: {
    react: path.join(ROOT, 'node_modules/react'),
    'react-dom': path.join(here, 'node_modules/react-dom'),
    'react-native': shim('rn.js'),
    'react-native-web': path.join(here, 'node_modules/react-native-web'),
    'react-native-vector-icons/Feather': shim('feather.js'),
    'react-native-linear-gradient': shim('linearGradient.js'),
    'react-native-maps': shim('maps.js'),
    'react-native-pdf': shim('pdf.js'),
    'react-native-share': shim('share.js'),
    'react-native-fs': shim('fs.js'),
    'react-native-blob-util': shim('empty.js'),
    'react-native-html-to-pdf': shim('empty.js'),
    'react-native-image-picker': shim('imagePicker.js'),
    'react-native-image-resizer': shim('imageResizer.js'),
    '@bam.tech/react-native-image-resizer': shim('imageResizer.js'),
    'react-native-keychain': shim('keychain.js'),
    'react-native-encrypted-storage': shim('encryptedStorage.js'),
    'react-native-sqlite-storage': shim('empty.js'),
    'react-native-tts': shim('tts.js'),
    'react-native-get-random-values': shim('empty.js'),
    'react-native-screens': shim('screens.js'),
    '@notifee/react-native': shim('notifee.js'),
    '@react-native-firebase/messaging': shim('messaging.js'),
    '@react-native-firebase/app': shim('empty.js'),
    '@react-native-community/geolocation': shim('geolocation.js'),
    '@react-native-community/datetimepicker': shim('datetimepicker.js'),
  },
  external: ['fs', 'path', 'crypto'], // citados pelo sql.js só no Node; nunca executados no navegador
  plugins: [overridesPlugin],
};

function copyStatic() {
  fs.mkdirSync(path.join(dist, 'fonts'), { recursive: true });
  fs.cpSync(path.join(here, 'public'), dist, { recursive: true });
  fs.copyFileSync(path.join(here, 'index.html'), path.join(dist, 'index.html'));
  fs.copyFileSync(path.join(here, 'node_modules/sql.js/dist/sql-wasm.wasm'), path.join(dist, 'sql-wasm.wasm'));
  fs.copyFileSync(path.join(ROOT, 'node_modules/react-native-vector-icons/Fonts/Feather.ttf'), path.join(dist, 'fonts/Feather.ttf'));
  for (const f of fs.readdirSync(path.join(ROOT, 'android/app/src/main/assets/fonts'))) {
    fs.copyFileSync(path.join(ROOT, 'android/app/src/main/assets/fonts', f), path.join(dist, 'fonts', f));
  }
}

fs.rmSync(dist, { recursive: true, force: true });
copyStatic();
if (!serve) {
  await esbuild.build(options);
  console.log('Versão web gerada em', dist);
} else {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.map': 'application/json' };
  http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(dist, url);
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  }).listen(5174, () => console.log('Sismorcego web em http://localhost:5174'));
}
