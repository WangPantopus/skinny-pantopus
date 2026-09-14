const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const db = require('./__mocks__/supabaseAdmin');
const storage = require('../services/homeDocumentStorage');
jest.mock('../middleware/rateLimiter', () => ({
  ...jest.requireActual('../middleware/rateLimiter'), homeDocumentUploadLimiter: (_req, _res, next) => next(),
}));
const app = express();
app.use(express.json());
app.use('/api/v1', require('../routes/landlordTenant'));
const home = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const actor = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const authority = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const stranger = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const lease = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const bytes = Buffer.from('Private lease file bytes');
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
const context = { home_id: home, actor_id: actor, lease_id: null, lease_state: null };
const path = `/api/v1/tenant/home/${home}/lease-files`;
let file; let rpc; let previousBucket;
function upload(fields = {}, body = bytes, mime = 'text/plain') {
  let call = request(app).post(path);
  for (const [key, value] of Object.entries({ upload_id: id, request_context: JSON.stringify(context), ...fields })) call = call.field(key, value);
  return call.attach('file', body, { filename: 'lease.txt', contentType: mime });
}
function publish() {
  file.processing_status = 'completed';
  db.seedTable('File', [structuredClone(file)]);
}
function bind() {
  file.metadata.lease_id = lease;
  publish();
  db.seedTable('HomeLease', [{ id: lease, home_id: home, primary_resident_user_id: actor,
    source: 'tenant_request', metadata: { lease_file_id: id } }]);
}
beforeEach(() => {
  db.resetTables();
  previousBucket = process.env.HOME_DOCUMENTS_BUCKET;
  process.env.HOME_DOCUMENTS_BUCKET = 'test-private-lease';
  file = { id, home_id: home, user_id: actor, file_path: `${home}/${id}/${sha}`,
    original_filename: 'lease.txt', file_size: bytes.length, mime_type: 'text/plain',
    is_deleted: false, processing_status: 'uploading', metadata: {
      storage_contract: 'home_lease_evidence_v1', upload_sha256: sha, storage_bucket: 'test-private-lease',
      original_home_id: home, original_user_id: actor, request_context: context,
    } };
  db.seedTable('Home', [{ id: home, security_state: 'normal', home_status: 'active' }]);
  db.seedTable('User', [actor, authority, stranger].map(id => ({ id })));
  db.seedTable('HomeAuthority', [{ id: authority, home_id: home, subject_type: 'user', subject_id: authority, status: 'verified' }]);
  rpc = jest.fn(async (name, args) => {
    if (name !== 'mutate_home_lease_evidence') return { data: null, error: null };
    const reply = structuredClone(file);
    if (args.p_action === 'finalize') reply.processing_status = 'completed';
    if (args.p_action === 'retire') { reply.is_deleted = true; reply.metadata.storage_cleanup_pending = true; }
    return { data: { success: true, file: reply }, error: null };
  });
  db.setRpcMock(rpc);
  jest.spyOn(storage, 'prepare').mockResolvedValue({ bucket: 'test-private-lease', key: file.file_path });
  jest.spyOn(storage, 'upload').mockResolvedValue({});
  jest.spyOn(storage, 'download').mockResolvedValue(bytes);
});
afterEach(() => {
  jest.restoreAllMocks();
  if (previousBucket === undefined) delete process.env.HOME_DOCUMENTS_BUCKET;
  else process.env.HOME_DOCUMENTS_BUCKET = previousBucket;
});

