/**
 * Redaction for log metadata.
 *
 * PRV-09: verification codes and street addresses were reaching combined.log,
 * a 50MB on-disk file with no redaction. A verification code is a bearer
 * credential for an address, and an address is the most safety-sensitive field
 * the product holds.
 *
 * Kept separate from utils/logger so it can be tested directly — the logger
 * itself is replaced by a stub in the test environment.
 */

/** Keys whose values must never reach a log line. Matched case-insensitively, at any depth. */
const REDACTED_KEYS = new Set([
  'code',
  'codehash',
  'code_hash',
  'verificationcode',
  'verification_code',
  'postcardcode',
  'postcard_code',
  'lettercode',
  'letter_code',
  'address',
  'addressline1',
  'address_line1',
  'addressline2',
  'address_line2',
  'street',
  'line1',
  'line2',
  'token',
  'password',
  'secret',
  'apikey',
  'api_key',
  'authorization',
]);

const REDACTION = '[redacted]';
const MAX_DEPTH = 8;

/**
 * Depth- and cycle-safe redaction of a log metadata object.
 * Coarse, non-identifying fields (city, state) are deliberately kept: they are
 * what makes a log line useful for debugging without naming anyone's home.
 */
function redactLogMeta(value, seen = new WeakSet(), depth = 0) {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((v) => redactLogMeta(v, seen, depth + 1));

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = REDACTED_KEYS.has(key.toLowerCase())
      ? REDACTION
      : redactLogMeta(val, seen, depth + 1);
  }
  return out;
}

module.exports = { redactLogMeta, REDACTED_KEYS };
