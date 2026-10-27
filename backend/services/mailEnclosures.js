/**
 * Enclosures (Mail tab, SRV-4): the pages and photos a piece carries.
 *
 * New enclosures are private. Their bytes sit in the private Home documents bucket under
 * mail-enclosures/<enclosure id>/<sha256>, keyed by neither sender nor recipient; the piece lists them in
 * mail_extracted.enclosures; and they open only through GET /api/mailbox/:id/enclosures/:enclosure_id, which hands a
 * short-lived signed link to someone who may read the piece. POST /api/upload/mail-attachments answers a signed
 * reference (`enclosure:<token>`, bound to the person who uploaded it) instead of a public address, and the send route
 * turns the sender's own references into the piece's enclosures.
 *
 * Older pieces carry public addresses (Mail.attachments, or the attachments of the letter's own mail.json). Those stay
 * readable for older app builds and are listed as enclosures too, opened by their address.
 */
const crypto = require('crypto');
const path = require('path');
const db = require('../config/supabaseAdmin');

const LINK_SECONDS = 300;
const REF_PREFIX = 'enclosure:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
// The same server secret the location jitter falls back to; the label keeps these signatures apart from any other use.
const SECRET = process.env.MAIL_ENCLOSURE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MIME_BY_EXT = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif', '.txt': 'text/plain',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

function failure(message, status = 503) { return Object.assign(new Error(message), { status, statusCode: status }); }

// A public bucket would serve every enclosure to anyone with its address.
async function privateBucket() {
  const name = (process.env.HOME_DOCUMENTS_BUCKET || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(name)) throw failure('Private mail storage is not configured.');
  let result;
  try { result = await db.storage.getBucket(name); } catch (_) { result = null; }
  if (!result || result.error || result.data?.public !== false) throw failure('Private mail storage is unavailable.');
  return name;
}

const objectKey = (id, sha256) => `mail-enclosures/${id.toLowerCase()}/${sha256}`;
const sign = (payload) => crypto.createHmac('sha256', SECRET).update(`pantopus:mail-enclosure:v1:${payload}`).digest('base64url');

function cleanName(name) {
  const base = path.basename(String(name || 'Enclosure')).replace(/[\u0000-\u001f]/g, '').trim();
  return (base || 'Enclosure').slice(0, 120);
}

/**
 * Keep one uploaded file privately. Answers what the client sees: the reference to send with the letter, and the
 * file's name, type and size.
 */
async function store({ buffer, name, mimeType, uploaderId }) {
  if (!SECRET) throw failure('Private mail storage is not configured.');
  const id = crypto.randomUUID();
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const bucket = await privateBucket();
  let result;
  try {
    result = await db.storage.from(bucket).upload(objectKey(id, sha256), buffer,
      { contentType: mimeType || 'application/octet-stream', cacheControl: '0', upsert: false });
  } catch (_) { result = null; }
  if (!result || result.error) throw failure('The file could not be stored.');
  const meta = { id, sha256, name: cleanName(name), mime_type: mimeType || 'application/octet-stream', size_bytes: buffer.length };
  const payload = Buffer.from(JSON.stringify({ ...meta, u: uploaderId })).toString('base64url');
  return { ref: `${REF_PREFIX}${payload}.${sign(payload)}`, id, name: meta.name, mime_type: meta.mime_type, size_bytes: meta.size_bytes };
}

/**
 * Keep a file the server itself encloses (a Pantopus letter's PDF). Answers the enclosure as the piece stores it in
 * mail_extracted.enclosures: { id, sha256, name, mime_type, size_bytes }.
 */
async function keep({ buffer, name, mimeType }) {
  const id = crypto.randomUUID();
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const bucket = await privateBucket();
  let result;
  try {
    result = await db.storage.from(bucket).upload(objectKey(id, sha256), buffer,
      { contentType: mimeType || 'application/octet-stream', cacheControl: '0', upsert: false });
  } catch (_) { result = null; }
  if (!result || result.error) throw failure('The file could not be stored.');
  return { id, sha256, name: cleanName(name), mime_type: mimeType || 'application/octet-stream', size_bytes: buffer.length };
}

