const crypto = require('crypto');

// Fields that change on every read while the content stays the same: when the payload or a section was built, how
// long a copy stays good, and how long the build took. They stay in the body and are left out of its ETag, so an
// unchanged Today or Place answers 304 (Instant Screens contract §8; the apps show when they revalidated, not these
// timestamps).
const VOLATILE_KEYS = new Set(['fetched_at', 'expires_at', 'generated_at', 'as_of', 'total_latency_ms']);

/**
 * A weak ETag, in Express's format, over a JSON payload without its volatile fields. Set it before `res.json`:
 * Express keeps an ETag a route has set and still answers 304 to a matching If-None-Match.
 */
function stableEtag(payload) {
  const json = JSON.stringify(payload, (key, value) => (VOLATILE_KEYS.has(key) ? undefined : value)) || '';
  const hash = crypto.createHash('sha1').update(json, 'utf8').digest('base64').slice(0, 27);
  return `W/"${Buffer.byteLength(json, 'utf8').toString(16)}-${hash}"`;
}

module.exports = { stableEtag, VOLATILE_KEYS };
