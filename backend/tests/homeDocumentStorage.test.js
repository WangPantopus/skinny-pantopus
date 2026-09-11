const crypto = require('crypto');
const db = require('./__mocks__/supabaseAdmin');
const storage = require('../services/homeDocumentStorage');
const homeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const documentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const bytes = Buffer.from('synthetic document bytes');
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const bucketName = 'test-private-home-documents';
let previousBucket;
let bucket;

beforeEach(() => {
  previousBucket = process.env.HOME_DOCUMENTS_BUCKET;
  process.env.HOME_DOCUMENTS_BUCKET = bucketName;
  bucket = {
    upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
    download: jest.fn().mockResolvedValue({ data: new Blob([bytes]), error: null }),
  };
  db.storage = {
    getBucket: jest.fn().mockResolvedValue({ data: { name: bucketName, public: false }, error: null }),
    from: jest.fn().mockReturnValue(bucket),
  };
});
afterEach(() => {
  if (previousBucket === undefined) delete process.env.HOME_DOCUMENTS_BUCKET;
  else process.env.HOME_DOCUMENTS_BUCKET = previousBucket;
  delete db.storage;
});

const uploading = () => storage.upload({ homeId, documentId, buffer: bytes, mimeType: 'text/plain' });

test('stores real bytes in a verified private bucket without issuing a public or signed URL', async () => {
  const result = await uploading();
  expect(result).toEqual({ bucket: bucketName, key: `${homeId}/${documentId}/${sha256}`, sha256, size: bytes.length });
  expect(bucket.upload).toHaveBeenCalledWith(result.key, bytes, { contentType: 'text/plain', cacheControl: '0', upsert: false });
  expect(result.url).toBeUndefined();
});

test.each([true, undefined])('refuses a bucket that is not explicitly private: %s', async isPublic => {
  db.storage.getBucket.mockResolvedValue({ data: { public: isPublic }, error: null });
  await expect(uploading()).rejects.toMatchObject({ status: 503, code: 'DOCUMENT_STORAGE_UNAVAILABLE' });
  expect(bucket.upload).not.toHaveBeenCalled();
});

test('fails closed when bucket metadata cannot be read', async () => {
  db.storage.getBucket.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
  await expect(uploading()).rejects.toMatchObject({ status: 503 });
  expect(bucket.upload).not.toHaveBeenCalled();
});

test('an absent bucket setting cannot silently select another storage environment', async () => {
  delete process.env.HOME_DOCUMENTS_BUCKET;
  await expect(uploading()).rejects.toMatchObject({ status: 503 });
  expect(db.storage.getBucket).not.toHaveBeenCalled();
});

test('reconciles exact stored bytes after a duplicate or lost upload response', async () => {
  bucket.upload.mockResolvedValue({ error: { message: 'response lost' } });
  expect((await uploading()).sha256).toBe(sha256);
  expect(bucket.download).toHaveBeenCalledWith(`${homeId}/${documentId}/${sha256}`);
});

test.each([
  { data: null, error: { message: 'not found' } },
  { data: new Blob(['different document']), error: null },
])('does not treat an unverified failed upload as success', async downloadResult => {
  bucket.upload.mockResolvedValue({ error: { message: 'upload failed' } });
  bucket.download.mockResolvedValue(downloadResult);
  await expect(uploading()).rejects.toMatchObject({ status: 503, code: 'DOCUMENT_UPLOAD_UNAVAILABLE' });
});

test('returns the exact stored bytes through authenticated server retrieval', async () => {
  expect(await storage.download({ homeId, documentId, sha256, bucketName })).toEqual(bytes);
});

test('never retrieves from an arbitrary bucket', async () => {
  await expect(storage.download({ homeId, documentId, sha256, bucketName: 'other-bucket' })).rejects.toMatchObject({ status: 404 });
  expect(bucket.download).not.toHaveBeenCalled();
});

test('rejects corrupted content at download', async () => {
  bucket.download.mockResolvedValue({ data: new Blob(['corrupt']), error: null });
  await expect(storage.download({ homeId, documentId, sha256, bucketName })).rejects.toMatchObject({ code: 'DOCUMENT_INTEGRITY_ERROR' });
});

test.each(['../outside', 'https://example.com/private'])('rejects path injection: %s', invalid => {
  expect(() => storage.documentKey(invalid, documentId, sha256)).toThrow('Invalid document storage reference');
  expect(() => storage.documentKey(homeId, invalid, sha256)).toThrow('Invalid document storage reference');
  expect(() => storage.documentKey(homeId, documentId, invalid)).toThrow('Invalid document storage reference');
});

test('rejects oversized or empty content before any storage call', async () => {
  for (const buffer of [Buffer.alloc(0), Buffer.alloc(storage.MAX_DOCUMENT_BYTES + 1)]) {
    await expect(storage.upload({ homeId, documentId, buffer, mimeType: 'text/plain' })).rejects.toMatchObject({ status: 413 });
  }
  expect(db.storage.getBucket).not.toHaveBeenCalled();
});

test('rejects unsupported active content before storage', async () => {
  await expect(storage.upload({ homeId, documentId, buffer: bytes, mimeType: 'text/html' })).rejects.toMatchObject({ status: 415 });
  expect(db.storage.getBucket).not.toHaveBeenCalled();
});
