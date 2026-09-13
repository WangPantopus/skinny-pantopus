const crypto = require('crypto');
const db = require('../config/supabaseAdmin');

const MAX_BYTES = 25 * 1024 * 1024;
const MIME_TYPES = new Set(['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function failure(code, message, status = 503) { return Object.assign(new Error(message), { code, status, statusCode: status }); }
function key({ home_id: homeId, claim_id: claimId, upload_id: uploadId, sha256 }) {
  if (![homeId, claimId, uploadId].every(id => typeof id === 'string' && UUID.test(id)) || !/^[0-9a-f]{64}$/.test(sha256 || '')) {
    throw failure('HOME_CLAIM_EVIDENCE_INVALID', 'Invalid evidence file reference.', 400);
  }
  return `claim-evidence/${homeId.toLowerCase()}/${claimId.toLowerCase()}/${uploadId.toLowerCase()}/${sha256}`;
}
function inspect(file) {
  const bytes = file?.buffer;
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BYTES) throw failure('HOME_CLAIM_EVIDENCE_SIZE', 'Choose a nonempty file of 25 MB or less.', 413);
  if (!MIME_TYPES.has(file.mimetype)) throw failure('HOME_CLAIM_EVIDENCE_TYPE', 'Choose a PDF, text file, or supported image.', 415);
  // Content is delivered as a download with nosniff, never an inline/public URL.
  const mime = file.mimetype;
  const matches = mime === 'text/plain' ? !bytes.includes(0)
    : mime === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-'
      : mime === 'image/jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
        : mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : mime === 'image/webp' ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
            : bytes.subarray(4, 8).toString() === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(bytes.subarray(8, 12).toString());
  if (!matches) throw failure('HOME_CLAIM_EVIDENCE_TYPE', 'The file content does not match its type.', 415);
  const name = typeof file.originalname === 'string' ? file.originalname.normalize('NFC').replace(/[\x00-\x1f\x7f/\\]/g, '_').trim() : '';
  if (!name || name.length > 255) throw failure('HOME_CLAIM_EVIDENCE_INVALID', 'Choose a file with a name of 255 characters or less.', 400);
  return { sha256: crypto.createHash('sha256').update(bytes).digest('hex'), file_name: name, mime_type: mime, file_size: bytes.length };
}
async function privateBucket(expected) {
  const name = (process.env.HOME_DOCUMENTS_BUCKET || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(name) || (expected !== undefined && expected !== name)) {
    throw failure('HOME_CLAIM_EVIDENCE_STORAGE_UNAVAILABLE', 'Private evidence file storage is unavailable. Please retry.');
  }
  let result;
  try { result = await db.storage.getBucket(name); } catch (_) { throw failure('HOME_CLAIM_EVIDENCE_STORAGE_UNAVAILABLE', 'Private evidence file storage is unavailable. Please retry.'); }
  if (result?.error || result?.data?.public !== false) throw failure('HOME_CLAIM_EVIDENCE_STORAGE_UNAVAILABLE', 'Private evidence file storage is unavailable. Please retry.');
  return { name, bucket: db.storage.from(name) };
}
async function prepare(identity) { key(identity); return { bucket: (await privateBucket()).name }; }
async function readBytes(bucket, ref) {
  const result = await bucket.download(key(ref));
  if (result?.error || !result?.data || result.data.size !== ref.size || result.data.size > MAX_BYTES) {
    throw failure('HOME_CLAIM_EVIDENCE_DOWNLOAD_UNAVAILABLE', 'Could not verify this evidence file. Please retry.');
  }
  const bytes = Buffer.from(await result.data.arrayBuffer());
  if (bytes.length !== ref.size || crypto.createHash('sha256').update(bytes).digest('hex') !== ref.sha256) {
    throw failure('HOME_CLAIM_EVIDENCE_INTEGRITY', 'Could not verify this evidence file. Please retry.');
  }
  return bytes;
}
async function upload(ref, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== ref.size || bytes.length > MAX_BYTES
    || crypto.createHash('sha256').update(bytes).digest('hex') !== ref.sha256 || !MIME_TYPES.has(ref.mime_type)) {
    throw failure('HOME_CLAIM_EVIDENCE_INVALID', 'Evidence bytes do not match the saved upload.', 400);
  }
  const { bucket } = await privateBucket(ref.bucket);
  try {
    const result = await bucket.upload(key(ref), bytes, { contentType: ref.mime_type, cacheControl: '0', upsert: false });
    if (!result || result.error) throw new Error('Provider upload not confirmed');
  } catch (_) {
    // A lost reply may have stored the immutable bytes. Never overwrite a key.
    try { await readBytes(bucket, ref); } catch (_) { throw failure('HOME_CLAIM_EVIDENCE_UPLOAD_UNAVAILABLE', 'The claim is unchanged. This document upload was not confirmed; retry the file.'); }
  }
}
async function download(ref) { return readBytes((await privateBucket(ref.bucket)).bucket, ref); }
async function remove(ref) {
  const { bucket } = await privateBucket(ref.bucket);
  const result = await bucket.remove([key(ref)]);
  if (!result || result.error) throw failure('HOME_CLAIM_EVIDENCE_DELETE_UNAVAILABLE', 'The evidence file is hidden, but storage cleanup is pending. Retry removal.');
}
module.exports = { MAX_BYTES, MIME_TYPES, UUID, key, inspect, prepare, upload, download, remove, failure };
