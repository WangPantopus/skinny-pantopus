// Stream 2 R06 harness helpers. Reads synthetic fixture credentials from the private env files;
// never prints passwords or tokens. All calls go through the logging proxy 127.0.0.1:18142.
const fs = require('node:fs');
const BASE = process.env.R06_BASE || 'http://127.0.0.1:18142';
function envFile(p) {
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}
const ACC = envFile('/private/tmp/pantopus-workstream-home/.stream2-verification/native/accounts.env');
const EXTRA = fs.existsSync(__dirname + "/extra-accounts.env") ? envFile(__dirname + "/extra-accounts.env") : {};
function creds(who) {
  const W = who.toUpperCase();
  if (ACC[W + '_EMAIL']) return { email: ACC[W + '_EMAIL'], password: ACC.PASSWORD, id: ACC[W + '_ID'] };
  if (EXTRA[W + '_EMAIL']) return { email: EXTRA[W + '_EMAIL'], password: EXTRA[W + '_PASSWORD'] || EXTRA.PASSWORD, id: EXTRA[W + '_ID'] };
  throw new Error('unknown account ' + who);
}
const TOKCACHE = __dirname + '/.tokens.json';
function readCache() { try { return JSON.parse(fs.readFileSync(TOKCACHE, 'utf8')); } catch (_) { return {}; } }
async function login(who, { fresh = false } = {}) {
  const c = creds(who);
  const cache = readCache();
  if (!fresh && cache[who] && cache[who].exp > Date.now()) return { who, id: c.id, token: cache[who].token };
  const r = await fetch(BASE + '/api/users/login', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'stream2-r06-harness' }, body: JSON.stringify({ email: c.email, password: c.password }) });
  const j = await r.json().catch(() => ({}));
  const token = j.accessToken || j.access_token || j.session?.access_token || j.token;
  if (r.status !== 200 || !token) throw new Error(`login ${who} failed status=${r.status} keys=${Object.keys(j)}`);
  cache[who] = { token, exp: Date.now() + 50 * 60 * 1000 };
  fs.writeFileSync(TOKCACHE, JSON.stringify(cache), { mode: 0o600 });
  return { who, id: c.id, token };
}
async function api(method, path, sess, body, { raw = false } = {}) {
  const headers = { 'user-agent': 'stream2-r06-harness' };
  if (sess) headers.authorization = 'Bearer ' + sess.token;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const buf = Buffer.from(await r.arrayBuffer());
  let json = null; if (!raw) { try { json = JSON.parse(buf.toString('utf8')); } catch (_) {} }
  return { status: r.status, json, buf, contentType: r.headers.get('content-type'), disposition: r.headers.get('content-disposition') };
}
module.exports = { BASE, ACC, creds, login, api, envFile };
