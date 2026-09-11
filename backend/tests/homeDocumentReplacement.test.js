const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const db = require('./__mocks__/supabaseAdmin');
jest.mock('../middleware/rateLimiter', () => ({ homeDocumentUploadLimiter: (_req, _res, next) => next() }));
jest.mock('../utils/homePermissions', () => ({
  ...jest.requireActual('../utils/homePermissions'), checkHomePermission: jest.fn(),
}));
const { checkHomePermission } = require('../utils/homePermissions');
const app = express();
app.use('/api/homes', require('../routes/homeDocumentFiles'));
const home = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const documentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const uploadId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const actor = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const oldOwner = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const oldBytes = Buffer.from('original protected document'), newBytes = Buffer.from('replacement private bytes');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const oldKey = `${home}/${documentId}/${hash(oldBytes)}`;
const endpoint = `/api/homes/${home}/documents/${documentId}`;
let bucket, rpc, objects, previousBucket, loseResponse, rejectCommit;
function replacing(fields = {}, bytes = newBytes) {
  let call = request(app).post(endpoint + '/replace');
  for (const [key, value] of Object.entries({ upload_id: uploadId, expected_version: documentId, ...fields })) call = call.field(key, value);
  return call.attach('file', bytes, { filename: 'replacement.txt', contentType: 'text/plain' });
}
beforeEach(() => {
  db.resetTables(); loseResponse = false; rejectCommit = false;
  previousBucket = process.env.HOME_DOCUMENTS_BUCKET; process.env.HOME_DOCUMENTS_BUCKET = 'private-replace-test';
  checkHomePermission.mockImplementation(async (_home, _user, permission) => ({ hasAccess: permission !== 'sensitive.view', occupancy: { role_base: 'manager' } }));
  db.seedTable('File', [{ id: documentId, user_id: oldOwner, home_id: home, is_deleted: false,
    file_path: oldKey, original_filename: 'old.txt', file_size: oldBytes.length, mime_type: 'text/plain',
    metadata: { storage_contract: 'home_document_v1', storage_bucket: 'private-replace-test', upload_fingerprint: 'old-fingerprint', upload_sha256: hash(oldBytes) } }]);
  db.seedTable('HomeDocument', [{ id: documentId, file_id: documentId, home_id: home, created_by: oldOwner,
    title: 'Keep this title', doc_type: 'receipt', visibility: 'members', size_bytes: oldBytes.length,
    details: { storage_contract: 'home_document_v1', upload_fingerprint: 'old-fingerprint', tags: 'keep this tag' } }]);
  objects = new Map([[oldKey, oldBytes]]);
  bucket = {
    upload: jest.fn(async (key, bytes) => {
      if (objects.has(key)) return { error: { statusCode: 409 } };
      objects.set(key, Buffer.from(bytes)); return { error: null, data: {} };
    }),
    download: jest.fn(async key => objects.has(key) ? { data: new Blob([objects.get(key)]), error: null } : { error: { statusCode: 404 } }),
  };
  db.storage = { getBucket: jest.fn().mockResolvedValue({ data: { public: false }, error: null }), from: jest.fn().mockReturnValue(bucket) };
  // Only the transaction boundary is substituted here. The SQL contract checks
  // actual cross-owner quota transfer, locks, tombstones and retries.
  rpc = jest.fn(async (name, args) => {
    if (name === 'can_upload_file') return { data: { canUpload: true }, error: null };
    const candidate = db.getTable('File').find(f => f.id === args.p_upload_id);
    if (name === 'reject_home_document_replacement') {
      if (candidate && !candidate.is_deleted) candidate.is_deleted = true;
      return { data: true, error: null };
    }
    if (name !== 'replace_home_document_file') throw new Error('Unexpected RPC');
    if (rejectCommit) return { data: { code: 'DOCUMENT_CHANGED' }, error: null };
    const current = db.getTable('File').find(f => f.id === documentId), document = db.getTable('HomeDocument')[0];
    const old = structuredClone(current), fresh = structuredClone(candidate);
    Object.assign(current, fresh, { id: documentId });
    Object.assign(document, { created_by: actor, size_bytes: fresh.file_size, mime_type: fresh.mime_type,
      details: { ...document.details, upload_fingerprint: args.p_request_fingerprint, upload_version: uploadId, original_filename: fresh.original_filename } });
    Object.assign(candidate, old, { id: uploadId, is_deleted: true, metadata: { ...old.metadata, storage_key_id: documentId,
      replacement_applied: true, replacement_actor: actor, replacement_target: documentId,
      replacement_request_fingerprint: args.p_request_fingerprint } });
    return loseResponse ? { error: { code: 'NETWORK_LOST' } } : { data: { document: structuredClone(document), reused: false }, error: null };
  });
  db.setRpcMock(rpc);
});
afterEach(() => {
  jest.restoreAllMocks(); delete db.storage;
  if (previousBucket === undefined) delete process.env.HOME_DOCUMENTS_BUCKET;
  else process.env.HOME_DOCUMENTS_BUCKET = previousBucket;
});

