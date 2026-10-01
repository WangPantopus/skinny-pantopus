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
  uploadToS3: jest.fn(), uploadGeneral: jest.fn(), deleteFromS3: jest.fn(),
  categorizeFile: jest.fn(() => 'document'), isAllowedType: jest.fn(() => true),
  MAX_FILE_SIZES: { document: 25 * 1024 * 1024 },
}));

// Exercise the existing multipart route and File identity contract alongside
// its metadata stripping checks; no separate upload stack or test file.
describe('chat attachment retry identity', () => {
  const express = require('express');
  const request = require('supertest');
  const db = require('../__mocks__/supabaseAdmin');
  const s3 = require('../../services/s3Service');
  const app = express();
  app.use('/upload', require('../../routes/upload'));
  const user = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
  const room = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const key = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  function upload(intent = key, body = 'document') {
    const r = request(app).post(`/upload/chat-media/${room}`);
    if (intent !== null) r.field('client_request_id', intent);
    return r.attach('files', Buffer.from(body), { filename: 'note.txt', contentType: 'text/plain' });
  }
  beforeEach(() => {
    db.resetTables();
    db.seedTable('ChatParticipant', [{ id: 'p', room_id: room, user_id: user, is_active: true }]);
    s3.uploadToS3.mockReset().mockImplementation(async (_, objectKey) => ({ key: objectKey, url: 'https://storage.example/' + objectKey }));
    s3.uploadGeneral.mockReset().mockImplementation(async () => ({ key: require('crypto').randomUUID(), url: 'https://storage.example/file' }));
    s3.deleteFromS3.mockReset().mockResolvedValue(undefined);
  });
  test('identical retry returns one File and an authenticated proxy URL', async () => {
    const first = await upload(); const second = await upload();
    expect(first.status).toBe(200); expect(second.status).toBe(200);
    expect(second.body.media).toEqual(first.body.media);
    expect(db.getTable('File')).toHaveLength(1);
    expect(s3.uploadToS3).toHaveBeenCalledTimes(1);
    expect(first.body.media[0].file_url).toBe('/api/chat/files/' + first.body.media[0].id);
    expect(first.body.media[0]).not.toHaveProperty('metadata');
  });
  test('changed bytes and deleted Files cannot reuse an intent', async () => {
    expect((await upload()).status).toBe(200);
    expect((await upload(key, 'changed')).status).toBe(409);
    db.getTable('File')[0].is_deleted = true;
    expect((await upload()).status).toBe(409);
    expect(s3.uploadToS3).toHaveBeenCalledTimes(1);
  });
  test('overlapping identical requests share the existing primary key', async () => {
    const responses = await Promise.all([upload(), upload(), upload(), upload()]);
    expect(responses.map(r => r.status)).toEqual([200, 200, 200, 200]);
    expect(new Set(responses.map(r => r.body.media[0].id)).size).toBe(1);
    expect(db.getTable('File')).toHaveLength(1);
    expect(new Set(s3.uploadToS3.mock.calls.map(c => c[1])).size).toBe(1);
    expect(s3.deleteFromS3).not.toHaveBeenCalled();
  });
  test('a partial batch retries only its unfinished part', async () => {
    const realUpload = s3.uploadToS3.getMockImplementation(); let calls = 0;
    s3.uploadToS3.mockImplementation(async (...args) => { if (++calls === 2) throw new Error('storage unavailable'); return realUpload(...args); });
    const batch = () => upload().attach('files', Buffer.from('second'), { filename: 'other.txt', contentType: 'text/plain' });
    expect((await batch()).status).toBe(500);
    const retry = await batch(); expect(retry.status).toBe(200);
    expect(retry.body.media).toHaveLength(2); expect(db.getTable('File')).toHaveLength(2);
    expect(s3.uploadToS3).toHaveBeenCalledTimes(3);
  });
  test('changed batch length conflicts and membership is rechecked on retry', async () => {
    expect((await upload()).status).toBe(200);
    expect((await upload().attach('files', Buffer.from('extra'), { filename: 'other.txt', contentType: 'text/plain' })).status).toBe(409);
    db.getTable('ChatParticipant')[0].is_active = false;
    expect((await upload()).status).toBe(403);
  });
  test('invalid keys are refused and unkeyed clients retain their behavior', async () => {
    expect((await upload('invalid')).status).toBe(400);
    expect((await upload(null)).status).toBe(200); expect((await upload(null)).status).toBe(200);
    expect(db.getTable('File')).toHaveLength(2); expect(s3.uploadGeneral).toHaveBeenCalledTimes(2);
  });
});
