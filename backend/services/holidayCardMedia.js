/**
 * A Christmas card's own photo (and, once voice ships, its voice greeting): memories plan 2026-11-02 step 3 and its
 * contract (sections 2-4, 7, 10-12), behind the launch key `holiday_card_memories`.
 *
 * Stored the chat-files way (founder, November 2): one private `File` row per item (file_context holiday_card_media)
 * and one private S3 object under a key that names no one (holiday-card-media/<time>_<random>.<ext>). The bytes come
 * only through API routes that check the reader on every request, answered private and no-store; a file id never grants
 * anything by itself. A photo is stored once, as the server made it: upright, at most 1600 px on its long side, a JPEG
 * with every piece of metadata removed. The original is never stored.
 *
 * Which card an item belongs to is server-written in two places: the card's private stored copy (MailObject
 * body.payload.media, beside the note and the signature, so a sealed card shows nothing of it) and the File row's
 * metadata.mail_id, written before the card is stored, so a media route checks the piece and the file together without
 * reading the stored copy. Never logged: file names, keys as links, descriptions.
 */
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const sharp = require('sharp');
const supabaseAdmin = require('../config/supabaseAdmin');
const { S3_BUCKET, S3_STORAGE_NAMESPACE } = require('../config/aws');
const s3 = require('./s3Service');
const { removePhotoMetadata } = require('./photoMetadata');
const { areLaunchFeaturesEnabled } = require('../utils/featureFlags');
const logger = require('../utils/logger');

const CONTEXT = 'holiday_card_media';
const STORAGE_CONTRACT = 'holiday_card_media_v1';
const PREFIX = 'holiday-card-media/';
const MiB = 1024 * 1024;
const PHOTO = { max_bytes: 10 * MiB, long_side: 1600 };
const VOICE = { max_bytes: 5 * MiB, max_seconds: 60 };
const ALT_LIMIT = 200;
// A reference can be sent for 72 hours, only by its uploader; cleanup removes what no card took after seven days.
const DRAFT_MS = 72 * 60 * 60 * 1000;
const PHOTO_QUALITY = 80;
// A phone's 48-megapixel photo fits; anything larger is refused before it's decoded (a HEIC has its own cap).
const MAX_INPUT_PIXELS = 64 * 1024 * 1024;
// Voice ships with the founder's no-converter choice (contract section 3, November 3): AAC-LC in MP4, checked by
// services/cardVoice. Its controls follow the launch key like the photo's.
const VOICE_SHIPPED = true;

const FILE_SELECT = 'id, user_id, file_path, file_size, mime_type, file_context, is_deleted, created_at, metadata';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Photos (and voices) on cards can be added: `mailbox` and `holiday_card_memories`. */
const memoriesOn = () => areLaunchFeaturesEnabled(['mailbox', 'holiday_card_memories']);
const voiceOn = () => VOICE_SHIPPED && memoriesOn();

/** What GET /api/mailbox/cards says the controls can do now (contract section 4). */
function controls() {
  return {
    photo: { usable: memoriesOn(), max_bytes: PHOTO.max_bytes, long_side: PHOTO.long_side },
    voice: { usable: voiceOn(), max_seconds: VOICE.max_seconds, max_bytes: VOICE.max_bytes },
  };
}

const refusal = (status, code, error) => Object.assign(new Error(error), { status, code, refusal: true });

// ---- The photo ----

const PHOTO_UNREADABLE = 'We couldn’t read this photo. Try another one, or save it as a JPEG first.';
const photoUnreadable = () => refusal(415, 'CARD_PHOTO_UNREADABLE', PHOTO_UNREADABLE);
const photoNotStill = () => refusal(415, 'CARD_PHOTO_NOT_STILL', 'Choose a photo. Videos and moving pictures can’t go on a card.');
const photoTooLarge = () => refusal(413, 'CARD_PHOTO_TOO_LARGE', 'This photo is too large. Choose a smaller copy.');

