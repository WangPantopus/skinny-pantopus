// Route-drift item 7: switch Home in the web Hub picker and record any /api/hub/context requests.
// Usage: node web-hub-switch.cjs <who> <homeName> <shot-prefix>
const w = require('./web-lib.cjs');
(async () => {
  const [who, homeName, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const log = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('response', (resp) => {
    const u = resp.url().replace(w.WEB, '');
    if (/\/api\/hub(\/context|\?|$)/.test(u)) log.push(`${resp.request().method()} ${u} ${resp.status()}`);
  });
  await page.goto(`${w.WEB}/app/hub`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  console.log(`# web ${who}: Hub home switch (${page.url().replace(w.WEB, '')})`);
  const picker = page.locator('button', { hasText: homeName }).first();
  console.log(`1. picker button: ${await picker.count() ? 'shown' : 'missing'}`);
  await picker.click();
  await page.waitForTimeout(800);
  const rows = page.locator('button', { hasText: homeName });
  console.log(`2. picker open, buttons naming the home: ${await rows.count()}`);
  await rows.nth(1).click();
  await page.waitForTimeout(3000);
  const stored = await page.evaluate(() => { try { return localStorage.getItem('pantopus_active_home_id'); } catch (e) { return 'ERR'; } });
  console.log(`3. after choosing the home: picker rows now ${await rows.count()}, stored active home ${stored}`);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log(`4. after reload: picker button ${await page.locator('button', { hasText: homeName }).count() ? 'still shows the home' : 'missing'}`);
  for (const l of log) console.log('  ' + l);
  for (const e of errors) console.log('  ' + e);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
