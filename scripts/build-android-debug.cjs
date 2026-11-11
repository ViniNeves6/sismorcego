/* eslint-env node */
// Na branch de coordenadores, o APK padrão é a homologação com Firebase real.
// As versões de debug/emulador exigem opções explícitas para evitar distribuição acidental.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const flags = ['--homologation', '--debug', '--emulator'].filter(arg => process.argv.includes(arg));
if (flags.length > 1) throw new Error('Escolha apenas um tipo de APK.');
const variant = flags.includes('--debug') ? 'debug' : flags.includes('--emulator') ? 'emulator' : 'homologation';
const task = { homologation: 'app:assembleHomologation', debug: 'app:assembleDebug', emulator: 'app:assembleEmulator' }[variant];
// A versão atual do Gradle não aceita o JBR 25 do Android Studio desta máquina.
// Prioriza o JDK 17 instalado, sem exigir configuração manual a cada build.
if (process.platform === 'win32') {
  const explicitHome = process.env.SISMORCEGO_BUILD_JAVA_HOME;
  const adoptiumRoot = path.join(process.env.ProgramFiles || 'C:/Program Files', 'Eclipse Adoptium');
  const jdk17 = fs.existsSync(adoptiumRoot)
    ? fs.readdirSync(adoptiumRoot).find(name => /^jdk-17[.-]/.test(name) && fs.existsSync(path.join(adoptiumRoot, name, 'bin/java.exe')))
    : null;
  const javaHome = explicitHome || (jdk17 && path.join(adoptiumRoot, jdk17));
  if (javaHome) {
    process.env.JAVA_HOME = javaHome;
    process.env.PATH = path.join(javaHome, 'bin') + path.delimiter + process.env.PATH;
  }
}
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, windowsHide: true, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
// Saídas do empacotamento manual (debug/emulador) gravadas em src/main. Na
// homologação o plugin do React Native gera as suas; as manuais duplicariam recursos.
const manualBundleOutputs = () => {
  const res = path.join(root, 'android/app/src/main/res');
  return [path.join(root, 'android/app/src/main/assets/index.android.bundle'), path.join(res, 'raw/keep.xml'),
    ...fs.readdirSync(res).filter(name => /^drawable-(l|m|h|xh|xxh|xxxh)dpi$/.test(name)).map(name => path.join(res, name))];
};
if (variant === 'homologation') {
  for (const output of manualBundleOutputs()) fs.rmSync(output, { recursive: true, force: true });
} else {
  run(process.execPath, [path.join(root, 'node_modules/react-native/cli.js'), 'bundle',
    '--platform', 'android', '--dev', 'false', '--entry-file', 'index.js',
    '--bundle-output', 'android/app/src/main/assets/index.android.bundle',
    '--assets-dest', 'android/app/src/main/res', '--max-workers', '2'], root);
}
if (process.platform === 'win32') run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `gradlew.bat ${task} --console=plain`], path.join(root, 'android'));
else run('./gradlew', [task, '--console=plain'], path.join(root, 'android'));

if (variant === 'homologation') {
  const source = path.join(root, 'android/app/build/outputs/apk/homologation/app-homologation.apk');
  const targetDir = path.join(root, 'android/app/build/outputs/apk/distribuicao');
  const target = path.join(targetDir, 'Sismorcego-Coordenadores.apk');
  if (!fs.existsSync(source)) throw new Error('O build não gerou o APK de homologação esperado.');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(source, target);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
  console.log('\nAPK DE DISTRIBUIÇÃO (Firebase real; entrada ACS ou coordenador):');
  console.log(target);
  console.log('SHA-256: ' + hash);
} else {
  console.log(`\nAPK de ${variant} gerado APENAS para desenvolvimento/testes. Não distribuir aos coordenadores.`);
}
