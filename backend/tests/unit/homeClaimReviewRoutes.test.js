const db = require('../__mocks__/supabaseAdmin');
const home = require('../../routes/homeOwnership');
const admin = require('../../routes/admin');
const upload = require('../../routes/upload');
const s3 = require('../../services/s3Service');
function handler(router, method, path) { return router.stack.find(l => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle; }
function response() { return { statusCode: 200, status(n) { this.statusCode=n;return this; }, json(body) { this.body=body;return this; } }; }
const req = { params: { id: 'home', homeId: 'home', claimId: 'claim' }, user: { id: 'actor' }, body: { action: 'reject', review_token: 'a'.repeat(64), actorId: 'forged', platformAdmin: true }, query: {} };
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
test.each([[home,'/:id/ownership-claims/:claimId/review',false],[admin,'/claims/:claimId/review',true]])('review uses authenticated actor and route-specific authority', async (router, path, platform) => {
  const rpc=jest.fn(async()=>({data:{ok:true,homeId:'home',claimId:'claim',action:'reject',state:'rejected',replayed:false}}));db.setRpcMock(rpc);
  const from=jest.spyOn(db,'from');const res=response();await handler(router,'post',path)(req,res);
  expect(res.statusCode).toBe(200);expect(rpc.mock.calls[0][1]).toMatchObject({p_home_id:platform?null:'home',p_claim_id:'claim',p_actor_id:'actor',p_review_token:'a'.repeat(64),p_platform_admin:platform});
  expect(from).not.toHaveBeenCalled();from.mockRestore();
});
test.each([[home,'/:id/ownership-claims/:claimId/evidence'],[upload,'/ownership-evidence/:homeId/:claimId']])('metadata/file gateways cannot persist arbitrary refs or upload public evidence', async (router,path) => {
  db.setRpcMock(async()=>({data:{ok:false,code:'CLAIM_EVIDENCE_PRIVATE_REUPLOAD_REQUIRED',status:409}}));
  const from=jest.spyOn(db,'from');const put=jest.spyOn(s3,'uploadGeneral');const del=jest.spyOn(s3,'deleteFromS3');const res=response();
  await handler(router,'post',path)({...req,body:{provider:'attom',storage_ref:'foreign/key',metadata:{status:'verified'}},file:{buffer:Buffer.from('private evidence')}},res);
  expect(res.statusCode).toBe(409);expect(from).not.toHaveBeenCalled();expect(put).not.toHaveBeenCalled();expect(del).not.toHaveBeenCalled();
  from.mockRestore();put.mockRestore();del.mockRestore();
});
test.each([[home,'/:id/ownership-claims/:claimId'],[admin,'/claims/:claimId']])('claim details never sign historical storage refs or fall back to arbitrary metadata URLs', async (router,path) => {
  db.seedTable('HomeVerificationEvidence',[{id:'e',claim_id:'claim',storage_ref:'foreign/key',metadata:{file_url:'https://example.invalid/private'}}]);
  db.setRpcMock(async()=>({data:{ok:true,homeId:'home',claimId:'claim',claim:{id:'claim',home_id:'home',review_token:'a'.repeat(64),evidence:[]},evidence:[]}}));
  const sign=jest.spyOn(s3,'getPresignedDownloadUrl');const from=jest.spyOn(db,'from');const res=response();await handler(router,'get',path)(req,res);
  expect(res.statusCode).toBe(200);expect(sign).not.toHaveBeenCalled();expect(from).not.toHaveBeenCalled();expect(JSON.stringify(res.body)).not.toContain('foreign/key');
  sign.mockRestore();from.mockRestore();
});
test.each([[home,'post','/:id/ownership-claims/:claimId/review'],[home,'delete','/:id/ownership-claims/:claimId'],[admin,'post','/claims/:claimId/review'],[admin,'get','/claims/:claimId'],[upload,'post','/ownership-evidence/:homeId/:claimId']])('auth-state read failure is a private retryable 503 (%#)',async(router,method,path)=>{
  db.setRpcMock(async()=>({error:{code:'55P03',message:'private connection details'}}));const res=response();await handler(router,method,path)(req,res);
  expect(res.statusCode).toBe(503);expect(JSON.stringify(res.body)).not.toContain('private connection details');
});
