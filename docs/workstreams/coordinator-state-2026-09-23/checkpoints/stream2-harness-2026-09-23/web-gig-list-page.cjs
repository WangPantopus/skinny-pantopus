// Web task list (/app/gigs, list view) as a signed-in viewer with the browser's location at the fixture area.
// Prints which synthetic "Stream2 RD browse t21" tasks the page lists.
// Usage: node web-gig-list-page.cjs <who> <label> <shot>
const w = require('./web-lib.cjs');
(async () => {
  const [who, label, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1400 }, userAgent: 'stream2-r06-web-chrome',
    geolocation: { latitude: 45.6387, longitude: -122.6615 }, permissions: ['geolocation'] });
  await ctx.addInitScript(() => { try { localStorage.setItem('pantopus_gigs_view_mode', 'list'); } catch (_) {} });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const calls = [];
  page.on('response', (r) => { const u = r.url().replace(w.WEB, ''); if (/^\/api\/gigs(\?|\/browse|\/in-bounds)/.test(u)) calls.push(`${r.request().method()} ${u.split('?')[0]}${u.includes('latitude=') ? ' (with location)' : ''} ${r.status()}`); });
  await page.goto(`${w.WEB}/app/gigs`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(5000);
  const mark = 'Stream2 RD browse t21 ';
  const listed = [...new Set((await page.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => l.startsWith(mark)).map((l) => l.slice(mark.length)))].sort();
  console.log(`# web ${who}: /app/gigs list [${label}]`);
  console.log(`requests: ${JSON.stringify([...new Set(calls)])}`);
  console.log(`page lists: ${listed.join(', ') || '(none of the synthetic tasks)'}`);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