// The brands an MP4 or QuickTime file names in its first box: a video sent as a photo is "not a still", not unreadable.
const STILL_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1', 'avif', 'avis']);
function looksLikeVideo(buffer, declared) {
  if (String(declared || '').startsWith('video/')) return true;
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 || buffer.toString('latin1', 4, 8) !== 'ftyp') return false;
  return !STILL_BRANDS.has(buffer.toString('latin1', 8, 12).trim());
}

// One photo is decoded at a time: a large one takes a few hundred MB while it's read.
let photoQueue = Promise.resolve();
function oneAtATime(work) {
  const run = photoQueue.then(work, work);
  photoQueue = run.catch(() => {});
  return run;
}

/**
 * The photo as a card keeps it, from what the bytes are (never what the upload says they are): { buffer, width, height },
 * a JPEG turned upright by its orientation, at most 1600 px on its long side, in sRGB and with no metadata. An iPhone's
 * HEIC is decoded on the server (photoMetadata, #3166). Throws the contract's refusals: unreadable, not a still (video
 * or animated), too large.
 */
async function cardPhoto(buffer, declared) {
  return oneAtATime(async () => {
    let info;
    try {
      info = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    } catch (error) {
      if (/pixel limit/i.test(error.message)) throw photoTooLarge();
      throw looksLikeVideo(buffer, declared) ? photoNotStill() : photoUnreadable();
    }
    if ((info.pages || 1) > 1) throw photoNotStill();
    let source = buffer;
    if (info.format === 'heif' && info.compression === 'hevc') {
      try {
        source = (await removePhotoMetadata(buffer)).buffer;
      } catch (error) {
        throw error.code === 'PHOTO_TOO_LARGE' ? photoTooLarge() : photoUnreadable();
      }
    }
    try {
      // No withMetadata: sharp writes no EXIF, GPS, XMP or colour profile and converts to sRGB. A transparent PNG lies on
      // white, as a print would.
      const { data, info: out } = await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(PHOTO.long_side, PHOTO.long_side, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: PHOTO_QUALITY, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      return { buffer: data, width: out.width, height: out.height };
    } catch (error) {
      if (/pixel limit/i.test(error.message)) throw photoTooLarge();
      throw photoUnreadable();
    }
  });
}

// ---- Storing an upload ----

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

/** An item as the apps read it (contract MediaRef): never a storage address. */
function mediaRef(file, alt = null) {
  const meta = file?.metadata || {};
  const base = { file_id: file.id, kind: meta.kind, mime_type: file.mime_type, size: Number(file.file_size) };
  if (meta.kind === 'voice') return { ...base, duration_ms: Number(meta.duration_ms) || 0 };
  return { ...base, width: Number(meta.width) || null, height: Number(meta.height) || null, alt: alt || null };
}

/** Until when an upload can be sent (ISO). */
const expiresAt = (file) => new Date(Date.parse(file.created_at) + DRAFT_MS).toISOString();

/**
 * Stores one prepared item privately for its uploader: the S3 object, then its File row. { file } or throws
 * CARD_MEDIA_UNAVAILABLE (503; nothing kept).
 */
async function storeUpload({ userId, kind, buffer, mimeType, facts }) {
  const id = crypto.randomUUID();
  const ext = kind === 'voice' ? 'm4a' : 'jpg';
  const key = `${PREFIX}${Date.now()}_${crypto.randomBytes(16).toString('hex')}.${ext}`;
  const digest = sha256(buffer);
  try {
    await s3.uploadToS3(buffer, key, mimeType, { 'pantopus-file-id': id, 'pantopus-sha256': digest },
      { contentLength: buffer.length });
  } catch (error) {
    logger.warn('Card media not stored', { fileId: id, error: error.message });
    throw refusal(503, 'CARD_MEDIA_UNAVAILABLE', 'Couldn’t add it just now. Try again in a moment.');
  }
  const row = {
    id,
    user_id: userId,
    filename: key.slice(PREFIX.length),
    // Never the name it had on the phone.
    original_filename: kind === 'voice' ? 'card-voice.m4a' : 'card-photo.jpg',
    file_path: key,
    file_url: `/api/mailbox/cards/media/${id}`,
    file_size: buffer.length,
    mime_type: mimeType,
    file_extension: ext,
    file_type: 'mailbox_attachment',
    visibility: 'private',
    file_context: CONTEXT,
    processing_status: 'completed',
    metadata: {
      storage_contract: STORAGE_CONTRACT, storage_bucket: S3_BUCKET, storage_namespace: S3_STORAGE_NAMESPACE,
      storage_key: key, kind, sha256: digest, ...facts,
    },
  };
  const { data, error } = await supabaseAdmin.from('File').insert(row).select(FILE_SELECT).single();
  if (error || !data) {
    await s3.deleteFromS3(key);
    logger.warn('Card media row not stored', { fileId: id, error: error?.message || null });
    throw refusal(503, 'CARD_MEDIA_UNAVAILABLE', 'Couldn’t add it just now. Try again in a moment.');
  }
  return { file: data };
}

// ---- Sending: checking and binding the references ----

/** A photo's description as kept: spaces folded, trimmed; '' for none. */
const cleanAlt = (raw) => (typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '');

/**
 * What a card's digest counts of its photo and voice, from the send itself (before any check): the ids and the photo's
 * description. Null for a card without them, so its digest is what it always was.
 */
function digestMedia({ photo = null, photo_alt: alt = null, voice = null } = {}) {
  if (!photo && !voice) return null;
  return { photo: photo ? [String(photo).toLowerCase(), cleanAlt(alt) || null] : null, voice: voice ? String(voice).toLowerCase() : null };
}

const mediaExpired = (what) => refusal(410, 'CARD_MEDIA_EXPIRED', `Add the ${what} again: this one can’t be sent any more.`);

/**
 * The references a send gives ({ photo, photo_alt, voice }), checked for this sender and this card (`rowId`, the card's
 * id from its request): their own uploads, of the right kind, within their 72 hours, not on another card, and within the
 * limits again. Answers { media: { photo, voice } | null, files } or throws a refusal ({ status, code }).
 */
async function checkRefs(senderId, { photo = null, photo_alt: rawAlt = null, voice = null } = {}, { rowId, now = new Date() }) {
  if (!photo && !voice) return { media: null, files: [] };
  if (!memoriesOn()) {
    throw refusal(403, 'CARD_MEDIA_OFF', 'Photos on cards aren’t open yet. Remove it to send your card.');
  }
  if (voice && !voiceOn()) {
    throw refusal(403, 'CARD_MEDIA_OFF', 'Voice greetings on cards aren’t open yet. Remove it to send your card.');
  }
  const alt = cleanAlt(rawAlt);
  if ([...alt].length > ALT_LIMIT) {
    throw refusal(400, 'CARD_PHOTO_ALT_TOO_LONG', `Keep the photo’s description to ${ALT_LIMIT} letters.`);
  }
  const wanted = [photo && { id: String(photo), kind: 'photo' }, voice && { id: String(voice), kind: 'voice' }].filter(Boolean);
  if (wanted.some((item) => !UUID.test(item.id))) throw mediaExpired(wanted.find((i) => !UUID.test(i.id)).kind);
  const { data, error } = await supabaseAdmin.from('File').select(FILE_SELECT).in('id', wanted.map((item) => item.id));
  if (error) throw new Error(error.message);
  const byId = new Map((data || []).map((file) => [String(file.id).toLowerCase(), file]));
  const files = [];
  for (const item of wanted) {
    const file = byId.get(item.id.toLowerCase());
    if (!file || file.is_deleted || file.file_context !== CONTEXT || file.metadata?.kind !== item.kind) throw mediaExpired(item.kind);
    if (String(file.user_id) !== String(senderId)) {
      throw refusal(403, 'CARD_MEDIA_NOT_YOURS', `This ${item.kind} was added by someone else. Add your own.`);
    }
    const boundTo = file.metadata?.mail_id || null;
    if (boundTo && boundTo !== rowId) throw mediaExpired(item.kind);
    if (!boundTo && Date.parse(file.created_at) + DRAFT_MS <= now.getTime()) throw mediaExpired(item.kind);
    // Checked again at send: what is stored is within the limits.
    const meta = file.metadata || {};
    const fits = item.kind === 'photo'
      ? Number(file.file_size) <= PHOTO.max_bytes && Math.max(Number(meta.width), Number(meta.height)) <= PHOTO.long_side
      : Number(file.file_size) <= VOICE.max_bytes && Number(meta.duration_ms) <= VOICE.max_seconds * 1000;
    if (!fits) throw mediaExpired(item.kind);
    files.push(file);
  }
  const fileOf = (kind) => files.find((file) => file.metadata.kind === kind) || null;
  return {
    media: {
      photo: fileOf('photo') ? mediaRef(fileOf('photo'), alt || null) : null,
      voice: fileOf('voice') ? mediaRef(fileOf('voice')) : null,
    },
    files,
  };
}

/**
 * Ties the checked files to the card `mailId` before the card is stored, so every media route can check the piece and
 * the file together. A file another card took meanwhile refuses the send (CARD_MEDIA_EXPIRED). Throws on a write failure.
 */
async function bind(mailId, files) {
  for (const file of files) {
    if (file.metadata?.mail_id === mailId) continue;
    const { data, error } = await supabaseAdmin.from('File')
      .update({ metadata: { ...file.metadata, mail_id: mailId }, updated_at: new Date().toISOString() })
      .eq('id', file.id).eq('is_deleted', false).is('metadata->>mail_id', null)
      .select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw mediaExpired(file.metadata?.kind || 'photo');
  }
}

/** Unties files from a card that was never stored (best effort): the draft can send them again. */
async function unbind(mailId, files) {
  for (const file of files) {
    try {
      const { data: card } = await supabaseAdmin.from('Mail').select('id').eq('id', mailId).maybeSingle();
      if (card) return;
      await supabaseAdmin.from('File')
        .update({ metadata: { ...file.metadata, mail_id: undefined }, updated_at: new Date().toISOString() })
        .eq('id', file.id).eq('metadata->>mail_id', mailId);
    } catch (error) {
      logger.warn('Card media not untied', { fileId: file.id, error: error.message });
    }
  }
}

// ---- Reading ----

/** A file of `mailId`'s card: its own row when it's tied to that card, else null. */
async function boundFile(fileId, mailId) {
  if (!UUID.test(String(fileId || ''))) return null;
  const { data, error } = await supabaseAdmin.from('File').select(FILE_SELECT).eq('id', fileId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.is_deleted || data.file_context !== CONTEXT || data.metadata?.mail_id !== String(mailId)) return null;
  return data;
}

/** An upload of this person's (for their own preview), else null. */
async function ownFile(fileId, userId) {
  if (!UUID.test(String(fileId || ''))) return null;
  const { data, error } = await supabaseAdmin.from('File').select(FILE_SELECT).eq('id', fileId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.is_deleted || data.file_context !== CONTEXT || String(data.user_id) !== String(userId)) return null;
  return data;
}

/**
 * Whether the photo on a card from `senderId` stays covered for `readerId` (contract section 10): yes unless the reader
 * is the sender or their connection now. Covered when it can't be told.
 */
async function photoCovered(readerId, senderId) {
  if (!readerId || !senderId) return true;
  if (String(readerId) === String(senderId)) return false;
  const { data, error } = await supabaseAdmin.from('Relationship').select('id').eq('status', 'accepted')
    .or(`and(requester_id.eq.${readerId},addressee_id.eq.${senderId}),and(requester_id.eq.${senderId},addressee_id.eq.${readerId})`)
    .limit(1);
  if (error) {
    logger.warn('Card photo cover not decided', { error: error.message });
    return true;
  }
  return !data?.length;
}

/**
 * Whether a block between the card's two people came before it was delivered (contract section 8's backstop): such a
 * piece is never readable, whatever the withdrawal at the block did. Throws when it can't be told (callers refuse).
 */
async function blockedBeforeDelivery(mail) {
  const a = mail?.sender_user_id;
  const b = mail?.recipient_user_id;
  if (!a || !b || !mail.delivered_at) return false;
  const { data, error } = await supabaseAdmin.from('UserBlock').select('id')
    .or(`and(blocker_user_id.eq.${a},blocked_user_id.eq.${b}),and(blocker_user_id.eq.${b},blocked_user_id.eq.${a})`)
    .lt('created_at', new Date(mail.delivered_at).toISOString())
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

// One HTTP byte range against the file's size (as the chat files route reads it): null for none or one not served.
function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(size) || size <= 0) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    return suffix > 0 ? { start: Math.max(0, size - suffix), end: size - 1 } : { unsatisfiable: true };
  }
  const start = Number(match[1]);
  if (match[2] && Number(match[2]) < start) return null;
  if (start >= size) return { unsatisfiable: true };
  return { start, end: match[2] ? Math.min(Number(match[2]), size - 1) : size - 1 };
}

