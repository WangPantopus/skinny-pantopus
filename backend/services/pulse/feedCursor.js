'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/;
const MAX_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
function timestamp(value) {
  return typeof value === 'string' && ISO.test(value) && Number.isFinite(Date.parse(value));
}
function invalid() {
  return Object.assign(new Error('This page link is not valid. Refresh Pulse and try again.'),
    { status: 400, code: 'INVALID_FEED_CURSOR' });
}
function decode(value) {
  if (timestamp(value)) return { t: value, id: MAX_ID };
  if (typeof value !== 'string' || value.length > 600 || !/^[A-Za-z0-9_-]+$/.test(value)) throw invalid();
  let cursor;
  try { cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); } catch (_) { throw invalid(); }
  if (cursor?.v !== 1 || !timestamp(cursor.t) || !UUID.test(cursor.id)
    || !timestamp(cursor.s) || !timestamp(cursor.b) || Date.parse(cursor.s) > Date.parse(cursor.b)
    || Date.parse(cursor.t) > Date.parse(cursor.b)) throw invalid();
  return cursor;
}
function encode(post, since, readAt) {
  return Buffer.from(JSON.stringify({ v: 1, t: post.created_at, id: post.id, s: since, b: readAt })).toString('base64url');
}
module.exports = { UUID, MAX_ID, timestamp, decode, encode };
