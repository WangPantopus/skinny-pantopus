const crypto = require('crypto');
const db = require('../config/supabaseAdmin');
const storage = require('./homeDocumentStorage');

const MESSAGES = {
  HOME_NOT_FOUND: 'Home not found.',
  SHARE_INVALID: 'Check the share details and try again. Share links allow viewing only.',
  SHARE_NOT_FOUND: 'Share link not found.',
  SHARE_DENIED: 'This share link is no longer available to you.',
  SHARE_RESOURCE_DENIED: 'The shared content is no longer available.',
  SHARE_REVOKED: 'This share link has been revoked.',
  SHARE_REISSUE_REQUIRED: 'This older share link is inactive. Ask the sender for a new link.',
  SHARE_EXPIRED: 'This share link has expired.',
  SHARE_NOT_STARTED: 'This share link is not active yet.',
  SHARE_VIEW_LIMIT: 'This share link has reached its view limit.',
  SHARE_PASSCODE_REQUIRED: 'Enter the correct passcode to view this share link.',
};
function failure(code = 'SHARE_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not load the share link. Please retry.'), {
    code, status, statusCode: status, requiresPasscode: code === 'SHARE_PASSCODE_REQUIRED',
  });
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('hex');
const validToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);

async function rpc(name, args) {
  let response;
  try { response = await db.rpc(name, args); } catch { throw failure(); }
  if (!response || response.error || !response.data) {
    if (response?.error?.code?.startsWith('22')) throw failure('SHARE_INVALID', 400);
    throw failure();
  }
  const result = response.data;
  if (result.ok !== true) {
    if (result.ok !== false || !Object.hasOwn(MESSAGES, result.code)) throw failure();
    throw failure(result.code, [400, 403, 404, 409, 410].includes(result.status) ? result.status : 503);
  }
  return result;
}
function safeRecord(record) {
  if (!record || typeof record.id !== 'string') throw failure();
  const { token_hash, passcode_hash, resource_bindings, ...safe } = record;
  return safe;
}
function passcodeHash(passcode) {
  if (passcode === undefined || passcode === null || passcode === '') return null;
  if (typeof passcode !== 'string' || passcode.length > 128) throw failure('SHARE_INVALID', 400);
  return hash(passcode);
}
async function mutate({ homeId, actorId, kind, action, shareId = null, payload = {} }) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw failure('SHARE_INVALID', 400);
  const token = action === 'create' ? randomToken() : null;
  const { passcode, token_hash, passcode_hash, ...details } = payload;
  const result = await rpc('mutate_home_external_share', {
    p_home_id: homeId, p_actor_id: actorId, p_kind: kind, p_action: action, p_share_id: shareId,
    p_payload: action === 'create' ? { ...details, token_hash: hash(token), passcode_hash: passcodeHash(passcode) } : details,
  });
  if (action === 'list') {
    if (!Array.isArray(result.records)) throw failure();
    return { records: result.records.map(safeRecord) };
  }
  return { record: safeRecord(result.record), ...(token ? { token } : {}) };
}
function documentView(document, receipt) {
  if (!document || typeof document !== 'object') throw failure();
  const { _document, storage_bucket, storage_path, ...safe } = document;
  if (_document) {
    if (typeof safe.id !== 'string' || _document.document_id !== safe.id) throw failure();
    safe.url = `/api/homes/shared-documents/${receipt}/${encodeURIComponent(safe.id)}`;
  }
  return safe;
}
async function read({ kind, token, recipientId = null, passcode }) {
  if (!validToken(token)) throw failure('SHARE_INVALID', 400);
  const receipt = randomToken();
  const result = await rpc('read_home_external_share', {
    p_kind: kind, p_token_hash: hash(token), p_recipient_id: recipientId,
    p_passcode_hash: passcodeHash(passcode), p_receipt_hash: hash(receipt),
  });
  const view = result.view;
  if (!view || typeof view !== 'object') throw failure();
  if (kind === 'guest') {
    if (!view.pass || !view.sections) throw failure();
    return { pass: view.pass, sections: { ...view.sections,
      ...(view.sections.docs ? { docs: view.sections.docs.map(document => documentView(document, receipt)) } : {}),
    } };
  }
  if (!view.grant || !view.resource) throw failure();
  return { grant: view.grant, resource: documentView(view.resource, receipt) };
}
async function download({ receipt, documentId, recipientId = null }) {
  if (!validToken(receipt) || !/^[a-f0-9-]{36}$/i.test(documentId || '')) throw failure('SHARE_INVALID', 400);
  const args = { p_receipt_hash: hash(receipt), p_document_id: documentId, p_recipient_id: recipientId };
  const first = (await rpc('authorize_home_share_document', args)).document;
  const ref = first?._document;
  if (!ref || ref.document_id !== documentId || !ref.key_id || !ref.sha256 || !ref.bucket_name) throw failure();
  let bytes;
  try {
    bytes = await storage.download({ homeId: ref.home_id, documentId: ref.key_id, sha256: ref.sha256, bucketName: ref.bucket_name });
  } catch { throw failure(); }
  const current = (await rpc('authorize_home_share_document', { ...args, p_consume: true })).document;
  if (!current || JSON.stringify(current) !== JSON.stringify(first)) throw failure('SHARE_RESOURCE_DENIED', 403);
  return { bytes, mimeType: first.mime_type, title: first.title };
}
module.exports = { mutate, read, download };
