// Business verification documents (business license, EIN letter, utility bill) are stored in the
// private Home documents bucket under business-verification/, with their own storage contract. The
// Home recovery jobs select File rows by contract and never list the bucket, so they leave these
// alone. Nothing here hands out a public URL: admins review a document through a short-lived link.
const crypto = require('crypto');
const path = require('path');
const db = require('../config/supabaseAdmin');

const STORAGE_CONTRACT = 'business_verification_v1';
const PREFIX = 'business-verification/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(message, status = 503) { return Object.assign(new Error(message), { status, statusCode: status }); }

async function privateBucket(expected) {
  const name = (process.env.HOME_DOCUMENTS_BUCKET || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(name) || (expected !== undefined && expected !== name)) {
    throw failure('Private document storage is unavailable. Please retry.');
  }
  let result;
  try { result = await db.storage.getBucket(name); } catch (_) { throw failure('Private document storage is unavailable. Please retry.'); }
  if (result?.error || result?.data?.public !== false) throw failure('Private document storage is unavailable. Please retry.');
  return name;
}

// Stores the bytes under a new key and returns what the File row records about them.
async function store(userId, file) {
  if (typeof userId !== 'string' || !UUID.test(userId) || !Buffer.isBuffer(file?.buffer) || !file.buffer.length) {
    throw failure('Invalid verification document.', 400);
  }
  const bucket = await privateBucket();
  const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
  const key = `${PREFIX}${userId.toLowerCase()}/${crypto.randomUUID()}${ext}`;
  let result;
  try {
    result = await db.storage.from(bucket).upload(key, file.buffer, { contentType: file.mimetype, cacheControl: '0', upsert: false });
  } catch (_) { result = null; }
  if (!result || result.error) throw failure('Failed to upload file. Please retry.');
  return { url: '', key, metadata: { storage_contract: STORAGE_CONTRACT, storage_bucket: bucket } };
}

function isStored(file) {
  return file?.metadata?.storage_contract === STORAGE_CONTRACT
    && typeof file.file_path === 'string' && file.file_path.startsWith(PREFIX) && !file.file_path.includes('..');
}

// A link that opens the document for `seconds`, for the admin review queue.
async function signedUrl(file, seconds) {
  if (!isStored(file)) throw failure('Not a stored verification document.', 400);
  const bucket = await privateBucket(file.metadata.storage_bucket);
  const { data, error } = await db.storage.from(bucket).createSignedUrl(file.file_path, seconds);
  if (error || !data?.signedUrl) throw failure('Could not open this document. Please retry.');
  return data.signedUrl;
}

// Best effort, for bytes whose File row was never saved.
async function remove(bucket, key) {
  try {
    if (typeof key !== 'string' || !key.startsWith(PREFIX)) return;
    await db.storage.from(await privateBucket(bucket)).remove([key]);
  } catch (_) { /* the object stays private; nothing links to it */ }
}

module.exports = { STORAGE_CONTRACT, store, isStored, signedUrl, remove };