test('replaces exact bytes at the stable document URL and preserves title/category/visibility/details', async () => {
  const result = await replacing();
  expect(result.status).toBe(201);
  expect(result.body.document).toMatchObject({ id: documentId, file_id: documentId, file_version: uploadId,
    title: 'Keep this title', doc_type: 'receipt', visibility: 'members', details: { tags: 'keep this tag' },
    storage_path: null, storage_bucket: null, content_url: endpoint + '/content' });
  expect(result.body.document.details.upload_version).toBeUndefined();
  expect(result.body.document.details.upload_fingerprint).toBeUndefined();
  const opened = await request(app).get(endpoint + '/content');
  expect(opened.status).toBe(200); expect(Buffer.from(opened.text)).toEqual(newBytes);
  expect(db.getTable('HomeDocument')).toHaveLength(1);
  expect(objects.has(oldKey)).toBe(true); // The durable old-version worker owns removal.
});
test('same-request retry returns the committed version without a provider write or quota admission', async () => {
  await replacing(); const result = await replacing();
  expect(result.status).toBe(200); expect(result.body.reused).toBe(true);
  expect(bucket.upload).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls.filter(([name]) => name === 'can_upload_file')).toHaveLength(1);
});
test('a lost successful RPC response reconciles the same version', async () => {
  loseResponse = true;
  const result = await replacing(); expect(result.status).toBe(200); expect(result.body.reused).toBe(true);
  expect(db.getTable('HomeDocument')[0].details.upload_version).toBe(uploadId);
});
test('provider outage keeps original bytes and a retryable reservation', async () => {
  bucket.upload.mockResolvedValueOnce({ error: { statusCode: 503 } });
  expect((await replacing()).status).toBe(503);
  expect(db.getTable('HomeDocument')[0].details.upload_fingerprint).toBe('old-fingerprint');
  expect(Buffer.from((await request(app).get(endpoint + '/content')).text)).toEqual(oldBytes);
  expect((await replacing()).status).toBe(201);
  expect(db.getTable('File')).toHaveLength(2);
  expect(rpc.mock.calls.filter(([name]) => name === 'can_upload_file')).toHaveLength(1);
});
test('commit conflict preserves the old document and releases the rejected reservation', async () => {
  rejectCommit = true;
  expect((await replacing()).status).toBe(409);
  expect(rpc).toHaveBeenCalledWith('reject_home_document_replacement', { p_upload_id: uploadId, p_actor_id: actor });
  expect(db.getTable('HomeDocument')[0].details.upload_fingerprint).toBe('old-fingerprint');
  expect(db.getTable('File').find(f => f.id === uploadId).is_deleted).toBe(true);
});
test('access revoked during provider upload rejects publication', async () => {
  const upload = bucket.upload.getMockImplementation();
  bucket.upload.mockImplementation(async (...args) => {
    const result = await upload(...args); checkHomePermission.mockResolvedValue({ hasAccess: false }); return result;
  });
  expect((await replacing()).status).toBe(403);
  expect(rpc).toHaveBeenCalledWith('reject_home_document_replacement', { p_upload_id: uploadId, p_actor_id: actor });
  expect(rpc.mock.calls.some(([name]) => name === 'replace_home_document_file')).toBe(false);
  expect(db.getTable('HomeDocument')[0].details.upload_fingerprint).toBe('old-fingerprint');
});
test.each(['permission', 'sensitive', 'stale', 'metadata', 'same-id'])('denies %s before provider mutation', async kind => {
  let fields = {};
  if (kind === 'permission') checkHomePermission.mockResolvedValue({ hasAccess: false });
  if (kind === 'sensitive') db.getTable('HomeDocument')[0].visibility = 'sensitive';
  if (kind === 'stale') fields.expected_version = home;
  if (kind === 'metadata') fields.title = 'Not authorized to edit metadata here';
  if (kind === 'same-id') fields.upload_id = documentId;
  expect([400,403,409]).toContain((await replacing(fields)).status);
  expect(bucket.upload).not.toHaveBeenCalled();
  expect(db.getTable('File')).toHaveLength(1);
});
test('an applied identifier cannot overwrite different bytes', async () => {
  await replacing();
  expect((await replacing({}, Buffer.from('different bytes'))).status).toBe(409);
  expect(bucket.upload).toHaveBeenCalledTimes(1);
});
