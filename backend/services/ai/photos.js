/**
 * Chat photos as Claude image blocks.
 *
 * A photo the person uploaded for the assistant (/api/upload/ai-media) is read
 * from storage, scaled to the size Claude reads images at, and sent inline:
 * nothing depends on Anthropic's servers being able to fetch our storage URL,
 * and a 4 MB phone photo goes over as a few hundred kilobytes. Once read, it is
 * deleted: the stored transcript keeps no photos, so nothing reads it again, and
 * a letter or a lab report shouldn't stay in storage after the answer (uploads
 * no request ever read go in jobs/aiChatPhotoSweep.js). Any other image goes by
 * URL, as before. A photo that can't be read (HEIC, a corrupt file, one that's
 * gone) comes back as null, so the caller can say so instead of answering
 * without it.
 */
const sharp = require('sharp');
const s3 = require('../s3Service');
const logger = require('../../utils/logger');
const { imageBlock } = require('./llm');

// Claude scales anything larger down to about this on its long edge.
const MAX_EDGE = 1568;
const READ_TIMEOUT_MS = 4000;

// The upload hands back `ai-photo:<name>` for a photo stored as ai-chat/<userId>/<name>. It isn't
// an address anyone can open: only the person's own requests resolve it, to their own folder.
const REFERENCE = 'ai-photo:';
const PHOTO_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/** What the upload hands back for a photo stored under `key`. */
function photoReference(key) {
  return REFERENCE + key.slice(key.lastIndexOf('/') + 1);
}

/** The storage key of one of our public URLs, or null. */
function storageKey(url) {
  if (!s3.isPublicStorageUrl(url)) return null;
  try {
    const base = new URL(s3.getPublicUrl(''));
    return decodeURIComponent(new URL(url).pathname.slice(base.pathname.length));
  } catch {
    return null;
  }
}

/**
 * The storage key of the person's own chat photo that `source` names. '' when it names
 * someone else's (or isn't a photo name), which is refused rather than sent by URL; null
 * when it is any other image (a web address, a data: URI).
 */
function ownPhotoKey(source, userId) {
  if (typeof source !== 'string') return null;
  const folder = `ai-chat/${userId}/`;
  if (source.startsWith(REFERENCE)) {
    const name = source.slice(REFERENCE.length);
    return PHOTO_NAME.test(name) ? folder + name : '';
  }
  // The public-style address earlier servers handed out (they stored photos under ai-chat/<userId>/<userId>/).
  const key = storageKey(source);
  if (!key || !key.startsWith('ai-chat/')) return null;
  const own = key.startsWith(folder) && key.slice(folder.length).split('/').every((part) => PHOTO_NAME.test(part));
  return own ? key : '';
}

async function readObject(key) {
  const { body } = await s3.getObjectStream(key);
  if (typeof body?.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/**
 * Image bytes as an inline JPEG block at the size Claude reads; null when they can't be
 * decoded (HEIC from an iPhone, a corrupt file), which Claude couldn't read either.
 */
async function jpegBlock(bytes, logFields = {}) {
  try {
    const jpeg = await sharp(bytes)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } };
  } catch (err) {
    logger.info('AI photo could not be decoded', { ...logFields, error: err.message });
    return null;
  }
}

/** One of the person's own chat uploads as an inline JPEG block, deleted once read; null when it can't be decoded. */
async function inlineUpload(key) {
  const bytes = await Promise.race([
    readObject(key),
    new Promise((_, reject) => setTimeout(() => reject(new Error('storage read timed out')), READ_TIMEOUT_MS).unref?.()),
  ]);
  s3.deleteFromS3(key);
  return jpegBlock(bytes, { key });
}

/**
 * Image blocks for the photos a person attached, in order, with null for each
 * one that can't be read.
 *
 * @param {string[]} sources  What the client sent: upload references (or the addresses older
 *                            servers handed out), other image URLs, data: URIs.
 * @param {string}   userId   Only this person's own chat uploads are read from storage.
 */
async function photoBlocks(sources, userId) {
  return Promise.all((sources || []).map(async (source) => {
    const key = ownPhotoKey(source, userId);
    if (key === null) return imageBlock(source);
    if (!key) {
      logger.warn('AI chat photo refused: not one of the sender\'s uploads', { userId });
      return null;
    }
    try {
      return await inlineUpload(key);
    } catch (err) {
      // Never sent by its address instead: that isn't handed out, not even to Anthropic.
      logger.warn('AI chat photo could not be read', { key, error: err.message });
      return null;
    }
  }));
}

module.exports = { photoBlocks, photoReference, jpegBlock };
