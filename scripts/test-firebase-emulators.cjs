/* eslint-env node, es2022 */
const path=require('path');
const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const run=spawnSync(process.execPath,[path.join(root,'node_modules/jest/bin/jest.js'),'--config','emulator-tests/jest.config.cjs','--runInBand'],{
  cwd:root,stdio:'inherit',windowsHide:true,
  env:{...process.env,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8088',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'},
});
process.exit(run.status || (run.error ? 1 : 0));
