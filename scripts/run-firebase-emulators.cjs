/* eslint-env node, es2022 */
const fs=require('fs'),path=require('path');
const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const candidates=[process.env.SISMORCEGO_EMULATOR_JAVA_HOME,process.env.JAVA_HOME,'C:/Program Files/Android/Android Studio/jbr'].filter(Boolean);
const javaHome=candidates.find(candidate=>{
  const java=path.join(candidate,'bin',process.platform==='win32'?'java.exe':'java');
  if(!fs.existsSync(java))return false;
  const version=spawnSync(java,['-version'],{encoding:'utf8',windowsHide:true});
  return Number((version.stderr || version.stdout).match(/version "(\d+)/)?.[1])>=21;
});
if(!javaHome){console.error('Configure SISMORCEGO_EMULATOR_JAVA_HOME com um JDK 21 ou mais recente.');process.exit(1);}
const command='npx -y firebase-tools@15.34.2 emulators:exec --only auth,firestore --project demo-sismorcego-spark --config firebase.json "node scripts/test-firebase-emulators.cjs"';
const result=process.platform==='win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe',['/d','/s','/c',command],{cwd:root,stdio:'inherit',windowsHide:true,windowsVerbatimArguments:true,env:{...process.env,JAVA_HOME:javaHome,PATH:path.join(javaHome,'bin')+path.delimiter+process.env.PATH}})
  : spawnSync('npx',['-y','firebase-tools@15.34.2','emulators:exec','--only','auth,firestore','--project','demo-sismorcego-spark','--config','firebase.json','node scripts/test-firebase-emulators.cjs'],{cwd:root,stdio:'inherit',env:{...process.env,JAVA_HOME:javaHome,PATH:path.join(javaHome,'bin')+path.delimiter+process.env.PATH}});
process.exit(result.status || (result.error ? 1 : 0));
