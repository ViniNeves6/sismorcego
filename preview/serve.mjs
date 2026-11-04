// Prévia no navegador: `npm start` e abra http://localhost:5173
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { options } from './build.config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');

const copyStatic = () => {
  fs.mkdirSync(dist, { recursive: true });
  fs.copyFileSync(path.join(here, 'index.html'), path.join(dist, 'index.html'));
  fs.copyFileSync(path.join(here, 'public/Feather.ttf'), path.join(dist, 'Feather.ttf'));
};

const ctx = await esbuild.context({
  ...options,
  // copia index.html/fonte a cada rebuild (alterações no HTML entram sem reiniciar)
  plugins: [...options.plugins, { name: 'static', setup: (b) => b.onEnd(copyStatic) }],
});
copyStatic();
await ctx.rebuild().catch(() => process.exit(1)); // falha cedo se não compilar
const port = Number(process.env.PORT) || 5173;
await ctx.watch();
const { hosts } = await ctx.serve({ servedir: dist, port, host: '127.0.0.1' });
console.log(`\nPrévia rodando em http://localhost:${port}  (Ctrl+C para parar)\n`);
