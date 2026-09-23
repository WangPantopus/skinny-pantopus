// Route-drift item 5: dismiss the mailbox Mail Day banner, then reload.
const w = require('./web-lib.cjs');
(async () => {
  const [who, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const log = [];
  page.on('response', (resp) => { const u = resp.url().replace(w.WEB, ''); if (/mailday\/summary/.test(u)) log.push(`${resp.request().method()} ${u} ${resp.status()}`); });
  const banner = async () => ((await page.innerText('body')).split('\n').find(l => /new item/.test(l)) || '(no banner)').trim();
  await page.goto(`${w.WEB}/app/mailbox/counter`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  console.log(`# web ${who}: mailbox Mail Day banner`);
  console.log(`1. loaded: ${await banner()}`);
  const x = page.locator('button[aria-label*="ismiss" i]').first();
  if (await x.count()) { await x.click(); } else { await page.getByRole('button', { name: /×|✕|close/i }).first().click(); }
  await page.waitForTimeout(2500);
  console.log(`2. after dismiss: ${await banner()}`);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-a.png` });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log(`3. after reload: ${await banner()}`);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-b.png` });
  for (const l of log) console.log('  ' + l);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
