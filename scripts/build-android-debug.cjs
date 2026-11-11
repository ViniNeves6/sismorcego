/* eslint-env node */
// Gera um APK de depuração com o JavaScript atual, utilizável sem Metro.
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const task = process.argv.includes('--homologation') ? 'app:assembleHomologation' : 'app:assembleDebug';
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
