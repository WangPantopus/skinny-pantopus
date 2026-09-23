// Web classic task form (/app/gigs/new) against the origin_home_id guard.
// home: pick the Home in the form's Location "Home" tab (a member's normal path; the Home has no stored
//   coordinates here, so the form geocodes its address: that one geocoder answer is supplied in the browser).
// prefill-home: open the form with a prefill link carrying the Home (as the magic composer's "Edit details" does).
// prefill-address: the same link with an address and no Home.
// Deadline and Estimated duration are filled (the form cannot post with them empty until #294).
// Usage: node web-guard-post.cjs <who> <home|prefill-home|prefill-address> <label> <shot>
const w = require('./web-lib.cjs'); const fs = require('fs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [who, mode, label, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pantopus_first_gig_shared', '1'); } catch (_) {} });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  let sent = null; let resp = null; const title = `Stream2 RD guard web ${label}: move a couch`;
  page.on('request', (req) => { if (req.method() === 'POST' && /\/api\/gigs$/.test(req.url().split('?')[0])) { try { const j = JSON.parse(req.postData() || '{}'); sent = { homeId: j.location && j.location.homeId === HOME ? '<home>' : (j.location && j.location.homeId) || null }; } catch (_) {} } });
  page.on('response', async (r) => { if (r.request().method() === 'POST' && /\/api\/gigs$/.test(r.url().split('?')[0])) { let j = null; try { j = await r.json(); } catch (_) {} resp = { status: r.status(), error: j && j.error, id: j && j.gig && j.gig.id }; if (resp.id) fs.appendFileSync(__dirname + '/work/t19-made-gig-ids.txt', resp.id + '\n'); } });
  await page.route('**/api/geo/autocomplete**', (route) => route.fulfill({ json: { suggestions: [
    { suggestion_id: 'stub-1', label: 'Stream2 native fixture, Vancouver WA 98660', center: { lat: 45.6387, lng: -122.6615 } }] } }));
  const prefill = mode === 'home' ? null : { latitude: 45.6387, longitude: -122.6615, address: '100 Synthetic St, Vancouver, WA',
    mode: mode === 'prefill-home' ? 'home' : 'address', ...(mode === 'prefill-home' ? { homeId: HOME } : {}) };
  await page.goto(`${w.WEB}/app/gigs/new${prefill ? `?prefill=${encodeURIComponent(JSON.stringify(prefill))}` : ''}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByPlaceholder('e.g., Need help moving a couch').fill(title);
  await page.getByPlaceholder(/Describe what you need/).fill('Synthetic Stream2 origin_home_id guard post.');
  await page.getByPlaceholder('50').fill('35');
  await page.locator('input[type="date"]').first().fill('2026-10-20');
  await page.getByPlaceholder('e.g., 2').fill('2');
  if (mode === 'home') {
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.locator('select').filter({ has: page.locator(`option[value="${HOME}"]`) }).first().selectOption(HOME);
    await page.waitForTimeout(2500);
  }
  await page.getByRole('button', { name: /^Post Task$/ }).click();
  await page.waitForTimeout(4000);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  const said = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => /Failed to|can't post|Please fix|Task posted/.test(l)).slice(0, 3);
  const rows = require('node:child_process').execFileSync(__dirname + '/psql.sh', ['-Atc', `select count(*) || ' row(s)' || coalesce(' origin=' || string_agg(coalesce(origin_home_id::text,'none'), ','), '') from "Gig" where title = '${title}'`]).toString().trim().replace(HOME, '<home>');
  console.log(`# web ${who}: classic form, ${mode} [${label}]`);
  console.log(`POST /api/gigs location.homeId=${sent ? sent.homeId : '-'} -> ${resp ? `${resp.status}${resp.error ? ' ' + JSON.stringify(resp.error) : ''}` : '(none)'}; page says ${JSON.stringify(said)}; url ${page.url().replace(w.WEB, '').split('?')[0]}; database: ${rows}`);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
