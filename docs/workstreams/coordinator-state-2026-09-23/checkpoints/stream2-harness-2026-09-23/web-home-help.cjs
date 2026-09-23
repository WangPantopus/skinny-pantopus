// Route-drift item 8: what the web Home dashboard's "Home help" card shows (homeGigs / nearbyGigs).
// Usage: node web-home-help.cjs <who> <homeId> <shot-prefix>
const w = require('./web-lib.cjs');
(async () => {
  const [who, homeId, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const log = [];
  page.on('response', async (resp) => {
    const u = resp.url().replace(w.WEB, '');
    if (!/\/gigs\b|nearby-gigs/.test(u)) return;
    let body = ''; try { body = (await resp.text()).slice(0, 140); } catch (_) {}
    log.push(`${resp.request().method()} ${u} ${resp.status()} ${body}`);
  });
  await page.goto(`${w.WEB}/app/homes/${homeId}/dashboard`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(4000);
  const text = await page.innerText('body');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const i = lines.findIndex((l) => /^Home help$/i.test(l));
  console.log(`# web ${who}: Home dashboard ${homeId}`);
  console.log(`Home help card: ${i >= 0 ? JSON.stringify(lines.slice(i, i + 4)) : '(not shown)'}`);
  for (const l of lines.filter((x) => /could not be loaded|homeGigs|nearbyGigs/.test(x))) console.log(`  text: ${l}`);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png`, fullPage: true });
  // Expand the card (the expanded Home Help view with its sub-tabs).
  const card = page.getByText(/^Home Help$/i).first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(2500);
    const exp = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter(Boolean);
    const k = exp.findIndex((l) => /^(Active|Hiring|Scheduled|Completed)/.test(l));
    console.log(`expanded: ${JSON.stringify(exp.slice(Math.max(0, k - 2), k + 14))}`);
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-expanded.png`, fullPage: true });
  }
  for (const l of log) console.log('  ' + l);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
