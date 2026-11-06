/* eslint-env node */
// Team workstation only. Never imported by the app. No account creation,
// role changes, permanent credentials or tokens printed to the terminal.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function options(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (['--production', '--emulator'].includes(key)) result[key.slice(2)] = true;
    else if (['--project', '--uid', '--installation', '--output', '--service-account'].includes(key) && argv[i + 1] && !argv[i + 1].startsWith('--')) result[key.slice(2)] = argv[++i];
    else throw new Error('Argumentos inválidos. Consulte docs/avaliacao-coordenadores.md.');
  }
  return result;
}
function validateOptions(value, env = process.env) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value.uid || '') || !/^[A-Za-z0-9_-]{20,128}$/.test(value.installation || '') || !value.output) throw new Error('Informe UID, código do aparelho e arquivo de saída.');
  if (value.production === true && !value.emulator) {
    if (value.project !== 'sismorcego-50b25' || env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST) throw new Error('Projeto/ambiente de produção incompatível. Nenhuma credencial foi emitida.');
    const relative = path.relative(path.resolve(__dirname, '..'), path.resolve(value.output));
    if (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) throw new Error('O arquivo de produção deve ficar fora do repositório e do APK.');
  } else if (value.emulator === true && !value.production) {
    if (value.project !== 'demo-sismorcego-spark' || env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8088') throw new Error('Emuladores locais obrigatórios; não há fallback para produção.');
  } else throw new Error('Escolha explicitamente --emulator ou --production (somente com autorização da equipe).');
  return value;
}
function writePrivateFile(destination, content) {
  const target = path.resolve(destination);
  const fd = fs.openSync(target, 'wx', 0o600); // Never overwrite another credential file.
  try {
    if (process.platform === 'win32') {
      const identity = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true });
      const matches = identity.match(/S-1-[0-9-]+/g);
      const sid = matches && matches[0];
      if (!sid) throw new Error('Não foi possível restringir o arquivo à conta Windows atual.');
      execFileSync('icacls.exe', [target, '/inheritance:r', '/grant:r', `*${sid}:F`], { stdio: 'pipe', windowsHide: true });
    } else fs.fchmodSync(fd, 0o600);
    fs.writeFileSync(fd, content, { encoding: 'utf8' });
  } catch (error) {
    fs.closeSync(fd); fs.unlinkSync(target); throw error;
  }
  fs.closeSync(fd);
  return target;
}
async function provision(value) {
  validateOptions(value);
  if (fs.existsSync(path.resolve(value.output))) throw new Error('O arquivo de saída já existe. Escolha outro nome.');
  const { initializeApp, applicationDefault, deleteApp } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore } = require('firebase-admin/firestore');
  const app = initializeApp({ projectId: value.project,
    ...(value.production ? { credential: applicationDefault(), ...(value['service-account'] ? { serviceAccountId: value['service-account'] } : {}) } : {}),
  }, `provision-${Date.now()}`);
  try {
    const auth = getAuth(app), db = getFirestore(app);
    const user = await auth.getUser(value.uid);
    const role = await db.doc(`usuarios/${value.uid}`).get();
    if (user.disabled || user.displayName !== 'Sismorcego Teste' || !user.customClaims || user.customClaims.sismorcegoEvaluationAccount !== true ||
      !role.exists || !role.data() || role.data().role !== 'coordenador') throw new Error('A equipe ainda precisa autorizar a conta compartilhada e seu papel. Nada foi alterado.');
    const customToken = await auth.createCustomToken(user.uid, { evaluationInstallation: value.installation });
    const expiresAt = JSON.parse(Buffer.from(customToken.split('.')[1], 'base64url').toString()).exp * 1000;
    const packet = { version: 1, projectId: value.project, uid: user.uid, installationId: value.installation, expiresAt, customToken };
    return writePrivateFile(value.output, JSON.stringify(packet));
  } finally { await deleteApp(app); }
}
if (require.main === module) {
  let input;
  try { input = validateOptions(options(process.argv.slice(2))); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
  if (input) provision(input).then(target => process.stdout.write(`Arquivo privado criado: ${target}\nImporte apenas no aparelho indicado e remova o arquivo após o uso.\n`))
    .catch(() => { process.stderr.write('Não foi possível emitir a configuração. Verifique autorização da conta, permissões administrativas externas, conexão e destino privado. Nenhum segredo foi exibido.\n'); process.exitCode = 1; });
}
module.exports = { options, validateOptions, writePrivateFile, provision };
