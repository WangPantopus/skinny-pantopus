// Web magic composer (AppShell "Quick actions" > "Hire Help"): describe a task, pick a location pill,
// press "Post Task", and report the magic-post response, the page's message, and whether the task opens.
// Usage: node web-magic-post.cjs <who> <pill: My Home|Remote> <label> <shot> [abort]
//   abort=1 stops the request in the browser (connection refused), as if the API were down.
const w = require('./web-lib.cjs'); const fs = require('fs');
(async () => {
  const [who, pill, label, shot, abort] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  let post = null; let draftStatus = null;
  page.on('response', async (resp) => {
    const u = resp.url();
    if (u.includes('/api/gigs/magic-draft')) draftStatus = resp.status();
    if (!u.includes('/api/gigs/magic-post')) return;
    let json = null; try { json = await resp.json(); } catch (_) {}
    post = { status: resp.status(), error: json && json.error, id: json && json.gig && json.gig.id };
    if (post.id) fs.appendFileSync(__dirname + '/work/t14-made-gig-ids.txt', post.id + '\n');
  });
  if (abort === '1') await page.route('**/api/gigs/magic-post', (route) => route.abort('connectionrefused'));
  // The geocoder has no key on this stack. With GEO_STUB=1 its one answer (the Home's address -> the Home's
  // coordinates) is supplied in the browser, so "My Home" can resolve; every Pantopus API call stays real.
  let geoStubbed = 0;
  if (process.env.GEO_STUB === '1') await page.route('**/api/geo/autocomplete**', (route) => { geoStubbed++; route.fulfill({ json: { suggestions: [
    { suggestion_id: 'stub-1', label: 'Stream2 native fixture, Vancouver WA 98660', center: { lat: 45.6387, lng: -122.6615 } }] } }); });
  await page.goto(`${w.WEB}/app/hub`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('button', { name: 'Quick actions' }).click();
  await page.getByText('Hire Help', { exact: true }).click();
  const box = page.locator('.v2-overlay textarea').first();
  await box.waitFor({ timeout: 60000 });
  await box.fill(`Stream2 RD ${label}: help me move a couch this weekend`);
  await page.waitForTimeout(4000);
  await page.locator('.v2-overlay').getByText(pill, { exact: false }).first().click();
  await page.waitForTimeout(2500);
  const postBtn = page.locator('.v2-overlay').getByRole('button', { name: /Post Task/ });
  const enabled = await postBtn.isEnabled();
  await postBtn.click();
  await page.waitForTimeout(3500);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  const text = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter(Boolean);
  const said = text.filter((l) => /Posted|posted|Failed|failed|error|Error|Network|View Task|Undo/.test(l)).slice(0, 6);
  console.log(`# web ${who}: magic composer, ${pill}, Post Task [${label}]${abort === '1' ? ' (request aborted in the browser)' : ''}`);
  console.log(`magic-draft ${draftStatus}; Post Task enabled=${enabled}; POST /api/gigs/magic-post ${post ? `${post.status}${post.error ? ' ' + JSON.stringify(post.error) : ''}` : '(no response)'}`);
  console.log(`page says: ${JSON.stringify(said)}${process.env.GEO_STUB === '1' ? ` (geocoder answers stubbed in the browser: ${geoStubbed})` : ''}`);
  if (post && post.id) {
    await page.locator('.v2-overlay').getByRole('button', { name: 'View Task' }).click();
    await page.waitForURL(/\/app\/gigs\//, { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const title = (await page.innerText('body')).split('\n').map((l) => l.trim()).find((l) => l.includes(`Stream2 RD ${label}`) || /move a couch/i.test(l));
    console.log(`View Task -> ${page.url().replace(w.WEB, '')} shows: ${JSON.stringify(title || '(title not found)')}`);
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-task.png` });
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
