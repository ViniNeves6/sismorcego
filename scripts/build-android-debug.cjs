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
run(process.execPath, [path.join(root, 'node_modules/react-native/cli.js'), 'bundle',
  '--platform', 'android', '--dev', 'false', '--entry-file', 'index.js',
  '--bundle-output', 'android/app/src/main/assets/index.android.bundle',
  '--assets-dest', 'android/app/src/main/res', '--max-workers', '2'], root);
if (process.platform === 'win32') run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `gradlew.bat ${task} --console=plain`], path.join(root, 'android'));
else run('./gradlew', [task, '--console=plain'], path.join(root, 'android'));
