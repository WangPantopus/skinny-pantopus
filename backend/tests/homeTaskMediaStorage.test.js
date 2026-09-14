const db = require('./__mocks__/supabaseAdmin');
const storage = require('../services/homeTaskMediaStorage');
const file = { originalname: 'private.txt', mimetype: 'text/plain', buffer: Buffer.from('private task bytes') };
const details = storage.inspect(file);
const ref = { home_id: 'ddf10001-0000-4000-8000-000000000100', task_id: 'ddf10001-0000-4000-8000-000000000200',
  upload_id: 'ddf10001-0000-4000-8000-000000000300', bucket: 'private-test', sha256: details.sha256, size: file.buffer.length, mime_type: file.mimetype };
let bucket; let old;
beforeEach(() => {
  old = process.env.HOME_DOCUMENTS_BUCKET; process.env.HOME_DOCUMENTS_BUCKET = ref.bucket;
  bucket = { upload: jest.fn().mockResolvedValue({ error: null }), download: jest.fn().mockResolvedValue({ data: new Blob([file.buffer]) }), remove: jest.fn().mockResolvedValue({ error: null }) };
  db.storage = { getBucket: jest.fn().mockResolvedValue({ data: { public: false } }), from: jest.fn().mockReturnValue(bucket) };
});
afterEach(() => { if (old === undefined) delete process.env.HOME_DOCUMENTS_BUCKET; else process.env.HOME_DOCUMENTS_BUCKET = old; delete db.storage; });
test('exact private key and immutable provider upload', async () => {
  await storage.upload(ref, file.buffer);
  expect(bucket.upload).toHaveBeenCalledWith(`task-media/${ref.home_id}/${ref.task_id}/${ref.upload_id}/${ref.sha256}`, file.buffer,
    { contentType: 'text/plain', cacheControl: '0', upsert: false });
});
test.each([true, undefined])('refuses non-private bucket state %s', async publicValue => {
  db.storage.getBucket.mockResolvedValue({ data: { public: publicValue } });
  await expect(storage.upload(ref, file.buffer)).rejects.toMatchObject({ statusCode: 503 }); expect(bucket.upload).not.toHaveBeenCalled();
});
test('lost reply reconciles exact bytes without overwrite', async () => {
  bucket.upload.mockRejectedValue(new Error('private provider error'));
  await storage.upload(ref, file.buffer); expect(bucket.download).toHaveBeenCalledWith(storage.key(ref));
});
test('wrong existing bytes never count as upload success', async () => {
  bucket.upload.mockResolvedValue({ error: {} }); bucket.download.mockResolvedValue({ data: new Blob(['incorrect']) });
  await expect(storage.upload(ref, file.buffer)).rejects.toMatchObject({ code: 'HOME_TASK_MEDIA_UPLOAD_UNAVAILABLE' });
});
test('download verifies length and hash', async () => {
  expect(await storage.download(ref)).toEqual(file.buffer);
  bucket.download.mockResolvedValue({ data: new Blob([Buffer.alloc(file.buffer.length)]) });
  await expect(storage.download(ref)).rejects.toMatchObject({ code: 'HOME_TASK_MEDIA_INTEGRITY' });
});
test('bucket mismatch blocks read and delete', async () => {
  await expect(storage.download({ ...ref, bucket: 'another-private-bucket' })).rejects.toMatchObject({ statusCode: 503 });
  await expect(storage.remove({ ...ref, bucket: 'another-private-bucket' })).rejects.toMatchObject({ statusCode: 503 });
  expect(bucket.download).not.toHaveBeenCalled(); expect(bucket.remove).not.toHaveBeenCalled();
});
test('removal ignores arbitrary supplied paths', async () => {
  await storage.remove({ ...ref, file_path: 'another-file' }); expect(bucket.remove).toHaveBeenCalledWith([storage.key(ref)]);
});
test.each(['home_id', 'task_id', 'upload_id', 'sha256'])('rejects traversal in %s', field => expect(() => storage.key({ ...ref, [field]: '../other' })).toThrow());
test.each(['text/html', 'application/javascript', 'image/svg+xml', 'application/zip'])('rejects active/archive type %s', mimetype => expect(() => storage.inspect({ ...file, mimetype })).toThrow());
test('rejects mismatched content and sanitizes display names', () => {
  expect(() => storage.inspect({ ...file, mimetype: 'image/png' })).toThrow();
  expect(storage.inspect({ ...file, originalname: '../bad\r\nname.txt' }).file_name).toBe('.._bad__name.txt');
});
test.each([0, storage.MAX_BYTES + 1])('rejects size %s', size => expect(() => storage.inspect({ ...file, buffer: Buffer.alloc(size) })).toThrow());