/** The enclosure a reference names, if it is well formed, signed by this server and uploaded by `senderId`. */
function readRef(ref, senderId) {
  if (!SECRET || typeof ref !== 'string' || !ref.startsWith(REF_PREFIX)) return null;
  const [payload, signature, extra] = ref.slice(REF_PREFIX.length).split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  let meta;
  try { meta = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch (_) { return null; }
  if (!meta || meta.u !== senderId || !UUID.test(meta.id) || !SHA256.test(meta.sha256)) return null;
  return { id: meta.id.toLowerCase(), sha256: meta.sha256, name: cleanName(meta.name),
    mime_type: String(meta.mime_type || 'application/octet-stream').slice(0, 120), size_bytes: Number(meta.size_bytes) || null };
}

/**
 * A letter's attachments as the send route receives them: public addresses (older clients) and private references.
 * Answers { urls, enclosures, refused }: refused holds references that aren't this sender's own uploads.
 */
function fromAttachments(list, senderId) {
  const urls = []; const enclosures = []; const refused = [];
  for (const item of Array.isArray(list) ? list : []) {
    if (typeof item === 'string' && item.startsWith(REF_PREFIX)) {
      const enclosure = readRef(item, senderId);
      if (enclosure) { if (!enclosures.some((e) => e.id === enclosure.id)) enclosures.push(enclosure); } else refused.push(item);
    } else if (typeof item === 'string') urls.push(item);
  }
  return { urls, enclosures, refused };
}

// An older piece's public address, as an enclosure: a stable id from the address, a name from its path.
function legacyEnclosure(url) {
  let name = 'Enclosure';
  try { name = decodeURIComponent(path.basename(new URL(url).pathname)) || name; } catch (_) { /* keep the default */ }
  const ext = path.extname(name).toLowerCase();
  return { id: `a${crypto.createHash('sha256').update(url).digest('hex').slice(0, 24)}`, name: cleanName(name),
    mime_type: MIME_BY_EXT[ext] || 'application/octet-stream', size_bytes: null, url };
}

function legacyUrls(mail, objectAttachments) {
  const own = Array.isArray(mail?.attachments) ? mail.attachments : [];
  const fromLetter = Array.isArray(objectAttachments) ? objectAttachments : [];
  const urls = [...own, ...fromLetter].map((a) => (typeof a === 'string' ? a : a?.url))
    .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u));
  return [...new Set(urls)];
}

/** Every enclosure a piece carries, as the apps read them: [{ id, name, mime_type, size_bytes }]. */
function listFor(mail, objectAttachments) {
  const stored = Array.isArray(mail?.mail_extracted?.enclosures) ? mail.mail_extracted.enclosures : [];
  const own = stored.filter((e) => e && UUID.test(e.id) && SHA256.test(e.sha256))
    .map((e) => ({ id: e.id, name: cleanName(e.name), mime_type: e.mime_type || 'application/octet-stream', size_bytes: e.size_bytes ?? null }));
  const legacy = legacyUrls(mail, objectAttachments).map(legacyEnclosure)
    .map(({ id, name, mime_type, size_bytes }) => ({ id, name, mime_type, size_bytes }));
  return [...own, ...legacy];
}

/**
 * A link to open one enclosure of a piece the caller may read (the caller checks that): a signed link for a private
 * one, good for LINK_SECONDS; an older piece's address as it is. Answers { url, expires_at } or null (no such
 * enclosure). Throws when private storage can't sign a link.
 */
async function linkFor(mail, enclosureId, objectAttachments) {
  const id = String(enclosureId || '').toLowerCase();
  const stored = (Array.isArray(mail?.mail_extracted?.enclosures) ? mail.mail_extracted.enclosures : [])
    .find((e) => e && String(e.id).toLowerCase() === id && UUID.test(e.id) && SHA256.test(e.sha256));
  if (stored) {
    const bucket = await privateBucket();
    const { data, error } = await db.storage.from(bucket).createSignedUrl(objectKey(stored.id, stored.sha256), LINK_SECONDS);
    if (error || !data?.signedUrl) throw failure('The file could not be opened.');
    return { url: data.signedUrl, expires_at: new Date(Date.now() + LINK_SECONDS * 1000).toISOString() };
  }
  const legacy = legacyUrls(mail, objectAttachments).map(legacyEnclosure).find((e) => e.id === id);
  return legacy ? { url: legacy.url, expires_at: null } : null;
}

module.exports = { LINK_SECONDS, REF_PREFIX, store, keep, readRef, fromAttachments, listFor, linkFor };
