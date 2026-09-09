const express = require('express');
const request = require('supertest');
const db = require('./__mocks__/supabaseAdmin');
jest.mock('../middleware/rateLimiter', () => ({
  ...jest.requireActual('../middleware/rateLimiter'),
  homeDocumentUploadLimiter: (_req, _res, next) => next(),
}));
jest.mock('../utils/homePermissions', () => ({
  ...jest.requireActual('../utils/homePermissions'), checkHomePermission: jest.fn(),
}));
const { checkHomePermission } = require('../utils/homePermissions');
const app = express();
app.use(express.json());
app.use('/api/homes', require('../routes/homeDocumentFiles'));
app.use('/api/homes', require('../routes/home'));
const homeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const documentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const userId = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const contentPath = `/api/homes/${homeId}/documents/${documentId}/content`;
const bytes = Buffer.from('Home document byte check — green notebook');
let objects;
let quota;
let bucket;
let previousBucket;

function uploading(fields = {}, body = bytes) {
  let call = request(app).post(`/api/homes/${homeId}/documents/upload`);
  for (const [name, value] of Object.entries({ upload_id: documentId, doc_type: 'receipt', title: 'Green notebook', visibility: 'members', ...fields })) {
    call = call.field(name, typeof value === 'object' ? JSON.stringify(value) : value);
  }
  return call.attach('file', body, { filename: 'receipt.txt', contentType: 'text/plain' });
}

beforeEach(() => {
  db.resetTables();
  checkHomePermission.mockImplementation(async (_home, _user, permission) => ({
    hasAccess: permission !== 'sensitive.view', isOwner: false, occupancy: { role_base: 'member' },
  }));
  quota = jest.fn().mockResolvedValue({ data: { canUpload: true }, error: null });
  db.setRpcMock(quota);
  objects = new Map();
  bucket = {
    upload: jest.fn(async (key, data) => {
      if (objects.has(key)) return { error: { statusCode: '409' } };
      objects.set(key, Buffer.from(data));
      return { data: { path: key }, error: null };
    }),
    download: jest.fn(async key => objects.has(key)
      ? { data: new Blob([objects.get(key)]), error: null }
      : { data: null, error: { statusCode: '404' } }),
  };
  db.storage = { getBucket: jest.fn().mockResolvedValue({ data: { public: false }, error: null }), from: jest.fn().mockReturnValue(bucket) };
  previousBucket = process.env.HOME_DOCUMENTS_BUCKET;
  process.env.HOME_DOCUMENTS_BUCKET = 'test-private-home-documents';
});
afterEach(() => {
  jest.restoreAllMocks(); delete db.storage;
  if (previousBucket === undefined) delete process.env.HOME_DOCUMENTS_BUCKET;
  else process.env.HOME_DOCUMENTS_BUCKET = previousBucket;
});

test('uploads, lists and retrieves the exact bytes through an authenticated Home document path', async () => {
  const created = await uploading({ details: { tags: 'receipt,home' } });
  expect(created.status).toBe(201);
  expect(created.body.document).toMatchObject({ id: documentId, content_url: contentPath, storage_path: null, storage_bucket: null, details: { tags: 'receipt,home' } });
  expect(created.body.document.details.upload_fingerprint).toBeUndefined();
  expect(db.getTable('File')).toHaveLength(1);
  expect(db.getTable('File')[0]).toMatchObject({ user_id: userId, home_id: homeId, file_size: bytes.length, file_extension: '.txt', visibility: 'private', file_url: contentPath });
  const listing = await request(app).get(`/api/homes/${homeId}/documents`);
  expect(listing.body.documents[0].content_url).toBe(contentPath);
  expect(listing.body.documents[0].details.upload_sha256).toBeUndefined();
  const downloaded = await request(app).get(contentPath);
  expect(downloaded.status).toBe(200);
  expect(Buffer.from(downloaded.text)).toEqual(bytes);
  expect(downloaded.headers['cache-control']).toBe('private, no-store');
  expect(downloaded.headers['content-disposition']).toContain('receipt.txt');
  expect(downloaded.headers.location).toBeUndefined();
});