test('existing route projects an uploaded draft without a URL, storage key, claim or lease', async () => {
  const response = await upload();
  expect(response.status).toBe(201);
  expect(response.body.file).toEqual({ id, home_id: home, file_name: 'lease.txt', file_size: bytes.length,
    mime_type: 'text/plain', available: true, lease_id: null });
  expect(rpc.mock.calls.map(([, args]) => args.p_action).filter(Boolean)).toEqual(['reserve', 'finalize']);
  expect(storage.upload.mock.invocationCallOrder[0]).toBeGreaterThan(rpc.mock.invocationCallOrder[0]);
  expect(db.getTable('HomeLease')).toHaveLength(0);
  expect(db.getTable('HomeDocument')).toHaveLength(0);
});
test.each(['bad-context', 'another-actor', 'extra-field', 'repeated-id', 'empty-file', 'fake-pdf'])('%s is rejected before reservation/provider writes', async kind => {
  const fields = kind === 'bad-context' ? { request_context: 'no-json' }
    : kind === 'another-actor' ? { request_context: JSON.stringify({ ...context, actor_id: stranger }) }
      : kind === 'extra-field' ? { visibility: 'public' } : {};
  let call = upload(fields, kind === 'empty-file' ? Buffer.alloc(0) : bytes, kind === 'fake-pdf' ? 'application/pdf' : 'text/plain');
  if (kind === 'repeated-id') call = call.field('upload_id', id);
  const response = await call;
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.status).toBeLessThan(500);
  expect(storage.upload).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
test('a lost finalized upload reply reuses its File without another provider write', async () => {
  file.processing_status = 'completed';
  const response = await upload();
  expect(response.status).toBe(200);
  expect(response.body.reused).toBe(true);
  expect(storage.upload).not.toHaveBeenCalled();
});
test('quota denial prevents provider writes', async () => {
  rpc.mockResolvedValue({ error: { code: 'P0001', message: 'FILE_QUOTA_EXCEEDED' } });
  expect((await upload()).status).toBe(413);
  expect(storage.upload).not.toHaveBeenCalled();
});
test('finalization failure retains the retry and invalidates cleanup after a late provider write', async () => {
  rpc.mockImplementation(async (name, args) => args.p_action === 'reserve'
    ? { data: { success: true, file: structuredClone(file) } } : { error: { code: '08006' } });
  expect((await upload()).status).toBe(503);
  expect(rpc).toHaveBeenLastCalledWith('mark_home_document_cleanup_pending', { p_file_id: id });
});
test('applicant can open their draft but the landlord and other household residents cannot', async () => {
  publish();
  expect((await request(app).get(`${path}/${id}/content`)).text).toBe(bytes.toString());
  expect((await request(app).get(`${path}/${id}`).set('x-test-user-id', authority)).status).toBe(403);
  db.seedTable('HomeOccupancy', [{ home_id: home, user_id: stranger, is_active: true, role: 'admin' }]);
  expect((await request(app).get(`${path}/${id}`).set('x-test-user-id', stranger)).status).toBe(403);
  expect(storage.download).toHaveBeenCalledTimes(1);
});
test('a current landlord can read only the submitted exact binding with private download headers', async () => {
  bind();
  const response = await request(app).get(`${path}/${id}/content`).set('x-test-user-id', authority);
  expect(response.status).toBe(200);
  expect(response.text).toBe(bytes.toString());
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['content-disposition']).toContain('attachment');
  expect(response.headers.location).toBeUndefined();
});
test.each(['revoked-authority', 'frozen-home', 'removed-file', 'different-binding', 'deleted-account', 'changed-bytes'])('a %s during provider read discloses no bytes', async kind => {
  bind();
  storage.download.mockImplementation(async () => {
    if (kind === 'revoked-authority') db.getTable('HomeAuthority')[0].status = 'revoked';
    if (kind === 'frozen-home') db.getTable('Home')[0].security_state = 'frozen';
    if (kind === 'removed-file') db.getTable('File')[0].is_deleted = true;
    if (kind === 'different-binding') db.getTable('HomeLease')[0].metadata.lease_file_id = stranger;
    if (kind === 'deleted-account') db.seedTable('User', [{ id: actor }]);
    if (kind === 'changed-bytes') db.getTable('File')[0].file_size += 1;
    return bytes;
  });
  const response = await request(app).get(`${path}/${id}/content`).set('x-test-user-id', authority);
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.text).not.toContain(bytes.toString());
});
test('draft removal reports durable cleanup pending without an unclaimed storage deletion', async () => {
  const response = await request(app).delete(`${path}/${id}`);
  expect(response.status).toBe(202);
  expect(response.body).toEqual({ deleted: true, cleanup_pending: true });
});
test('existing request endpoint forwards the optional file and rejects a receipt for another attachment', async () => {
  rpc.mockResolvedValue({ data: { success: true, lease: { id: lease, home_id: home,
    primary_resident_user_id: actor, metadata: { lease_file_id: id } } } });
  const body = { home_id: home, lease_file_id: id, request_context: context };
  expect((await request(app).post('/api/v1/tenant/request-approval').send(body)).status).toBe(201);
  expect(rpc).toHaveBeenCalledWith('request_home_lease_with_evidence', expect.objectContaining({
    p_file_id: id, p_actor_id: actor, p_home_id: home, p_request_context: context,
  }));
  rpc.mockResolvedValue({ data: { success: true, lease: { id: lease, home_id: home,
    primary_resident_user_id: actor, metadata: { lease_file_id: stranger } } } });
  expect((await request(app).post('/api/v1/tenant/request-approval').send(body)).status).toBe(503);
});
test('the existing status projection restores only the lease file ID, without private storage metadata', async () => {
  bind();
  Object.assign(db.getTable('HomeLease')[0], { state: 'pending', created_at: '2026-09-14T00:00:00Z' });
  db.getTable('HomeLease')[0].metadata.upload_sha256 = sha;
  const response = await request(app).get(`/api/v1/tenant/home/${home}/status`);
  expect(response.status).toBe(200);
  expect(response.body.lease.lease.metadata).toEqual({ message: null, lease_file_id: id });
  expect(response.text).not.toContain(sha);
});
test('the existing request-session guard prevents a refresh replay under a different session before upload', async () => {
  const session = await request(app).get(`${path}/session`).set('Authorization', 'Bearer first-synthetic-session');
  expect(session.status).toBe(200);
  expect(session.body).toMatchObject({ actor_id: actor, home_id: home });
  expect(session.body.session_scope).toMatch(/^[0-9a-f]{64}$/);
  const response = await upload().set('Authorization', 'Bearer second-synthetic-session')
    .set('x-pantopus-session-scope', session.body.session_scope);
  expect(response.status).toBe(409);
  expect(response.body.code).toBe('SESSION_SCOPE_CHANGED');
  expect(rpc).not.toHaveBeenCalled();
  expect(storage.upload).not.toHaveBeenCalled();
});
test('a changed session cannot read or remove a file or submit an attached request', async () => {
  publish();
  const session = await request(app).get(`${path}/session`).set('Authorization', 'Bearer first-synthetic-session');
  const operations = [request(app).get(`${path}/${id}/content`), request(app).delete(`${path}/${id}`),
    request(app).post('/api/v1/tenant/request-approval').send({ home_id: home, lease_file_id: id, request_context: context })];
  for (const operation of operations) {
    const response = await operation.set('Authorization', 'Bearer second-synthetic-session')
      .set('x-pantopus-session-scope', session.body.session_scope);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SESSION_SCOPE_CHANGED');
  }
  expect(rpc).not.toHaveBeenCalled();
  expect(storage.download).not.toHaveBeenCalled();
});
