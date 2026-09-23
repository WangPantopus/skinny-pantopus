// GET /api/gigs, /api/gigs/in-bounds and /api/gigs/browse for one viewer over Bearer (native) and the web session
// cookie (through Next), and anonymously. Prints which synthetic tasks each returns and their viewer_has_saved.
// setup: posts six tasks near the fixture area and records the viewer's relationships to them:
//   own (posted by the viewer), saved (a stranger's task the viewer saved), hidden-category (the viewer hides
//   its category), plain (the owner account's task), i-blocked (posted by someone the viewer blocked),
//   blocked-me (posted by someone who blocked the viewer).
// Usage: node gig-browse-viewer-probe.cjs setup <tag> | node gig-browse-viewer-probe.cjs run <tag> <label>
const h = require('./h.cjs'); const w = require('./web-lib.cjs');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const LAT = 45.6387; const LNG = -122.6615;
const place = { mode: 'address', latitude: LAT, longitude: LNG, address: '100 Synthetic St, Vancouver, WA' };
(async () => {
  const [cmd, tag, label] = process.argv.slice(2);
  const viewer = await h.login('viewer');
  if (cmd === 'setup') {
    const post = async (who, name, category) => {
      const s = await h.login(who);
      const r = await h.api('POST', '/api/gigs', s, { title: `Stream2 RD browse ${tag} ${name}`, description: 'Synthetic Stream2 browse viewer probe task.', price: 25, category, location: place });
      const id = r.json.gig.id; fs.appendFileSync(__dirname + '/work/t21-made-gig-ids.txt', id + '\n'); return id;
    };
    await post('viewer', 'own', 'General');
    const saved = await post('rdnohome', 'saved', 'General');
    await post('owner', 'hidden-category', 'Pet Care');
    await post('owner', 'plain', 'General');
    await post('editor', 'i-blocked', 'General');
    await post('rdios', 'blocked-me', 'General');
    const editor = h.creds('editor').id; const rdios = h.creds('rdios').id;
    console.log(sql(`insert into "UserBlock" (blocker_user_id, blocked_user_id, reason) values ('${viewer.id}', '${editor}', 'stream2 browse probe'), ('${rdios}', '${viewer.id}', 'stream2 browse probe') returning 'block ' || id`));
    console.log(sql(`insert into user_hidden_categories (user_id, category) values ('${viewer.id}', 'Pet Care') returning 'hidden category ' || id`));
    const s = await h.api('POST', `/api/gigs/${saved}/save`, viewer); console.log(`viewer saves the stranger's task: ${s.status}`);
    return;
  }
  const paths = [
    `/api/gigs?latitude=${LAT}&longitude=${LNG}&radiusMiles=5&limit=50`,
    `/api/gigs/in-bounds?min_lat=${LAT - 0.05}&min_lon=${LNG - 0.05}&max_lat=${LAT + 0.05}&max_lon=${LNG + 0.05}`,
    `/api/gigs/browse?lat=${LAT}&lng=${LNG}`,
  ];
  const mark = `Stream2 RD browse ${tag} `;
  const collect = (json) => {
    const seen = new Map();
    const walk = (v) => {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === 'object') {
        if (typeof v.title === 'string' && v.title.startsWith(mark)) {
          const k = v.title.slice(mark.length);
          seen.set(k, (seen.get(k) || '') || (v.viewer_has_saved ? 'saved' : ''));
        }
        Object.values(v).forEach(walk);
      }
    };
    walk(json);
    return [...seen.entries()].sort().map(([k, s]) => (s ? `${k}(saved)` : k)).join(', ') || '(none)';
  };
  console.log(`# ${label}`);
  const b = await w.browser();
  const cookieCtx = await b.newContext({ userAgent: 'stream2-r06-web-chrome' });
  const c = h.creds('viewer');
  const lr = await cookieCtx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed');
  const anonCtx = await b.newContext({ userAgent: 'stream2-r06-web-chrome' });
  for (const p of paths) {
    const name = p.split('?')[0];
    const bearer = await h.api('GET', p, viewer);
    const cookie = await cookieCtx.request.get(w.WEB + p); let cj = null; try { cj = await cookie.json(); } catch (_) {}
    const anon = await anonCtx.request.get(w.WEB + p); let aj = null; try { aj = await anon.json(); } catch (_) {}
    console.log(`${name.padEnd(20)} viewer Bearer ${bearer.status}: ${collect(bearer.json)}`);
    console.log(`${name.padEnd(20)} viewer cookie ${cookie.status()}: ${collect(cj)}`);
    console.log(`${name.padEnd(20)} anonymous     ${anon.status()}: ${collect(aj)}`);
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
