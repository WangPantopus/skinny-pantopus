const service = require('../../services/homeExternalShareService');
jest.mock('../__mocks__/verifyToken', () => jest.fn((_req, res) => res.status(401).json({ error: 'Invalid credentials' })));
const verifyToken = require('../__mocks__/verifyToken');
const guest = require('../../routes/homeGuest');
const iam = require('../../routes/homeIam');
function handler(router, method, path) {
  return router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
}
function response() {
  return { statusCode: 200, headers: {}, set(k,v) { this.headers[k]=v; return this; },
    status(code) { this.statusCode=code; return this; }, json(body) { this.body=body; return this; },
    type(value) { this.mime=value; return this; }, attachment(value) { this.filename=value; return this; },
    send(body) { this.body=body; return this; } };
}
beforeEach(() => jest.restoreAllMocks());
test.each(['/guest/:token', '/shared/:token', '/shared-documents/:receipt/:documentId'])('%s never downgrades supplied invalid credentials to anonymous', async path => {
  const authenticate = guest.stack.find(layer => layer.route?.path === path).route.stack[1].handle;
  const read = jest.spyOn(service, 'read');
  const download = jest.spyOn(service, 'download');
  for (const credentials of [{ headers: { authorization: 'Bearer invalid' } }, { cookies: { pantopus_access: 'revoked' } }]) {
    const next = jest.fn(); const res = response();
    await authenticate(credentials, res, next);
    expect(res.statusCode).toBe(401); expect(next).not.toHaveBeenCalled();
  }
  expect(verifyToken).toHaveBeenCalled();
  expect(read).not.toHaveBeenCalled(); expect(download).not.toHaveBeenCalled();
  const next = jest.fn();
  await authenticate({ headers: {}, cookies: {} }, response(), next);
  expect(next).toHaveBeenCalledTimes(1);
});
test.each([['/guest/:token','guest'],['/shared/:token','scoped']])('%s binds actual optional identity and disables caching', async (path,kind) => {
  const read = jest.spyOn(service,'read').mockResolvedValue({ exact: 'result' }); const res=response();
  await handler(guest,'get',path)({ params:{token:'token'},user:{id:'real-recipient'},query:{passcode:'code',recipientId:'forged'} },res);
  expect(read).toHaveBeenCalledWith({kind,token:'token',recipientId:'real-recipient',passcode:'code'});
  expect(res.body).toEqual({exact:'result'});
  expect(res.headers).toMatchObject({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'});
});
test('public read preserves the passcode challenge without disclosing data', async () => {
  jest.spyOn(service,'read').mockRejectedValue(Object.assign(new Error('Passcode required'),{code:'SHARE_PASSCODE_REQUIRED',statusCode:403,requiresPasscode:true}));
  const res=response();await handler(guest,'get','/guest/:token')({params:{token:'token'},query:{}},res);
  expect(res.statusCode).toBe(403);expect(res.body.requiresPasscode).toBe(true);expect(res.body.sections).toBeUndefined();
});
test.each([['guest','/:id/guest-passes','pass'],['scoped','/:id/scoped-grants','grant']])('%s create/revoke use only the request actor', async (kind,path,envelope) => {
  const mutate=jest.spyOn(service,'mutate').mockResolvedValue({record:{id:'share'},token:'new-token'});
  let res=response();await handler(iam,'post',path)({params:{id:'home'},user:{id:'actor'},body:{label:'New'}},res);
  expect(mutate).toHaveBeenLastCalledWith({homeId:'home',actorId:'actor',kind,action:'create',payload:{label:'New'}});
  expect(res.statusCode).toBe(201);expect(res.body).toEqual({[envelope]:{id:'share'},token:'new-token'});
  res=response();await handler(iam,'delete',`${path}/:shareId`)({params:{id:'home',shareId:'share'},user:{id:'actor'},body:{actorId:'forged'}},res);
  expect(mutate).toHaveBeenLastCalledWith({homeId:'home',actorId:'actor',kind,action:'revoke',shareId:'share'});
  expect(res.body.token).toBeUndefined();
});
test('document denial sends no fetched bytes; success uses attachment and no-store', async () => {
  const download=jest.spyOn(service,'download').mockRejectedValue(Object.assign(new Error('Revoked'),{code:'SHARE_REVOKED',statusCode:410}));
  const req={params:{receipt:'receipt',documentId:'document'},user:{id:'recipient'}};let res=response();
  await handler(guest,'get','/shared-documents/:receipt/:documentId')(req,res);
  expect(res.statusCode).toBe(410);expect(Buffer.isBuffer(res.body)).toBe(false);
  download.mockResolvedValue({bytes:Buffer.from('PDF'),mimeType:'application/pdf',title:'Shared\r\nfile'});res=response();
  await handler(guest,'get','/shared-documents/:receipt/:documentId')(req,res);
  expect(res.body.toString()).toBe('PDF');expect(res.filename).toBe('Shared  file');
  expect(res.headers['Cache-Control']).toBe('private, no-store');
});
