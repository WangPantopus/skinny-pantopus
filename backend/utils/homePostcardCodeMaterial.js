const crypto = require('node:crypto');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const KEY_ID = /^[a-zA-Z0-9_-]{1,40}$/;
function unavailable() {
  return Object.assign(new Error('Mail verification is unavailable right now. Please retry later.'), {
    code: 'POSTCARD_CODE_KEY_UNAVAILABLE', statusCode: 503,
  });
}
function keyring() {
  let value;
  try { value = JSON.parse(process.env.HOME_POSTCARD_CODE_KEYS_JSON || ''); } catch (_) { throw unavailable(); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw unavailable();
  const entries = Object.entries(value);
  if (!entries.length || entries.length > 8) throw unavailable();
  const keys = new Map();
  for (const [id, material] of entries) {
    if (!KEY_ID.test(id) || typeof material !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(material)) throw unavailable();
    const bytes = Buffer.from(material, 'base64');
    if (bytes.length !== 32 || bytes.toString('base64') !== material) throw unavailable();
    keys.set(id, bytes);
  }
  return keys;
}
function activeKeyId() {
  const id = process.env.HOME_POSTCARD_CODE_ACTIVE_KEY;
  if (typeof id !== 'string' || !KEY_ID.test(id) || !keyring().has(id)) throw unavailable();
  return id;
}

/**
 * Stable per-card code material lets a new process recover an admitted request
 * before dispatch. No plaintext code or encryption payload is stored in SQL.
 * Keep old versioned keys until their pending cards no longer need dispatch.
 * This never authorizes resending a card whose dispatch outcome is uncertain.
 */
function deriveCode({ actorId, homeId, postcardId, keyId }) {
  if (![actorId, homeId, postcardId].every(value => typeof value === 'string' && UUID.test(value))) throw unavailable();
  const key = keyring().get(keyId);
  if (!key) throw unavailable();
  const scope = ['pantopus/home-postcard/v1', actorId.toLowerCase(), homeId.toLowerCase(), postcardId.toLowerCase()].join('\0');
  const range = 900000;
  const ceiling = 0x100000000 - (0x100000000 % range);
  // Rejection sampling avoids modulo bias in the six-digit code space.
  for (let counter = 0; counter < 100; counter++) {
    const number = crypto.createHmac('sha256', key).update(scope + '\0' + counter).digest().readUInt32BE(0);
    if (number < ceiling) return String(100000 + (number % range));
  }
  throw unavailable();
}
module.exports = { activeKeyId, deriveCode };
