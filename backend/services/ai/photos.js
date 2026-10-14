/**
 * Chat photos as Claude image blocks.
 *
 * A photo the person uploaded for the assistant (/api/upload/ai-media) is read
 * from storage, scaled to the size Claude reads images at, and sent inline:
 * nothing depends on Anthropic's servers being able to fetch our storage URL,
 * and a 4 MB phone photo goes over as a few hundred kilobytes. Any other image
 * goes by URL, as before. A photo that can't be read (HEIC, a corrupt file)
 * comes back as null, so the caller can say so instead of answering without it.
 */
const sharp = require('sharp');
const s3 = require('../s3Service');
const logger = require('../../utils/logger');
const { imageBlock } = require('./llm');

// Claude scales anything larger down to about this on its long edge.
const MAX_EDGE = 1568;
const READ_TIMEOUT_MS = 4000;

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

async function readObject(key) {
  const { body } = await s3.getObjectStream(key);
  if (typeof body?.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** One of the person's own chat uploads as an inline JPEG block; null when it can't be decoded. */
async function inlineUpload(key) {
  const bytes = await Promise.race([
    readObject(key),
    new Promise((_, reject) => setTimeout(() => reject(new Error('storage read timed out')), READ_TIMEOUT_MS).unref?.()),
  ]);
  try {
    const jpeg = await sharp(bytes)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } };
  } catch (err) {
    // sharp can't decode it (HEIC from an iPhone, a corrupt file): Claude couldn't either.
    logger.info('AI chat photo could not be decoded', { key, error: err.message });
    return null;
  }
}

/**
 * Image blocks for the photos a person attached, in order, with null for each
 * one that can't be read.
 *
 * @param {string[]} sources  URLs (or data: URIs) the client sent.
 * @param {string}   userId   Only this person's own chat uploads are read from storage.
 */
async function photoBlocks(sources, userId) {
  return Promise.all((sources || []).map(async (source) => {
    const key = typeof source === 'string' ? storageKey(source) : null;
    if (key && key.startsWith(`ai-chat/${userId}/`)) {
      try {
        return await inlineUpload(key);
      } catch (err) {
        // Storage didn't answer: let Anthropic fetch the public URL instead.
        logger.warn('AI chat photo read failed; sending its URL', { key, error: err.message });
      }
    }
    return imageBlock(source);
  }));
}

module.exports = { photoBlocks };