const notFound = (res) => res.status(404).json({ error: 'This isn’t here any more.', code: 'CARD_MEDIA_NOT_FOUND' });

/** Answers a file's bytes from storage: private, no-store, a byte range for a voice. */
async function send(req, res, file) {
  res.set('Cache-Control', 'private, no-store');
  const size = Number(file.file_size);
  const range = file.metadata?.kind === 'voice' ? byteRange(req.headers.range, size) : null;
  if (range?.unsatisfiable) return res.status(416).set('Content-Range', `bytes */${size}`).end();
  let object;
  try {
    object = await s3.getObjectStream(file.file_path, undefined, range ? `bytes=${range.start}-${range.end}` : undefined);
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return notFound(res);
    throw error;
  }
  res.set({ 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff',
    ...(file.metadata?.kind === 'voice' ? { 'Accept-Ranges': 'bytes' } : {}) });
  res.type(file.mime_type);
  if (object.contentRange) res.status(206).set('Content-Range', object.contentRange);
  if (Number.isSafeInteger(object.contentLength)) res.set('Content-Length', String(object.contentLength));
  return pipeline(object.body, res).catch((error) => {
    logger.warn('Card media stream ended early', { fileId: file.id, interrupted: error.code === 'ERR_STREAM_PREMATURE_CLOSE' });
  });
}

