// Route-drift item 6: pick a package condition photo on the web mailbox item page.
// Usage: node web-condition-photo.cjs <who> <mailId> <drawer> <photo.jpg> <shot-prefix>
const w = require('./web-lib.cjs');
(async () => {
  const [who, mailId, drawer, photo, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const log = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 200)); });
  page.on('response', async (resp) => {
    const u = resp.url().replace(w.WEB, '');
    if (!/condition-photo|\/unboxing|\/api\/files\/upload/.test(u)) return;
    let body = ''; try { body = (await resp.text()).slice(0, 200); } catch (_) {}
    log.push(`${resp.request().method()} ${u} ${resp.status()} ${body}`);
  });
  const buttonText = async () => {
    const t = await page.locator('button:has-text("condition photo"), button:has-text("Uploading")').first().innerText().catch(() => '(no button)');
    return t.replace(/\s+/g, ' ').trim();
  };
  await page.goto(`${w.WEB}/app/mailbox/${drawer}/${mailId}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  console.log(`# web ${who}: package ${mailId} condition photo`);
  console.log(`1. loaded: button="${await buttonText()}"`);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-a.png`, fullPage: true });
  await page.locator('input[type=file][accept="image/*"]').first().setInputFiles(photo);
  await page.waitForTimeout(6000);
  console.log(`2. after picking a photo: button="${await buttonText()}"`);
  const alerts = await page.locator('[role=alert]').allInnerTexts().catch(() => []);
  console.log(`   alerts: ${JSON.stringify(alerts)}`);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-b.png`, fullPage: true });
  for (const l of log) console.log('  ' + l);
  for (const e of errors) console.log('  ' + e);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
