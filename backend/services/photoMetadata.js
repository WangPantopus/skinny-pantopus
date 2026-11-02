/**
 * Photos are stored without their metadata: no location, camera or time taken.
 *
 * sharp writes JPEG, PNG, WebP, AVIF and GIF (animation kept) back in their own format without it. sharp can't
 * decode an iPhone's HEIC (its HEVC codec isn't in sharp's build), so a HEIC is decoded in a worker thread
 * (heicDecodeWorker.js) and stored as a JPEG, which every browser and app can show. A photo that can't be cleaned
 * is refused: it is never stored as it was sent.
 */
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const sharp = require('sharp');
const logger = require('../utils/logger');

const UNREADABLE = "We couldn't read this photo, so we didn't save it. Try saving it as a JPEG or PNG and upload it again.";
const TOO_LARGE = "This photo is too large for us to save. Try a smaller copy.";

// A 48-megapixel iPhone photo fits. Decoding one takes a few seconds and a few hundred MB, so conversions run one at
// a time, each in a thread that is stopped afterwards (the decoder's memory goes with it).
const MAX_HEIC_PIXELS = 50 * 1000 * 1000;
const HEIC_TIMEOUT_MS = 60 * 1000;

const TYPES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

class PhotoNotCleanedError extends Error {
  constructor(message, status, cause) {
    super(message);
    this.status = status;
    this.code = status === 413 ? 'PHOTO_TOO_LARGE' : 'PHOTO_UNREADABLE';
    this.cause = cause;
  }
}

let heicQueue = Promise.resolve();

/** RGBA pixels of a HEIC's primary image, decoded off the request thread. */
function decodeHeic(buffer) {
  const run = heicQueue.then(() => new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'heicDecodeWorker.js'), { workerData: buffer });
    let answer;
    const timer = setTimeout(() => {
      answer = { error: 'HEIC decoding timed out' };
      void worker.terminate();
    }, HEIC_TIMEOUT_MS);
    worker.once('message', (result) => {
      answer = result;
      void worker.terminate();
    });
    worker.once('error', (error) => { answer = { error: error.message }; });
    // Settles once the thread, and the decoder's memory, are gone, so the next conversion starts after it.
    worker.once('exit', (code) => {
      clearTimeout(timer);
      if (answer?.data) resolve(answer);
      else reject(new Error(answer?.error || `HEIC decoder stopped (${code})`));
    });
  }));
  heicQueue = run.catch(() => {});
  return run;
}

/**
 * The JPEG with its photo's own colour profile (an iPhone's Display P3) in APP2 segments. The decoded pixels are in
 * that colour space, and a profile describes colours only, so the photo shows as it was taken.
 */
function withColourProfile(jpeg, icc) {
  const header = Buffer.from('ICC_PROFILE\0', 'latin1');
  const room = 0xffff - 2 - header.length - 2;
  const count = Math.ceil(icc.length / room);
  if (!count || count > 255 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const segments = [];
  for (let i = 0; i < count; i += 1) {
    const chunk = icc.subarray(i * room, (i + 1) * room);
    const length = 2 + header.length + 2 + chunk.length;
    segments.push(Buffer.from([0xff, 0xe2, length >> 8, length & 0xff]), header, Buffer.from([i + 1, count]), chunk);
  }
  // Readers expect it after the JFIF header.
  const at = jpeg[2] === 0xff && jpeg[3] === 0xe0 ? 4 + jpeg.readUInt16BE(4) : 2;
  return Buffer.concat([jpeg.subarray(0, at), ...segments, jpeg.subarray(at)]);
}

async function heicToJpeg(buffer, info) {
  if (info.width * info.height > MAX_HEIC_PIXELS) throw new PhotoNotCleanedError(TOO_LARGE, 413);
  const { width, height, data } = await decodeHeic(buffer);
  const jpeg = await sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels: 4 } })
    .jpeg()
    .toBuffer();
  return { buffer: info.icc ? withColourProfile(jpeg, info.icc) : jpeg, mimetype: 'image/jpeg' };
}

/**
 * The photo without its metadata, by what the bytes are (not what the upload says they are): `{ buffer, mimetype }`.
 * Throws PhotoNotCleanedError when it can't be cleaned.
 * @param {Buffer} buffer
 * @param {{ limitInputPixels?: number }} [options] passed to sharp
 */
async function removePhotoMetadata(buffer, options = {}) {
  try {
    const info = await sharp(buffer, options).metadata();
    if (info.format === 'heif' && info.compression === 'hevc') return await heicToJpeg(buffer, info);
    const mimetype = info.format === 'heif' ? 'image/avif' : TYPES[info.format];
    if (!mimetype) throw new Error(`Unsupported photo format: ${info.format}`);
    // An animation keeps its frames; a still is turned upright by its EXIF orientation. sharp writes no metadata.
    const cleaned = info.pages > 1
      ? await sharp(buffer, { ...options, animated: true }).toBuffer()
      : await sharp(buffer, options).rotate().toBuffer();
    return { buffer: cleaned, mimetype };
  } catch (error) {
    if (error instanceof PhotoNotCleanedError) throw error;
    throw new PhotoNotCleanedError(UNREADABLE, 415, error);
  }
}

/**
 * Cleans an uploaded photo (a multer file) in place: its bytes, size, type and file name's extension follow the
 * cleaned photo, so storage keys and File rows describe what is stored. Anything that isn't an image is left alone.
 */
async function cleanUploadedPhoto(file, options) {
  if (!file?.mimetype?.startsWith('image/')) return file;
  try {
    const cleaned = await removePhotoMetadata(file.buffer, options);
    file.buffer = cleaned.buffer;
    file.size = cleaned.buffer.length;
    if (cleaned.mimetype !== file.mimetype) {
      const name = file.originalname || '';
      file.originalname = `${path.basename(name, path.extname(name)) || 'photo'}.${EXTENSIONS[cleaned.mimetype]}`;
      file.mimetype = cleaned.mimetype;
    }
    return file;
  } catch (error) {
    logger.warn('Photo refused: its metadata could not be removed', {
      originalname: file.originalname, declared: file.mimetype, error: error.cause?.message || error.message,
    });
    throw error;
  }
}

/**
 * Express middleware after multer: cleans every uploaded photo (req.file, or req.files as an array or by field), or
 * answers the refusal.
 */
async function removeUploadedPhotoMetadata(req, res, next) {
  const files = req.file ? [req.file] : Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
  try {
    for (const file of files) await cleanUploadedPhoto(file);
  } catch (error) {
    if (!(error instanceof PhotoNotCleanedError)) return next(error);
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  return next();
}

module.exports = { PhotoNotCleanedError, removePhotoMetadata, cleanUploadedPhoto, removeUploadedPhotoMetadata };
