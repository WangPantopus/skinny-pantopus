const express = require('express');
const request = require('supertest');
const db = require('./__mocks__/supabaseAdmin');
jest.mock('../middleware/rateLimiter', () => ({ homeDocumentUploadLimiter: (_req, _res, next) => next() }));
jest.mock('../utils/homePermissions', () => ({
  ...jest.requireActual('../utils/homePermissions'), checkHomePermission: jest.fn(),
}));
const { checkHomePermission } = require('../utils/homePermissions');
const app = express();
app.use(express.json());
app.use('/api/homes', require('../routes/homeDocumentFiles'));
const homeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const documentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const userId = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const endpoint = `/api/homes/${homeId}/documents/${documentId}`;
const sha = 'a'.repeat(64);
const fingerprint = 'b'.repeat(64);
let bucket;
let rpc;
let previousBucket;

beforeEach(() => {
  db.resetTables();
  previousBucket = process.env.HOME_DOCUMENTS_BUCKET;
  process.env.HOME_DOCUMENTS_BUCKET = 'private-document-test';
  checkHomePermission.mockImplementation(async (_home, _user, permission) => ({
    hasAccess: permission !== 'sensitive.view', isOwner: false, occupancy: { role_base: 'manager' },
  }));
  db.seedTable('File', [{
    id: documentId, home_id: homeId, user_id: userId, is_deleted: false,
    file_path: `${homeId}/${documentId}/${sha}`,
    metadata: { storage_contract: 'home_document_v1', storage_bucket: 'private-document-test', upload_sha256: sha, upload_fingerprint: fingerprint },
  }]);
  db.seedTable('HomeDocument', [{
    id: documentId, home_id: homeId, file_id: documentId, created_by: userId,
    visibility: 'members', details: { upload_fingerprint: fingerprint },
  }]);
  bucket = { remove: jest.fn().mockResolvedValue({ data: [], error: null }) };
  db.storage = {
    getBucket: jest.fn().mockResolvedValue({ data: { public: false }, error: null }),
    from: jest.fn().mockReturnValue(bucket),
  };
  // This substitutes only the DB transaction boundary. Actual locking/quota
  // behavior is exercised by the SQL contract, not claimed by this mock.
  rpc = jest.fn(async () => {
    const file = db.getTable('File')[0];
    if (!file.is_deleted) {
      file.is_deleted = true;
      file.metadata = { ...file.metadata, deleted_document_visibility: 'members', storage_cleanup_pending: true };
      db.getTable('HomeDocument').splice(0);
    }
    return { data: { file: structuredClone(file) }, error: null };
  });
  db.setRpcMock(rpc);
});
afterEach(() => {
  if (previousBucket === undefined) delete process.env.HOME_DOCUMENTS_BUCKET;
  else process.env.HOME_DOCUMENTS_BUCKET = previousBucket;
  delete db.storage;
  jest.restoreAllMocks();
});

test('authorizes current scope, atomically removes the record, then removes only its derived object', async () => {
  const result = await request(app).delete(endpoint);
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ deleted: true, cleanup_pending: false });
  expect(rpc).toHaveBeenCalledWith('delete_home_document_file', {
    p_home_id: homeId, p_document_id: documentId, p_actor_id: userId,
    p_expected_fingerprint: fingerprint, p_expected_visibility: 'members',
  });
  expect(bucket.remove).toHaveBeenCalledWith([`${homeId}/${documentId}/${sha}`]);
  expect(db.getTable('HomeDocument')).toHaveLength(0);
  expect((await request(app).get(endpoint + '/content')).status).toBe(404);
  const retry = await request(app).delete(endpoint);
  expect(retry.body).toEqual({ deleted: true, cleanup_pending: false });
  expect(bucket.remove).toHaveBeenCalledTimes(1);
});

test('retains a private cleanup tombstone after storage failure and reconciles the next request', async () => {
  bucket.remove.mockResolvedValueOnce({ error: { message: 'offline' } });
  expect((await request(app).delete(endpoint)).body).toEqual({ deleted: true, cleanup_pending: true });
  expect((await request(app).get(endpoint + '/content')).status).toBe(404);
  expect((await request(app).delete(endpoint)).body).toEqual({ deleted: true, cleanup_pending: false });
  expect(bucket.remove).toHaveBeenCalledTimes(2);
});

test('a database failure cannot delete the only stored copy', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
  expect((await request(app).delete(endpoint)).status).toBe(503);
  expect(bucket.remove).not.toHaveBeenCalled();
  expect(db.getTable('HomeDocument')).toHaveLength(1);
});

test('a concurrent version or visibility change requires a fresh authorized read', async () => {
  rpc.mockResolvedValue({ data: { code: 'DOCUMENT_CHANGED' }, error: null });
  expect((await request(app).delete(endpoint)).status).toBe(409);
  expect(bucket.remove).not.toHaveBeenCalled();
});

test('denies a viewer without docs.manage before any mutation', async () => {
  checkHomePermission.mockResolvedValue({ hasAccess: false });
  expect((await request(app).delete(endpoint)).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
  expect(bucket.remove).not.toHaveBeenCalled();
});

test.each([false, true])('sensitive scope is checked even for a deleted record retry: %s', async deleted => {
  if (deleted) {
    db.getTable('HomeDocument').splice(0);
    Object.assign(db.getTable('File')[0], { is_deleted: true });
    db.getTable('File')[0].metadata.deleted_document_visibility = 'sensitive';
  } else db.getTable('HomeDocument')[0].visibility = 'sensitive';
  expect((await request(app).delete(endpoint)).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
  expect(bucket.remove).not.toHaveBeenCalled();
});

test('mismatched Home and injected storage paths cannot remove another object', async () => {
  db.getTable('File')[0].file_path = 'some-other-home/private-file';
  expect((await request(app).delete(endpoint)).status).toBe(404);
  expect(rpc).not.toHaveBeenCalled();
  expect(bucket.remove).not.toHaveBeenCalled();
});

test('storage configuration changes leave content denied and cleanup pending', async () => {
  db.storage.getBucket.mockResolvedValue({ data: { public: true }, error: null });
  const result = await request(app).delete(endpoint);
  expect(result.status).toBe(202);
  expect(result.body.cleanup_pending).toBe(true);
  expect(bucket.remove).not.toHaveBeenCalled();
  expect((await request(app).get(endpoint + '/content')).status).toBe(404);
});

test('an old upload UUID cannot resurrect its deleted document', async () => {
  await request(app).delete(endpoint);
  const result = await request(app).post(`/api/homes/${homeId}/documents/upload`)
    .field('upload_id', documentId).field('title', 'Old retry').field('doc_type', 'receipt')
    .attach('file', Buffer.from('old bytes'), { filename: 'old.txt', contentType: 'text/plain' });
  expect(result.status).toBe(409);
  expect(db.getTable('HomeDocument')).toHaveLength(0);
});