test('an identical retry returns one existing document and consumes quota once', async () => {
  expect((await uploading()).status).toBe(201);
  const again = await uploading();
  expect(again.status).toBe(200);
  expect(again.body.reused).toBe(true);
  expect(db.getTable('HomeDocument')).toHaveLength(1);
  expect(db.getTable('File')).toHaveLength(1);
  expect(objects.size).toBe(1);
  expect(bucket.upload).toHaveBeenCalledTimes(1);
  expect(quota).toHaveBeenCalledTimes(1);
});

test('normalizes native uppercase UUIDs to the database and storage identities', async () => {
  const result = await uploading({ upload_id: documentId.toUpperCase() });
  expect(result.status).toBe(201);
  expect(result.body.document.id).toBe(documentId);
  expect((await request(app).get(contentPath)).status).toBe(200);
});

test.each(['metadata', 'bytes'])('a reused identifier cannot overwrite different %s', async kind => {
  await uploading();
  const response = kind === 'metadata' ? await uploading({ title: 'Changed title' }) : await uploading({}, Buffer.from('changed bytes'));
  expect(response.status).toBe(409);
  expect(objects.size).toBe(1);
  expect(db.getTable('HomeDocument')[0].title).toBe('Green notebook');
});

test('a stored file survives a metadata failure and retry finishes the same document without double quota', async () => {
  const from = db.from;
  const spy = jest.spyOn(db, 'from').mockImplementation(table => {
    const builder = from(table);
    if (table === 'HomeDocument') {
      const insert = builder.insert.bind(builder);
      builder.insert = data => {
        const query = insert(data);
        query.single = async () => ({ data: null, error: { message: 'temporary write failure' } });
        return query;
      };
    }
    return builder;
  });
  expect((await uploading()).status).toBe(503);
  expect(db.getTable('File')).toHaveLength(1);
  expect(db.getTable('HomeDocument')).toHaveLength(0);
  spy.mockRestore();
  expect((await uploading()).status).toBe(201);
  expect(db.getTable('HomeDocument')).toHaveLength(1);
  expect(objects.size).toBe(1);
  expect(quota).toHaveBeenCalledTimes(1);
});

test('revoked document access denies an old content path before storage retrieval', async () => {
  await uploading(); bucket.download.mockClear();
  checkHomePermission.mockResolvedValue({ hasAccess: false });
  expect((await request(app).get(contentPath)).status).toBe(403);
  expect(bucket.download).not.toHaveBeenCalled();
});

test('a deletion winning an in-flight upload prevents publication and schedules its late object for cleanup', async () => {
  const from = db.from;
  jest.spyOn(db, 'from').mockImplementation(table => {
    const builder = from(table);
    if (table === 'HomeDocument') {
      const insert = builder.insert.bind(builder);
      builder.insert = data => {
        const query = insert(data);
        query.single = async () => {
          db.getTable('File')[0].is_deleted = true;
          return { data: null, error: { code: '23514' } };
        };
        return query;
      };
    }
    return builder;
  });
  const result = await uploading();
  expect(result.status).toBe(409);
  expect(result.body.code).toBe('DOCUMENT_UPLOAD_CONFLICT');
  expect(db.getTable('HomeDocument')).toHaveLength(0);
  expect(objects.size).toBe(1);
  expect(quota).toHaveBeenCalledWith('mark_home_document_cleanup_pending', { p_file_id: documentId });
});

test('sensitive visibility is checked again when opening an existing document', async () => {
  await uploading(); bucket.download.mockClear();
  db.getTable('HomeDocument')[0].visibility = 'sensitive';
  expect((await request(app).get(contentPath)).status).toBe(403);
  expect(bucket.download).not.toHaveBeenCalled();
});

test('a different home cannot retrieve an existing file', async () => {
  await uploading(); bucket.download.mockClear();
  const otherHome = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  expect((await request(app).get(contentPath.replace(homeId, otherHome))).status).toBe(404);
  expect(bucket.download).not.toHaveBeenCalled();
});

test('a deleted file is not retrievable through its old document', async () => {
  await uploading(); bucket.download.mockClear();
  db.getTable('File')[0].is_deleted = true;
  expect((await request(app).get(contentPath)).status).toBe(404);
  expect(bucket.download).not.toHaveBeenCalled();
});

