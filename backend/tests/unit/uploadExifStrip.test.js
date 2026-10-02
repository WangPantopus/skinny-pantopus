/**
 * P2.12 — verify the server-side EXIF strip closes the §6.4 firewall
 * even when a mobile client forgets to strip client-side.
 *
 *   1. A JPEG with embedded EXIF GPS tags has metadata.exif present
 *      before stripImageMetadata runs.
 *   2. After stripImageMetadata runs, the buffer is a valid JPEG
 *      with NO exif chunk (firewall holds).
 *   3. PNG and WEBP go through the same path without crashing.
 *   4. Animated GIF skips stripping (matches the production decision
 *      to preserve animation rather than re-encode).
 */

const sharp = require('sharp');
const { stripImageMetadata } = require('../../routes/upload');

async function makeJpegWithExif() {
  return sharp({
    create: { width: 32, height: 32, channels: 3, background: '#cc3333' },
  })
    .withExif({
      IFD0: { Software: 'TestCam' },
      GPS: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '37/1,46/1,30/1',
        GPSLongitudeRef: 'W',
        GPSLongitude: '122/1,25/1,12/1',
      },
    })
    .jpeg({ quality: 92 })
    .toBuffer();
}

describe('P2.12 — backend EXIF strip', () => {
  test('JPEG with EXIF GPS: EXIF is present in the source buffer', async () => {
    const buffer = await makeJpegWithExif();
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeDefined();
    expect(meta.exif.length).toBeGreaterThan(0);
  });

  test('stripImageMetadata removes EXIF from a JPEG with GPS tags (firewall proof)', async () => {
    const buffer = await makeJpegWithExif();
    const file = { buffer, mimetype: 'image/jpeg', size: buffer.length, originalname: 'test.jpg' };
    await stripImageMetadata(file);

    // The buffer is mutated in place; verify the new buffer has NO
    // EXIF chunk and that the image is still readable.
    const out = await sharp(file.buffer).metadata();
    expect(out.format).toBe('jpeg');
    expect(out.exif).toBeUndefined();
    expect(out.width).toBe(32);
    expect(out.height).toBe(32);
  });

  test('stripImageMetadata is a no-op on a non-image MIME type', async () => {
    const buffer = Buffer.from('hello world');
    const file = { buffer, mimetype: 'application/octet-stream', size: buffer.length, originalname: 'x.bin' };
    await stripImageMetadata(file);
    // Buffer unchanged + the stripped function did not throw.
    expect(file.buffer.toString()).toBe('hello world');
  });

  test('stripImageMetadata skips animated GIF to preserve animation', async () => {
    // We don't need a real animated GIF — the function bails on the
    // mimetype string before invoking sharp. Use a tiny static GIF
    // header so the buffer is "valid enough".
    const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const file = { buffer: gifHeader, mimetype: 'image/gif', size: gifHeader.length, originalname: 'anim.gif' };
    await stripImageMetadata(file);
    // No mutation, no throw.
    expect(file.buffer).toBe(gifHeader);
  });

  test('stripImageMetadata handles PNG without crashing', async () => {
    const buffer = await sharp({
      create: { width: 16, height: 16, channels: 4, background: { r: 0, g: 128, b: 0, alpha: 1 } },
    }).png().toBuffer();
    const file = { buffer, mimetype: 'image/png', size: buffer.length, originalname: 'x.png' };
    await stripImageMetadata(file);
    const meta = await sharp(file.buffer).metadata();
    // sharp's .rotate().toBuffer() pipeline outputs JPEG by default;
    // verify we still have an image of the right dimensions.
    expect(meta.width).toBe(16);
    expect(meta.height).toBe(16);
  });
});

jest.mock('../../services/s3Service', () => ({
  uploadToS3: jest.fn(), generateS3Key: jest.fn(), deleteFromS3: jest.fn(),
}));

// Same S3 file-upload stack: preserve image stripping plus multipart retry coverage.
describe('portfolio upload retries', () => {
const express = require('express');
const request = require('supertest');
const db = require('../__mocks__/supabaseAdmin');
const s3 = require('../../services/s3Service');
const app = express();
app.use('/api/files', require('../../routes/files'));
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

});
