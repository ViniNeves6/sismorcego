import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const stub = (f) => path.join(here, 'stubs', f);

// Módulos do PRÓPRIO app trocados por versões de demonstração (sem Firebase/SQLite).
const APP_STUBS = {
  'src/hooks/useAuth': stub('useAuth.js'),
  'src/services/firebase': stub('firebase.js'),
  'src/services/offlineQueue': stub('offlineQueue.js'),
  'src/services/syncRegistros': stub('syncRegistros.js'),
  'src/database/db': stub('db.js'),
};

const appStubsPlugin = {
  name: 'app-stubs',
  setup(build) {
    build.onResolve({ filter: /^\.{1,2}\// }, (args) => {
      const rel = path.relative(ROOT, path.resolve(args.resolveDir, args.path)).replace(/\.js$/, '');
      if (APP_STUBS[rel]) return { path: APP_STUBS[rel] };
    });
  },
};

export const options = {
  entryPoints: [path.join(here, 'entry.js')],
  bundle: true,
  outdir: path.join(here, 'dist'),
  entryNames: 'app',
  assetNames: 'assets/[name]-[hash]',
  publicPath: '/',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  sourcemap: true,
  logLevel: 'warning',
  loader: { '.js': 'jsx', '.png': 'file', '.ttf': 'file' },
  resolveExtensions: ['.web.js', '.web.jsx', '.js', '.jsx', '.json', '.mjs', '.cjs'],
  define: { __DEV__: 'true', 'process.env.NODE_ENV': '"development"', global: 'window' },
  alias: {
    // uma única cópia do React (a do app)
    react: path.join(ROOT, 'node_modules/react'),
    'react-dom': path.join(here, 'node_modules/react-dom'),
    // react-native → react-native-web com ajustes da prévia
    'react-native': stub('rn.js'),
    'react-native-vector-icons/Feather': stub('feather.js'),
    'react-native-linear-gradient': stub('linearGradient.js'),
    'react-native-maps': stub('maps.js'),
    'react-native-pdf': stub('pdf.js'),
    '@react-native-community/datetimepicker': stub('datetimepicker.js'),
    '@react-native-community/netinfo': stub('netinfo.js'),
    '@react-native-community/geolocation': stub('geolocation.js'),
    'react-native-image-picker': stub('imagePicker.js'),
    'react-native-image-resizer': stub('imageResizer.js'),
    'react-native-fs': stub('fs.js'),
    'react-native-html-to-pdf': stub('htmlToPdf.js'),
    'react-native-blob-util': stub('blobUtil.js'),
    'react-native-tts': stub('tts.js'),
    'react-native-get-random-values': stub('empty.js'),
    '@react-native-async-storage/async-storage': stub('asyncStorage.js'),
    'firebase/firestore': stub('firestore.js'),
    'react-native-safe-area-context': stub('safeArea.js'),
    '@react-native-masked-view/masked-view': stub('maskedView.js'),
    'react-native-screens': stub('screens.js'),
  },
  plugins: [appStubsPlugin],
};
