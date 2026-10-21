/**
 * Chat photos and PDFs as Claude image and document blocks.
 *
 * A photo the person uploaded for the assistant (/api/upload/ai-media) is read
 * from storage, scaled to the size Claude reads images at, and sent inline:
 * nothing depends on Anthropic's servers being able to fetch our storage URL,
 * and a 4 MB phone photo goes over as a few hundred kilobytes. A PDF (a warranty,
 * a policy, a lease) goes over as a document block, as it is. Once read, either
 * is deleted: the stored transcript keeps no photos or documents, so nothing
 * reads it again, and a letter or a lab report shouldn't stay in storage after
 * the answer (uploads no request ever read go in jobs/aiChatPhotoSweep.js). Any
 * other image goes by URL, as before. A file that can't be read (HEIC, a corrupt
 * file, one that's gone) comes back as null, so the caller can say so instead of
 * answering without it.
 */
const zlib = require('zlib');
const sharp = require('sharp');
const s3 = require('../s3Service');
const logger = require('../../utils/logger');
const { imageBlock } = require('./llm');

// Claude scales anything larger down to about this on its long edge.
const MAX_EDGE = 1568;
const READ_TIMEOUT_MS = 4000;
// What the assistant reads of a PDF: a home paper is a few pages, and each page costs
// about as much as a photo. Claude itself takes up to 32 MB and 100 pages.
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 20;

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

const isPdf = (bytes) => Buffer.isBuffer(bytes) && bytes.subarray(0, 5).toString('latin1') === '%PDF-';

/** PDF bytes as a Claude document block. */
function pdfBlock(bytes) {
  return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') } };
}

// A page object's dictionary names its type: /Type /Page (not /Pages, the tree above them).
const PAGE_TYPE = /\/Type\s*\/Page(?![A-Za-z])/;

/** The object numbers of the page objects packed in a compressed object stream (PDF 1.5+). */
function pagesInObjectStream(dictionary, data) {
  const count = Number(/\/N\s+(\d+)/.exec(dictionary)?.[1]);
  const first = Number(/\/First\s+(\d+)/.exec(dictionary)?.[1]);
  if (!Number.isInteger(count) || !Number.isInteger(first) || !/\/FlateDecode\b/.test(dictionary)) return [];
  let text;
  try {
    text = zlib.inflateSync(data, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('latin1');
  } catch {
    return [];
  }
  // The stream starts with pairs of numbers: each object's number and its offset after `first`.
  const header = text.slice(0, first).trim().split(/\s+/).map(Number);
  const pages = [];
  for (let i = 0; i < count; i += 1) {
    const start = first + header[2 * i + 1];
    const end = i + 1 < count ? first + header[2 * i + 3] : text.length;
    if (PAGE_TYPE.test(text.slice(start, end))) pages.push(header[2 * i]);
  }
  return pages;
}

/**
 * How many pages a PDF has and whether it is encrypted (password-protected or not, Claude
 * can't read an encrypted one), without a PDF library: page objects counted once each by
 * object number, in the file and in its compressed object streams, so a page that a later
 * revision of the file rewrote isn't counted twice. Null when the bytes aren't a PDF.
 */
function pdfFacts(bytes) {
  if (!isPdf(bytes)) return null;
  const text = bytes.toString('latin1');
  const pages = new Set();
  for (const object of text.matchAll(/(\d+)\s+\d+\s+obj\b/g)) {
    const at = object.index + object[0].length;
    const end = text.indexOf('endobj', at);
    if (end < 0) break;
    const body = text.slice(at, end);
    const streamAt = body.search(/\bstream\r?\n/);
    const dictionary = streamAt >= 0 ? body.slice(0, streamAt) : body;
    if (PAGE_TYPE.test(dictionary)) pages.add(Number(object[1]));
    if (streamAt >= 0 && /\/Type\s*\/ObjStm\b/.test(dictionary)) {
      const dataAt = at + streamAt + /\bstream\r?\n/.exec(body.slice(streamAt))[0].length;
      const dataEnd = text.lastIndexOf('endstream', end);
      for (const page of pagesInObjectStream(dictionary, bytes.subarray(dataAt, dataEnd))) pages.add(page);
    }
  }
  return { pages: pages.size, encrypted: /\/Encrypt\s*(?:\d+\s+\d+\s+R|<<)/.test(text) };
}

/**
 * One of the person's own chat uploads as an inline block, deleted once read: a PDF as a
 * document, anything else as a JPEG photo. Null when it can't be read.
 */
async function inlineUpload(key) {
  const bytes = await Promise.race([
    readObject(key),
    new Promise((_, reject) => setTimeout(() => reject(new Error('storage read timed out')), READ_TIMEOUT_MS).unref?.()),
  ]);
  s3.deleteFromS3(key);
  if (isPdf(bytes)) return bytes.length <= MAX_PDF_BYTES ? pdfBlock(bytes) : null;
  return jpegBlock(bytes, { key });
}

/**
 * Image and document blocks for the photos and PDFs a person attached, in order,
 * with null for each one that can't be read.
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

module.exports = {
  photoBlocks, photoReference, jpegBlock, isPdf, pdfBlock, pdfFacts, MAX_PDF_BYTES, MAX_PDF_PAGES,
};