// ---- Removing ----

/** Removes files: the object, then the row (a row whose object couldn't be removed is marked deleted for cleanup). */
async function removeFiles(files) {
  let removed = 0;
  for (const file of files) {
    const key = file.metadata?.storage_key;
    const gone = key === file.file_path && String(key || '').startsWith(PREFIX) ? await s3.deleteFromS3(key) : false;
    const write = gone
      ? supabaseAdmin.from('File').delete().eq('id', file.id)
      : supabaseAdmin.from('File').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', file.id);
    const { error } = await write;
    if (error) logger.warn('Card media row not removed', { fileId: file.id, error: error.message });
    else if (gone) removed += 1;
  }
  return removed;
}

/**
 * Removes the photo and voice of a card that was taken back or withdrawn (contract section 11: before delivery, taking
 * back removes its media). Best effort: whatever stays is marked for cleanup.
 */
async function removeForMail(mailId) {
  try {
    const { data, error } = await supabaseAdmin.from('File').select(FILE_SELECT)
      .eq('file_context', CONTEXT).eq('metadata->>mail_id', String(mailId));
    if (error) throw new Error(error.message);
    if (data?.length) await removeFiles(data);
  } catch (error) {
    logger.warn('Card media not removed', { mailId, error: error.message });
  }
}

