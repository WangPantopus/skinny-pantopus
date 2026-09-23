// Record photos (S2-02 part B) on the disposable Stream 2 stack: upload permission matrix, validation, private storage,
// signed reads by permission, and the stored object's privacy. Synthetic images only; fixture Home record "Stream2 RD
// washer". Signed URLs are never printed (they carry a token): only their path and expiry.
// Usage: node record-photos-probe.cjs <label>
const h = require('./h.cjs');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const ASSET = sql(`select id from "HomeAsset" where home_id='f0e51100-0000-4000-8000-000000000200' and name='Stream2 RD washer'`);
const D = __dirname + '/work/t32/';
const upload = async (sess, file, type, name) => {
  const fd = new FormData();
  if (file) fd.append('file', new Blob([fs.readFileSync(D + file)], { type }), name || file);
  const r = await fetch(h.BASE + `/api/mailbox/v2/p3/records/asset/${ASSET}/photos`, { method: 'POST', headers: { authorization: 'Bearer ' + sess.token, 'user-agent': 'stream2-r06-harness' }, body: fd });
  let j = null; try { j = await r.json(); } catch (_) {}
  if (j && j.photo && j.photo.id) fs.appendFileSync(__dirname + '/work/t32-photo-ids.txt', j.photo.id + '\n');
  return { status: r.status, json: j };
};
const describeUrl = (u) => {
  if (!u) return String(u);
  try { const x = new URL(u); const tok = x.searchParams.get('token'); let exp = '';
    if (tok) { const p = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()); exp = ` exp=+${p.exp - p.iat}s`; }
    return `${x.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (m) => m.slice(0, 8)).replace(/[0-9a-f]{64}/, '<sha256>')}${tok ? ' ?token=<redacted>' : ''}${exp}`; } catch (_) { return 'unparseable'; }
};
(async () => {
  const label = process.argv[2] || 'run';
  console.log(`# ${label}: record ${ASSET.slice(0, 8)} "Stream2 RD washer" on the fixture Home`);
  const who = ['owner', 'viewer', 'editor', 'rdmember', 'rdnohome'];
  const S = {}; for (const w of who) S[w] = await h.login(w);
  console.log('## Upload, washer.jpg (5.9 KB JPEG)');
  for (const w of who) {
    const r = await upload(S[w], 'washer.jpg', 'image/jpeg');
    console.log(`${w.padEnd(9)} POST photos -> ${r.status} ${r.json && r.json.photo ? `photo ${r.json.photo.id.slice(0, 8)} url ${describeUrl(r.json.photo.url)}` : JSON.stringify(r.json)}`);
  }
  console.log('## Validation, as the owner');
  for (const [f, t, n] of [['fake.jpg', 'image/jpeg', 'text claiming JPEG'], ['doc.pdf', 'application/pdf', 'a PDF'], ['washer2.png', 'image/png', 'a PNG'], ['big.jpg', 'image/jpeg', '26 MB file'], [null, null, 'no file']]) {
    const r = await upload(S.owner, f, t);
    console.log(`${n.padEnd(19)} -> ${r.status} ${r.json && r.json.photo ? `photo ${r.json.photo.id.slice(0, 8)}` : JSON.stringify(r.json)}`);
  }
  const bogus = await fetch(h.BASE + '/api/mailbox/v2/p3/records/asset/00000000-0000-4000-8000-000000000000/photos', { method: 'POST', headers: { authorization: 'Bearer ' + S.owner.token } });
  console.log(`unknown record id    -> ${bogus.status} ${JSON.stringify(await bogus.json().catch(() => null))}`);
  const anon = await fetch(h.BASE + `/api/mailbox/v2/p3/records/asset/${ASSET}/photos`, { method: 'POST' });
  console.log(`no session           -> ${anon.status}`);
  console.log('## Stored rows and objects');
  console.log(sql(`select coalesce(string_agg(left(id::text,8) || ' url=' || regexp_replace(regexp_replace(url, '[0-9a-f]{64}', '<sha256>'), '([0-9a-f]{8})[0-9a-f-]{28}', '\\1', 'g') || ' by=' || left(uploaded_by::text,8), E'\\n'), 'none') from "AssetPhoto" where asset_id='${ASSET}'`));
  console.log('## Reads: records list and detail');
  let sample = null;
  for (const w of who) {
    const list = await h.api('GET', '/api/mailbox/v2/p3/records/assets?homeId=f0e51100-0000-4000-8000-000000000200', S[w]);
    const a = ((list.json && list.json.assets) || []).find((x) => x.id === ASSET);
    const det = await h.api('GET', `/api/mailbox/v2/p3/records/asset/${ASSET}/mail`, S[w]);
    const photos = (det.json && det.json.photos) || [];
    if (!sample && photos[0]) sample = photos[0].url;
    console.log(`${w.padEnd(9)} list ${list.status} ${a ? `record listed, photos ${a.photos.length}, photo_url ${describeUrl(a.photo_url)}` : 'record not listed'}; detail ${det.status} photos ${photos.length}${photos[0] ? ' first ' + describeUrl(photos[0].url) : ''}`);
  }
  console.log('## The stored object');
  if (sample) {
    fs.writeFileSync(__dirname + '/work/t32-signed-url.txt', sample + '\n', { mode: 0o600 });
    fs.writeFileSync(__dirname + '/work/t32-signed-at.txt', new Date().toISOString() + '\n');
    const r = await fetch(sample);
    const buf = Buffer.from(await r.arrayBuffer());
    const same = crypto.createHash('sha256').update(buf).digest('hex') === crypto.createHash('sha256').update(fs.readFileSync(D + 'washer.jpg')).digest('hex')
      || crypto.createHash('sha256').update(buf).digest('hex') === crypto.createHash('sha256').update(fs.readFileSync(D + 'washer2.png')).digest('hex');
    console.log(`signed URL GET -> ${r.status} ${r.headers.get('content-type')} ${buf.length} bytes, matches an uploaded file: ${same}`);
    const u = new URL(sample);
    const pub = u.origin + u.pathname.replace('/object/sign/', '/object/public/');
    const p = await fetch(pub);
    console.log(`same object via the public path (no token) -> ${p.status} ${(await p.text()).slice(0, 90)}`);
    const auth = await fetch(u.origin + u.pathname.replace('/object/sign/', '/object/authenticated/'), { headers: { authorization: 'Bearer ' + S.owner.token } });
    console.log(`same object with the owner's app session instead of a token -> ${auth.status}`);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