test('client storage paths cannot replace the derived authorized object path', async () => {
  await uploading(); bucket.download.mockClear();
  db.getTable('File')[0].file_path = 'another-home/secret';
  expect((await request(app).get(contentPath)).status).toBe(404);
  expect(bucket.download).not.toHaveBeenCalled();
});

test('a public bucket configuration cannot create document/file records', async () => {
  db.storage.getBucket.mockResolvedValue({ data: { public: true }, error: null });
  expect((await uploading()).status).toBe(503);
  expect(db.getTable('File')).toHaveLength(0);
  expect(db.getTable('HomeDocument')).toHaveLength(0);
});

test('denied upload permission performs no storage or document writes', async () => {
  checkHomePermission.mockResolvedValue({ hasAccess: false });
  expect((await uploading()).status).toBe(403);
  expect(bucket.upload).not.toHaveBeenCalled();
  expect(db.getTable('File')).toHaveLength(0);
});

test('quota refusal does not write storage', async () => {
  quota.mockResolvedValue({ data: { canUpload: false }, error: null });
  expect((await uploading()).status).toBe(413);
  expect(bucket.upload).not.toHaveBeenCalled();
});

test.each([
  [{ code: 'P0001', message: 'FILE_QUOTA_EXCEEDED' }, 413],
  [{ code: '08006', message: 'connection unavailable' }, 503],
])('failed durable admission never writes provider bytes: %j', async (error, status) => {
  const from = db.from;
  jest.spyOn(db, 'from').mockImplementation(table => {
    const builder = from(table);
    if (table === 'File') {
      const insert = builder.insert.bind(builder);
      builder.insert = data => {
        const result = insert(data);
        result.single = async () => ({ data: null, error });
        return result;
      };
    }
    return builder;
  });
  const result = await uploading();
  expect(result.status).toBe(status);
  expect(bucket.upload).not.toHaveBeenCalled();
  expect(objects.size).toBe(0);
  expect(db.getTable('File')).toHaveLength(0);
  expect(db.getTable('HomeDocument')).toHaveLength(0);
});

test('provider outage retains one recoverable reservation and retry uses the same quota', async () => {
  bucket.upload.mockResolvedValueOnce({ error: { statusCode: '503' } });
  expect((await uploading()).status).toBe(503);
  expect(db.getTable('File')).toHaveLength(1);
  expect(db.getTable('File')[0]).toMatchObject({ processing_status: 'uploading', is_deleted: false });
  expect(db.getTable('HomeDocument')).toHaveLength(0);
  expect(objects.size).toBe(0);
  expect((await uploading()).status).toBe(201);
  expect(db.getTable('File')).toHaveLength(1);
  expect(db.getTable('File')[0].processing_status).toBe('completed');
  expect(db.getTable('HomeDocument')).toHaveLength(1);
  expect(objects.size).toBe(1);
  expect(quota).toHaveBeenCalledTimes(1);
});

test.each([
  { upload_id: 'invalid' }, { title: '' }, { visibility: 'sensitive' },
  { details: { preview_url: 'https://example.com' } },
])('rejects invalid or forbidden metadata before storage: %j', async fields => {
  expect([400, 403]).toContain((await uploading(fields)).status);
  expect(bucket.upload).not.toHaveBeenCalled();
});

test.each([
  { storage_path: 'private/elsewhere' }, { storage_bucket: 'private' },
  { file_id: documentId }, { details: { storage_contract: 'home_document_v1' } },
])('the JSON metadata endpoint cannot mint trusted storage references: %j', async fields => {
  const response = await request(app).post(`/api/homes/${homeId}/documents`).send({ title: 'Untrusted attachment', doc_type: 'receipt', ...fields });
  expect(response.status).toBe(400);
  expect(db.getTable('HomeDocument')).toHaveLength(0);
});


test('retry cannot reveal a document moved into a restricted visibility', async () => {
  await uploading();
  db.getTable('HomeDocument')[0].visibility = 'managers';
  const retry = await uploading();
  expect(retry.status).toBe(403);
  expect(retry.body.document).toBeUndefined();
});
