// A Moment's files (docs: ~/pantopus-moments CONTRACT "Routes"): the photo, or the video with its poster and the two
// frames the picture check reads, plus a small thumbnail for the chat quote. They live in private storage, the private
// Home documents bucket (or MOMENTS_BUCKET) under moments/, never at a public address: people allowed to watch get
// links that work for 15 minutes, and the cleanup job (jobs/momentsCleanup.js) deletes the files 7 days after the end.

const crypto = require('crypto');
const sharp = require('sharp');
const db = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

const LINK_SECONDS = 15 * 60;
const STORAGE_CONTRACT = 'moment_media_v1';
const PREFIX = 'moments/';
const MB = 1024 * 1024;
const MAX_PHOTO_BYTES = 10 * MB;
// Supabase Storage refuses a file over 50 MB on the Free plan; 30 s of 720p H.264 is 15–25 MB.
const MAX_VIDEO_BYTES = 50 * MB;
const MAX_STILL_BYTES = 10 * MB;
const MAX_VIDEO_MS = 30 * 1000;
// Exporters round the last frame up; a 30.0 s clip can read 30.04 s.
const VIDEO_MS_TOLERANCE = 500;
const PHOTO_TYPES = ['image/jpeg', 'image/heic', 'image/heif', 'image/png'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const THUMB_PX = 320;
const CHECK_PX = 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(message, status = 503, code = 'MOMENT_STORAGE_UNAVAILABLE') {
  return Object.assign(new Error(message), { status, statusCode: status, code });
}

// A public bucket would serve every Moment to anyone with its address. The verified name is kept for a few minutes.
let verifiedBucket = null;
async function privateBucket(expected) {
  const name = (process.env.MOMENTS_BUCKET || process.env.HOME_DOCUMENTS_BUCKET || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(name) || (expected !== undefined && expected !== name)) {
    throw failure('Moments storage is unavailable. Please try again.');
  }
  if (verifiedBucket?.name === name && verifiedBucket.until > Date.now()) return name;
  let result;
  try { result = await db.storage.getBucket(name); } catch (_) { result = null; }
  if (!result || result.error || result.data?.public !== false) throw failure('Moments storage is unavailable. Please try again.');
  verifiedBucket = { name, until: Date.now() + 5 * 60 * 1000 };
  return name;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function keyFor(authorId, momentId, role, digest, ext) {
  if (![authorId, momentId].every((id) => UUID.test(String(id))) || !/^[a-f0-9]{64}$/.test(digest)) {
    throw failure('Invalid Moment file.', 400, 'MOMENT_MEDIA_INVALID');
  }
  return `${PREFIX}${String(authorId).toLowerCase()}/${String(momentId).toLowerCase()}/${role}-${digest}.${ext}`;
}

function isMomentKey(key) {
  return typeof key === 'string' && key.startsWith(PREFIX) && !key.includes('..');
}

// Stores bytes under a key named by their own hash, so a retry writes the same object and an existing one is kept.
async function put(bucket, key, buffer, contentType) {
  let result;
  try {
    result = await db.storage.from(bucket).upload(key, buffer, { contentType, cacheControl: String(LINK_SECONDS), upsert: false });
  } catch (_) { result = null; }
  if (result && !result.error) return;
  const message = String(result?.error?.message || result?.error?.error || '');
  if (/exists|duplicate/i.test(message) || Number(result?.error?.statusCode) === 409) return;
  throw failure('The file could not be saved. Please try again.');
}

/** Short-lived links for these keys, by key; a key that can't be signed gets none. */
async function signedLinks(bucket, keys) {
  const wanted = [...new Set((keys || []).filter(isMomentKey))];
  const links = new Map();
  if (!wanted.length) return links;
  let name;
  try { name = await privateBucket(bucket); } catch (error) {
    logger.warn('moments.links_unavailable', { error: error.message });
    return links;
  }
  try {
    const { data, error } = await db.storage.from(name).createSignedUrls(wanted, LINK_SECONDS);
    if (error) throw error;
    for (const row of data || []) if (row?.signedUrl && !row.error) links.set(row.path, row.signedUrl);
  } catch (error) {
    logger.warn('moments.links_failed', { error: error.message });
  }
  return links;
}

/** Deletes the keys (already-gone keys are fine). Returns true when storage confirmed it. */
async function removeKeys(bucket, keys) {
  const doomed = [...new Set((keys || []).filter(isMomentKey))];
  if (!doomed.length) return true;
  const name = await privateBucket(bucket);
  const { error } = await db.storage.from(name).remove(doomed);
  if (error) {
    logger.warn('moments.remove_failed', { error: error.message, count: doomed.length });
    return false;
  }
  return true;
}

/** Every key a Moment's stored media names. */
function mediaKeys(media) {
  if (!media) return [];
  return [media.key, media.poster_key, media.thumb_key, ...(Array.isArray(media.frame_keys) ? media.frame_keys : [])]
    .filter(isMomentKey);
}

// ─── Reading a video ─────────────────────────────────────────────────────────

function unreadableVideo(detail) {
  return Object.assign(failure("We couldn't read this video, so we didn't save it. Try saving it as an MP4 and upload it again.",
    415, 'VIDEO_UNREADABLE'), { detail });
}

/** The boxes between `start` and `end` of an MP4/MOV, each { type, body, end }. Stops at a damaged box. */
function boxes(buffer, start, end) {
  const found = [];
  let at = start;
  while (at + 8 <= end) {
    let size = buffer.readUInt32BE(at);
    const type = buffer.toString('latin1', at + 4, at + 8);
    let body = at + 8;
    if (size === 1) {
      if (at + 16 > end) break;
      const large = buffer.readBigUInt64BE(at + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(large);
      body = at + 16;
    } else if (size === 0) {
      size = end - at;
    }
    if (size < body - at || at + size > end) break;
    found.push({ type, body, end: at + size });
    at += size;
  }
  return found;
}

const child = (buffer, parent, type) => boxes(buffer, parent.body, parent.end).find((box) => box.type === type) || null;

/**
 * The length and picture size of an MP4 or QuickTime video: { durationMs, width, height } (width and height as shown,
 * after a phone's rotation; null when there's no video track). Throws VIDEO_UNREADABLE for anything else.
 */
function videoFacts(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw unreadableVideo('too short');
  const top = boxes(buffer, 0, buffer.length);
  if (!top.length || !['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].includes(top[0].type)) throw unreadableVideo('not an MP4');
  const moov = top.find((box) => box.type === 'moov');
  const mvhd = moov && child(buffer, moov, 'mvhd');
  if (!mvhd || mvhd.end - mvhd.body < 20) throw unreadableVideo('no movie header');
  const version = buffer[mvhd.body];
  if (version === 1 && mvhd.end - mvhd.body < 32) throw unreadableVideo('short movie header');
  const timescale = version === 1 ? buffer.readUInt32BE(mvhd.body + 20) : buffer.readUInt32BE(mvhd.body + 12);
  const duration = version === 1 ? Number(buffer.readBigUInt64BE(mvhd.body + 24)) : buffer.readUInt32BE(mvhd.body + 16);
  if (!timescale || !Number.isFinite(duration)) throw unreadableVideo('no duration');
  const durationMs = Math.round((duration / timescale) * 1000);

  let width = null;
  let height = null;
  for (const trak of boxes(buffer, moov.body, moov.end).filter((box) => box.type === 'trak')) {
    const mdia = child(buffer, trak, 'mdia');
    const hdlr = mdia && child(buffer, mdia, 'hdlr');
    if (!hdlr || hdlr.end - hdlr.body < 12 || buffer.toString('latin1', hdlr.body + 8, hdlr.body + 12) !== 'vide') continue;
    const tkhd = child(buffer, trak, 'tkhd');
    if (!tkhd) continue;
    const v1 = buffer[tkhd.body] === 1;
    const matrixAt = tkhd.body + (v1 ? 52 : 40);
    if (matrixAt + 44 > tkhd.end) continue;
    const a = buffer.readInt32BE(matrixAt);
    const d = buffer.readInt32BE(matrixAt + 16);
    const w = Math.round(buffer.readUInt32BE(matrixAt + 36) / 65536);
    const h = Math.round(buffer.readUInt32BE(matrixAt + 40) / 65536);
    if (!w || !h) continue;
    const quarterTurn = a === 0 && d === 0;
    width = quarterTurn ? h : w;
    height = quarterTurn ? w : h;
    break;
  }
  return { durationMs, width, height };
}

// ─── Stills ─────────────────────────────────────────────────────────────────

/** A JPEG still (a poster or frame): its size, or PHOTO_UNREADABLE. */
async function jpegFacts(buffer) {
  try {
    const info = await sharp(buffer).metadata();
    if (info.format !== 'jpeg' || !info.width || !info.height) throw new Error(`not a JPEG: ${info.format}`);
    return { width: info.width, height: info.height };
  } catch (error) {
    throw Object.assign(failure("We couldn't read this picture. Try again.", 415, 'PHOTO_UNREADABLE'), { detail: error.message });
  }
}

async function photoFacts(buffer) {
  const info = await sharp(buffer).metadata();
  return { width: info.width || null, height: info.height || null };
}

/** A small JPEG of a picture, for the chat quote. Null when it can't be made. */
async function thumbnail(buffer) {
  try {
    return await sharp(buffer).rotate().resize(THUMB_PX, THUMB_PX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72 }).toBuffer();
  } catch (_) {
    return null;
  }
}

/** A picture as the check reads it: a JPEG no wider or taller than CHECK_PX, base64. Null when it can't be read. */
async function checkImage(buffer) {
  try {
    const jpeg = await sharp(buffer).rotate().resize(CHECK_PX, CHECK_PX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 }).toBuffer();
    return jpeg.toString('base64');
  } catch (_) {
    return null;
  }
}

/** Reads a stored file's bytes (the check reads them again when it runs later). */
async function download(bucket, key) {
  if (!isMomentKey(key)) throw failure('Invalid Moment file.', 400, 'MOMENT_MEDIA_INVALID');
  const name = await privateBucket(bucket);
  const { data, error } = await db.storage.from(name).download(key);
  if (error || !data) throw failure('The file could not be read.');
  return Buffer.from(await data.arrayBuffer());
}

module.exports = {
  LINK_SECONDS, STORAGE_CONTRACT, MAX_PHOTO_BYTES, MAX_VIDEO_BYTES, MAX_STILL_BYTES, MAX_VIDEO_MS, VIDEO_MS_TOLERANCE,
  PHOTO_TYPES, VIDEO_TYPES,
  failure, privateBucket, sha256, keyFor, isMomentKey, put, signedLinks, removeKeys, mediaKeys, download,
  videoFacts, jpegFacts, photoFacts, thumbnail, checkImage,
};
