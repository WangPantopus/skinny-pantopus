// GET /api/gigs without a location (the non-spatial path) for the viewer over Bearer and cookie, and anonymously.
const h = require('./h.cjs'); const w = require('./web-lib.cjs');
(async () => {
  const label = process.argv[2] || 'run';
  const viewer = await h.login('viewer');
  const mark = 'Stream2 RD browse t21 ';
  const pick = (j) => ((j && j.gigs) || []).filter((g) => typeof g.title === 'string' && g.title.startsWith(mark)).map((g) => g.title.slice(mark.length) + (g.viewer_has_saved ? '(saved)' : '')).sort().join(', ') || '(none)';
  const p = '/api/gigs?limit=100&sort=newest';
  const b = await w.browser();
  const ctx = await b.newContext(); const c = h.creds('viewer');
  await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  const anon = await b.newContext();
  const r1 = await h.api('GET', p, viewer); const r2 = await ctx.request.get(w.WEB + p); const r3 = await anon.request.get(w.WEB + p);
  console.log(`# ${label}: GET /api/gigs without a location`);
  console.log(`viewer Bearer ${r1.status}: ${pick(r1.json)}`);
  console.log(`viewer cookie ${r2.status()}: ${pick(await r2.json())}`);
  console.log(`anonymous     ${r3.status()}: ${pick(await r3.json())}`);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
