// A letter's mail.json (POST /api/mailbox/send) is stored in the private Home documents bucket under mail-objects/,
// keyed by its MailObject id and content hash: never by who sent it, and never at a public URL. The API reads it for
// the people who may open the letter, and clients never see where it is stored (clientFields). Older letters sit in
// the public uploads bucket under mailbox-objects/ (storage_provider 's3') and are still read from there.
const crypto = require('crypto');
const { Parser } = require('htmlparser2');
const db = require('../config/supabaseAdmin');
const s3 = require('./s3Service');

const PROVIDER = 'supabase-storage';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(message) { return Object.assign(new Error(message), { status: 503, statusCode: 503 }); }

function objectKey(id, sha256) {
  if (typeof id !== 'string' || !UUID.test(id) || typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) {
    throw failure('Invalid letter storage reference.');
  }
  return `mail-objects/${id.toLowerCase()}/${sha256}`;
}

// A public bucket would serve every letter to anyone with its address.
async function privateBucket() {
  const name = (process.env.HOME_DOCUMENTS_BUCKET || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(name)) throw failure('Private letter storage is not configured.');
  let result;
  try { result = await db.storage.getBucket(name); } catch (_) { result = null; }
  if (!result || result.error || result.data?.public !== false) throw failure('Private letter storage is unavailable.');
  return name;
}

// Stores the letter for MailObject `id` and returns the row's storage columns.
async function store(id, buffer, sha256) {
  const key = objectKey(id, sha256);
  const bucket = await privateBucket();
  let result;
  try {
    result = await db.storage.from(bucket).upload(key, buffer,
      { contentType: 'application/json', cacheControl: '0', upsert: false });
  } catch (_) { result = null; }
  if (!result || result.error) throw failure('The letter could not be stored.');
  return { storage_provider: PROVIDER, bucket_name: bucket, object_key: key };
}

// Best effort, for a letter whose MailObject row was never saved.
async function remove(stored) {
  try { await db.storage.from(stored.bucket_name).remove([stored.object_key]); } catch (_) { /* private; nothing links to it */ }
}

// The stored letter's text. A private object must be the one its row names, byte for byte.
async function readText(row) {
  if (row.storage_provider !== PROVIDER) return s3.getObjectAsString(row.object_key, row.bucket_name || undefined);
  if (row.object_key !== objectKey(row.id, row.sha256)) throw failure('Letter storage could not be verified.');
  const { data, error } = await db.storage.from(row.bucket_name).download(row.object_key);
  if (error || !data) throw failure('The letter could not be read.');
  const bytes = Buffer.from(await data.arrayBuffer());
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== row.sha256) {
    throw failure('Letter storage could not be verified.');
  }
  return bytes.toString('utf8');
}

// What a client may see of a MailObject row: not where it is stored, nor its hash (an older letter sent as a business
// stored the staff member's id in its copy, so the hash would confirm a guess).
function clientFields(row) {
  if (!row || typeof row !== 'object') return row;
  const { id, created_by_user_id, format, mime_type, size_bytes, status, created_at, uploaded_at } = row;
  return { id, created_by_user_id, format, mime_type, size_bytes, status, created_at, uploaded_at };
}

// A stored letter is the source of its body; Mail.content is only a preview.
// Fail visibly when storage cannot be read instead of presenting that preview as the whole letter.
async function readPayload(objectId) {
  const { data: row, error } = await db.from('MailObject').select('*').eq('id', objectId).single();
  if (error || !row?.object_key) throw failure('The letter could not be read.');
  const text = await readText(row);
  let payload;
  try { payload = JSON.parse(text); } catch (_) { payload = { body: { content: text } }; }
  return { metadata: clientFields(row), payload };
}

async function hydrateMail(mail) {
  if (!mail) return mail;
  if (!mail.object_id) return { ...mail, content_text: textContent(mail.content, mail.content_format) };
  const { metadata, payload } = await readPayload(mail.object_id);
  const content = payload?.body?.content ?? payload?.content;
  const attachments = payload?.envelope?.attachments ?? payload?.attachments;
  const format = [payload?.body?.payload?.bodyFormat, payload?.objectFormat, metadata?.format]
    .find((value) => ['plain_text', 'markdown', 'html'].includes(value)) || 'plain_text';
  return { ...mail, object: metadata, object_payload: payload, content_format: format,
    ...(typeof content === 'string' ? { content } : {}),
    content_text: textContent(typeof content === 'string' ? content : mail.content, format),
    ...(!mail.attachments?.length && Array.isArray(attachments) ? { attachments } : {}) };
}

// The native paper reader displays text, never a web page. Decode HTML without loading images, links or scripts.
function textContent(content, format) {
  if (typeof content !== 'string' || format !== 'html') return content;
  const blocks = new Set(['p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'tr']);
  const hidden = new Set(['script', 'style', 'head']);
  let text = ''; let hiddenDepth = 0;
  const parser = new Parser({
    onopentag(name) {
      if (hidden.has(name)) hiddenDepth += 1;
      if (!hiddenDepth && (name === 'br' || blocks.has(name))) text += '\n';
    },
    ontext(value) { if (!hiddenDepth) text += value; },
    onclosetag(name) {
      if (hidden.has(name)) hiddenDepth = Math.max(0, hiddenDepth - 1);
      if (!hiddenDepth && blocks.has(name)) text += '\n\n';
    },
  }, { decodeEntities: true });
  parser.end(content);
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { PROVIDER, store, remove, readText, clientFields, readPayload, hydrateMail, textContent };
