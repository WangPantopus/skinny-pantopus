// Portfolio multipart retries use S3 object names and File's existing primary key.
// Home upload suites exercise separate private-storage/RPC contracts, so keep this
// route's concurrency and failed-commit regressions in their own existing-stack suite.
const express = require('express');
const request = require('supertest');
const db = require('./__mocks__/supabaseAdmin');
jest.mock('../services/s3Service', () => ({
  uploadToS3: jest.fn(), generateS3Key: jest.fn(), deleteFromS3: jest.fn(),
}));
const s3 = require('../services/s3Service');
const app = express();
app.use('/api/files', require('../routes/files'));
const key = 'bcdef012-3456-4789-abcd-0123456789ab';
const actor = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
let objects;
let quota;
function upload(fields = {}, bytes = 'synthetic portfolio document', user = actor) {
  let req = request(app).post('/api/files/portfolio').set('x-test-user-id', user);
  for (const [name, value] of Object.entries({ title: 'Project notes', client_request_id: key, ...fields })) {
    if (value !== null) req = req.field(name, value);
  }
  return req.attach('file', Buffer.from(bytes), { filename: 'project.txt', contentType: 'text/plain' });
}
beforeEach(() => {
  db.resetTables(); objects = new Map();
  quota = jest.fn().mockResolvedValue({ data: { canUpload: true }, error: null });
  db.setRpcMock(quota);
  s3.generateS3Key.mockImplementation(() => `portfolio/legacy/${Math.random()}.txt`);
  s3.uploadToS3.mockImplementation(async (bytes, path) => {
    objects.set(path, Buffer.from(bytes));
    return { key: path, url: `https://storage.example.com/${path}` };
  });
  s3.deleteFromS3.mockImplementation(async path => objects.delete(path));
});
afterEach(() => jest.restoreAllMocks());
test('lost reply retry returns the first item without storage/quota work; uppercase key is equivalent', async () => {
  const first = await upload();
  const again = await upload({ client_request_id: key.toUpperCase() });
  expect(first.status).toBe(201); expect(again.status).toBe(201);
  expect(again.body).toEqual(first.body);
  expect(db.getTable('File')).toHaveLength(1); expect(objects.size).toBe(1);
  expect(quota).toHaveBeenCalledTimes(1); expect(s3.uploadToS3).toHaveBeenCalledTimes(1);
  expect(first.body.file.metadata.upload_fingerprint).toBeUndefined();
});
test('overlapping identical intents persist one item and one object', async () => {
  const results = await Promise.all(Array.from({ length: 4 }, () => upload()));
  expect(results.map(r => r.status)).toEqual([201, 201, 201, 201]);
  expect(new Set(results.map(r => r.body.file.id)).size).toBe(1);
  expect(db.getTable('File')).toHaveLength(1); expect(objects.size).toBe(1);
});
test.each(['metadata', 'bytes'])('a reused key cannot overwrite changed %s', async kind => {
  await upload();
  const response = kind === 'metadata' ? await upload({ title: 'Changed' }) : await upload({}, 'changed bytes');
  expect(response.status).toBe(409); expect(objects.size).toBe(1);
  expect([...objects.values()][0].toString()).toBe('synthetic portfolio document');
});
test('overlapping different payloads refuse the loser and delete only its disjoint object', async () => {
  const responses = await Promise.all([upload(), upload({ title: 'Changed' }, 'changed bytes')]);
  expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
  expect(db.getTable('File')).toHaveLength(1); expect(objects.size).toBe(1);
  expect(objects.has(db.getTable('File')[0].file_path)).toBe(true);
});
test('a database reply lost after commit keeps the winning object and retry recovers', async () => {
  const from = db.from;
  let lost = false;
  jest.spyOn(db, 'from').mockImplementation(table => {
    const builder = from(table);
    if (table === 'File') {
      const upsert = builder.upsert.bind(builder);
      builder.upsert = (...args) => {
        const query = upsert(...args); const single = query.maybeSingle.bind(query);
        query.maybeSingle = async () => { const response = await single(); if (!lost) { lost = true; return { data: null, error: { message: 'lost database reply' } }; } return response; };
        return query;
      };
    }
    return builder;
  });
  expect((await upload()).status).toBe(500);
  expect((await upload()).status).toBe(201);
  expect(objects.size).toBe(1); expect(s3.deleteFromS3).not.toHaveBeenCalled();
});
test('deleted item is not revived by an old request', async () => {
  await upload(); db.getTable('File')[0].is_deleted = true;
  expect((await upload()).status).toBe(409);
  expect(db.getTable('File')[0].is_deleted).toBe(true);
  expect(s3.uploadToS3).toHaveBeenCalledTimes(1);
});
test('a deletion winning during upload removes the late objects without reviving the row', async () => {
  const from = db.from;
  jest.spyOn(db, 'from').mockImplementation(table => {
    const builder = from(table);
    if (table === 'File') {
      const upsert = builder.upsert.bind(builder);
      builder.upsert = (row, options) => {
        db.seedTable('File', [{ ...row, is_deleted: true }]);
        return upsert(row, options);
      };
    }
    return builder;
  });
  expect((await upload()).status).toBe(409);
  expect(objects.size).toBe(0);
  expect(db.getTable('File')[0].is_deleted).toBe(true);
});
test('different users and new intents get separate items; legacy unkeyed uploads remain separate', async () => {
  await upload();
  await upload({}, undefined, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  await upload({ client_request_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });
  await upload({ client_request_id: null }); await upload({ client_request_id: null });
  expect(db.getTable('File')).toHaveLength(5); expect(objects.size).toBe(5);
});
test('invalid request key fails before storage', async () => {
  expect((await upload({ client_request_id: 'invalid' })).status).toBe(400);
  expect(s3.uploadToS3).not.toHaveBeenCalled();
});
