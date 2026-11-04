test.each([undefined,false,'true',true])('only the native homologation boolean %s enables real Firebase',value=>{
  jest.resetModules();
  jest.doMock('react-native',()=>({NativeModules:value===undefined?{}:{SismorcegoBuild:{realFirebase:value}}}));
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