/**
 * Removes the photo and voice of the cards a block between these two people withdrew (contract section 8; the block
 * itself withdraws them in the database, 20261103053000_pending_mail_personal_blocks). Best effort: what stays is
 * unreachable (a withdrawn card has no reader) and the nightly cleanup removes it. Answers how many files went.
 */
async function removeWithdrawnBetween(a, b) {
  try {
    const { data: cards, error } = await supabaseAdmin.from('Mail').select('id')
      .in('sender_user_id', [a, b]).eq('escrow_status', 'withdrawn')
      .eq('mail_extracted->card->withdrawn->>reason', 'blocked');
    if (error) throw new Error(error.message);
    const ids = (cards || []).map((card) => String(card.id));
    if (!ids.length) return 0;
    const { data: files, error: fileError } = await supabaseAdmin.from('File').select(FILE_SELECT)
      .eq('file_context', CONTEXT).in('metadata->>mail_id', ids);
    if (fileError) throw new Error(fileError.message);
    return files?.length ? removeFiles(files) : 0;
  } catch (error) {
    logger.warn('Card media of withdrawn cards not removed', { error: error.message });
    return 0;
  }
}

const CLEANUP_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH = 200;

/**
 * The nightly cleanup (contract section 11): after seven days, an upload no card took, or one whose card is gone or was
 * withdrawn (taken back, or by a block), goes; so does a stored object no File row names any more (an account's rows go
 * with it). A file on a card someone can still read is never removed, whatever its age; a row marked deleted (its
 * object couldn't be removed before) is tried again. Answers { removed, orphans }.
 */
