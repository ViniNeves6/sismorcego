test.each([undefined,false,'true',true])('only the native homologation boolean %s enables real Firebase',value=>{
  jest.resetModules();
  jest.doMock('react-native',()=>({Platform:{OS:'android'},NativeModules:value===undefined?{}:{SismorcegoBuild:{realFirebase:value}}}));
  const {LOCAL_TEST_MODE,LOCAL_TEST_ROLE}=require('../src/services/debugTestSession');
  expect(LOCAL_TEST_MODE).toBe(value!==true);expect(LOCAL_TEST_ROLE).toBe('acs');
});
test('the separate emulator build authenticates only against the demo backend',()=>{
  jest.resetModules();
  jest.doMock('react-native',()=>({NativeModules:{SismorcegoBuild:{realFirebase:true,firebaseEmulator:true}}}));
  const {REAL_FIREBASE_HOMOLOGATION,USE_FIREBASE_EMULATORS}=require('../src/services/appEnvironment');
  const {LOCAL_TEST_MODE}=require('../src/services/debugTestSession');
  expect(USE_FIREBASE_EMULATORS).toBe(true);expect(REAL_FIREBASE_HOMOLOGATION).toBe(false);expect(LOCAL_TEST_MODE).toBe(false);
});

test('coordinator evaluation never enables the simulated local test user, even in an unconfigured build',()=>{
  jest.resetModules();
  jest.doMock('react-native',()=>({NativeModules:{SismorcegoBuild:{coordinatorEvaluation:true,realFirebase:false,firebaseEmulator:false}}}));
  const {COORDINATOR_EVALUATION}=require('../src/services/appEnvironment');
  const {LOCAL_TEST_MODE}=require('../src/services/debugTestSession');
  expect(COORDINATOR_EVALUATION).toBe(true);expect(LOCAL_TEST_MODE).toBe(false);
});

test('iOS has no build variants: without the native module it is always the real-Firebase training build',()=>{
  jest.resetModules();
  jest.doMock('react-native',()=>({NativeModules:{},Platform:{OS:'ios'}}));
  const env=require('../src/services/appEnvironment');
  const {LOCAL_TEST_MODE}=require('../src/services/debugTestSession');
  expect(env.COORDINATOR_EVALUATION).toBe(true);expect(env.REAL_FIREBASE_HOMOLOGATION).toBe(true);
  expect(env.USE_FIREBASE_EMULATORS).toBe(false);expect(LOCAL_TEST_MODE).toBe(false);
});
test('Android without the native module keeps the simulated local session',()=>{
  jest.resetModules();
  jest.doMock('react-native',()=>({NativeModules:{},Platform:{OS:'android'}}));
  const env=require('../src/services/appEnvironment');
  const {LOCAL_TEST_MODE}=require('../src/services/debugTestSession');
  expect(env.COORDINATOR_EVALUATION).toBe(false);expect(LOCAL_TEST_MODE).toBe(true);
});
