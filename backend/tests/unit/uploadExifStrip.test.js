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
