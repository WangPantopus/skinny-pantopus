// A letter's mail.json (POST /api/mailbox/send) is stored in the private Home documents bucket under mail-objects/,
// keyed by its MailObject id and content hash: never by who sent it, and never at a public URL. The API reads it for
// the people who may open the letter, and clients never see where it is stored (clientFields). Older letters sit in
// the public uploads bucket under mailbox-objects/ (storage_provider 's3') and are still read from there.
const crypto = require('crypto');
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

module.exports = { PROVIDER, store, remove, readText, clientFields };
