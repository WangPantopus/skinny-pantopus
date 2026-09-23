// Web "My Home" posting: does picking the Home geocode its address or PATCH the Home, and does the post succeed?
// mode classic = /app/gigs/new, Location "Home" tab + Home select; mode magic = Quick actions > Hire Help, "My Home".
// The geocoder has no key on this stack; its answer (the Home's coordinates) is supplied in the browser and counted,
// so a picker that still geocodes can finish its post. Every Pantopus API call is real.
// Usage: node web-home-location-post.cjs <who> <classic|magic> <label> <shot>
const w = require('./web-lib.cjs'); const fs = require('fs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [who, mode, label, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const seen = { geocode: 0, homePatch: 0, post: null };
  page.on('request', (req) => {
    const u = req.url();
    if (/\/api\/geo\//.test(u)) seen.geocode++;
    if (req.method() === 'PATCH' && u.includes(`/api/homes/${HOME}`)) seen.homePatch++;
  });
  page.on('response', async (resp) => {
    const u = resp.url();
    if (!(resp.request().method() === 'POST' && (/\/api\/gigs\/?(\?|$)/.test(u.replace(w.WEB, '')) || u.includes('/api/gigs/magic-post')))) return;
    let json = null; try { json = await resp.json(); } catch (_) {}
    const g = json && json.gig;
    seen.post = { path: u.replace(w.WEB, ''), status: resp.status(), id: g && g.id, error: json && json.error };
    if (g && g.id) fs.appendFileSync(__dirname + '/work/t17-made-gig-ids.txt', g.id + '\n');
  });
  await page.route('**/api/geo/autocomplete**', (route) => route.fulfill({ json: { suggestions: [
    { suggestion_id: 'stub-1', label: 'Stream2 native fixture, Vancouver WA 98660', center: { lat: 45.6387, lng: -122.6615 } }] } }));
  if (mode === 'classic') {
    await page.goto(`${w.WEB}/app/gigs/new`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.getByPlaceholder('e.g., Need help moving a couch').fill(`Stream2 RD ${label}: move a couch`);
    await page.getByPlaceholder(/Describe what you need/).fill('Synthetic Stream2 task posted from My Home on the web.');
    await page.getByPlaceholder('50').fill('40');
    // The classic form's create call fails validation when these are left empty (it sends null); fill them.
    await page.locator('input[type="date"]').first().fill('2026-10-01');
    await page.getByPlaceholder('e.g., 2').fill('2');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.locator('select').filter({ has: page.locator(`option[value="${HOME}"]`) }).first().selectOption(HOME);
    await page.waitForTimeout(2500);
    const picked = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => /Could not determine|no address|coordinates|Stream2 native fixture/.test(l)).slice(0, 3);
    console.log(`# web ${who}: classic composer, Location "Home" [${label}]`);
    console.log(`after picking the Home: geocode requests=${seen.geocode}, PATCH /api/homes/<home>=${seen.homePatch}; page: ${JSON.stringify(picked)}`);
    await page.getByRole('button', { name: /^Post Task$/ }).click();
  } else {
    await page.goto(`${w.WEB}/app/hub`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.getByRole('button', { name: 'Quick actions' }).click();
    await page.getByText('Hire Help', { exact: true }).click();
    const box = page.locator('.v2-overlay textarea').first();
    await box.waitFor({ timeout: 60000 });
    await box.fill(`Stream2 RD ${label}: help me move a couch this weekend`);
    await page.waitForTimeout(4000);
    await page.locator('.v2-overlay').getByText('My Home', { exact: false }).first().click();
    await page.waitForTimeout(2500);
    const picked = (await page.locator('.v2-overlay').innerText()).split('\n').map((l) => l.trim()).filter((l) => /no coordinates|Stream2 native fixture/.test(l)).slice(0, 3);
    console.log(`# web ${who}: magic composer, "My Home" [${label}]`);
    console.log(`after picking My Home: geocode requests=${seen.geocode}, PATCH /api/homes/<home>=${seen.homePatch}; composer: ${JSON.stringify(picked)}`);
    await page.locator('.v2-overlay').getByRole('button', { name: /Post Task/ }).click();
  }
  await page.waitForTimeout(4000);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  console.log(`post: ${seen.post ? `${seen.post.path.split('?')[0]} ${seen.post.status}${seen.post.error ? ' ' + JSON.stringify(seen.post.error) : ''}` : '(none)'}; totals: geocode requests=${seen.geocode}, PATCH /api/homes/<home>=${seen.homePatch}`);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
