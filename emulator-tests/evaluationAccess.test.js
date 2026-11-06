const { Timestamp, periodState, createAccessService, createRateLimiter, createHttpHandler, EVALUATION_UID } = require('../functions-evaluation/access');
let now, data, user, role, auth, service, db;
beforeEach(() => {
  now=Date.now(); data={enabled:true,startAt:Timestamp.fromMillis(now-1000),expiresAt:Timestamp.fromMillis(now+10000)};
  user={uid:EVALUATION_UID,displayName:'Sismorcego Teste',disabled:false,customClaims:{sismorcegoEvaluationAccount:true}};role='coordenador';
  db={doc:jest.fn(path=>({get:async()=>path.startsWith('configuracoes/')?{exists:!!data,data:()=>data}:{exists:true,data:()=>({role})}}))};
  auth={getUser:jest.fn(async()=>user),createCustomToken:jest.fn(async()=>'dynamic-token')}; service=createAccessService({auth,db,now:()=>now});
});
test.each([null,{enabled:true,startAt:'yesterday',expiresAt:'tomorrow'},{enabled:'true',startAt:Timestamp.now(),expiresAt:Timestamp.now()}])('malformed or absent central config fails closed (%j)', value=>{
  expect(periodState(value,now)).toBe('unavailable');
});
test('server checks exact start/expiry boundary and enabled flag without client dates', async()=>{
  expect((await service.issue()).customToken).toBe('dynamic-token'); expect(auth.createCustomToken).toHaveBeenCalledWith(EVALUATION_UID);
  now=data.expiresAt.toMillis(); expect((await service.issue()).state).toBe('expired');
  now=data.startAt.toMillis()-1; expect((await service.status()).state).toBe('not-started');
  data.enabled=false; expect((await service.status()).state).toBe('suspended');
});
test.each(['disabled','claim','role'])('account %s stops token issuance',async kind=>{
  if(kind==='disabled')user.disabled=true;if(kind==='claim')user.customClaims={};if(kind==='role')role='acs';
  expect((await service.issue()).state).toBe('blocked');expect(auth.createCustomToken).not.toHaveBeenCalled();
});
test('suspension while signing discards the token rather than returning a stale active authorization',async()=>{
  auth.createCustomToken.mockImplementation(async()=>{data.enabled=false;return 'not-returned';});
  const response=await service.issue();expect(response.state).toBe('suspended');expect(response.customToken).toBeUndefined();
});
test('rate limiting bounds memory and issuance without treating an IP as coordinator identity',()=>{
  const limit=createRateLimiter({now:()=>now,maxKeys:10});
  for(let i=0;i<60;i++)expect(limit('same',true)).toBe(true);
  expect(limit('same',true)).toBe(false);expect(limit('another',true)).toBe(true);
  for(let i=0;i<20;i++)limit('ip-'+i,false);
  expect(limit('new-over-capacity',false)).toBe(false);
  now+=600001;expect(limit('new-window',true)).toBe(true);
});
const response=()=>({code:200,headers:{},set(key,value){this.headers[key]=value;return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('HTTP refuses caller identity/role/duration overrides and unsafe request shapes',async()=>{
  const handler=createHttpHandler(service,()=>true);
  for(const body of [{version:1,uid:'victim'},{version:1,enabled:true},{version:1,expiresAt:999},[],null]){
    const res=response();await handler({path:'/',method:'POST',body,is:()=>true,ip:'test'},res);expect(res.code).toBe(400);
  }
  expect(auth.createCustomToken).not.toHaveBeenCalled();
});
test('HTTP rate errors do not contain credentials or internal SDK exceptions',async()=>{
  let res=response();await createHttpHandler(service,()=>false)({path:'/',method:'POST',body:{version:1},is:()=>true},res);
  expect(res.code).toBe(429);expect(res.headers['Retry-After']).toBe('60');
  auth.getUser.mockRejectedValue(new Error('sensitive-internal-error'));res=response();
  await createHttpHandler(service,()=>true)({path:'/',method:'GET'},res);
  expect(res.code).toBe(503);expect(JSON.stringify(res.body)).not.toContain('sensitive');expect(res.headers['Cache-Control']).toContain('no-store');
});