async function cleanup(now = new Date()) {
  const before = new Date(now.getTime() - CLEANUP_GRACE_MS).toISOString();
  let removed = 0;
  let after = null;
  for (let round = 0; round < 25; round += 1) {
    let query = supabaseAdmin.from('File').select(FILE_SELECT).eq('file_context', CONTEXT).lt('created_at', before)
      .order('id').limit(CLEANUP_BATCH);
    if (after) query = query.gt('id', after);
    const { data: files, error } = await query;
    if (error) throw new Error(error.message);
    if (!files?.length) break;
    after = files[files.length - 1].id;
    const cardIds = [...new Set(files.map((f) => f.metadata?.mail_id).filter(Boolean))];
    const live = new Set();
    if (cardIds.length) {
      const { data: cards, error: cardError } = await supabaseAdmin.from('Mail').select('id, escrow_status').in('id', cardIds);
      if (cardError) throw new Error(cardError.message);
      for (const card of cards || []) if (card.escrow_status !== 'withdrawn') live.add(String(card.id));
    }
    const doomed = files.filter((f) => f.is_deleted || !f.metadata?.mail_id || !live.has(String(f.metadata.mail_id)));
    if (doomed.length) removed += await removeFiles(doomed);
    if (files.length < CLEANUP_BATCH) break;
  }
  // Rows marked deleted more recently (an object a take-back couldn't remove) are tried again too.
  const { data: marked, error: markedError } = await supabaseAdmin.from('File').select(FILE_SELECT)
    .eq('file_context', CONTEXT).eq('is_deleted', true).gte('created_at', before).limit(CLEANUP_BATCH);
  if (markedError) throw new Error(markedError.message);
  if (marked?.length) removed += await removeFiles(marked);

  // Objects no row names (written before the grace period): an upload that stopped between storing and saving, or an
  // account deleted with its rows.
  let orphans = 0;
  const keys = await s3.listKeysWrittenBefore(PREFIX, Date.parse(before), 1000);
  for (let i = 0; i < keys.length; i += 100) {
    const page = keys.slice(i, i + 100).filter((key) => key.startsWith(PREFIX) && !key.includes('..'));
    if (!page.length) continue;
    const { data: named, error: namedError } = await supabaseAdmin.from('File').select('file_path').in('file_path', page);
    if (namedError) throw new Error(namedError.message);
    const known = new Set((named || []).map((row) => row.file_path));
    for (const key of page.filter((k) => !known.has(k))) if (await s3.deleteFromS3(key)) orphans += 1;
  }
  return { removed, orphans };
}

module.exports = {
  CONTEXT, STORAGE_CONTRACT, PREFIX, PHOTO, VOICE, ALT_LIMIT, DRAFT_MS,
  memoriesOn, voiceOn, controls, cardPhoto, looksLikeVideo, storeUpload, mediaRef, expiresAt,
  checkRefs, cleanAlt, digestMedia, bind, unbind, boundFile, ownFile, photoCovered, blockedBeforeDelivery, send,
  removeFiles, removeForMail, removeWithdrawnBetween, cleanup, notFound, photoTooLarge,
};
