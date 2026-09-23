// Route-drift item 1: open a Counter item from the repaired Counter page.
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
  page.on('response', (resp) => { const u = resp.url().replace(w.WEB, ''); if (/\/api\/mailbox\/v2\/item\//.test(u)) log.push(`${resp.request().method()} ${u.replace(/[0-9a-f-]{36}/, '<id>')} ${resp.status()}`); });
  await page.goto(`${w.WEB}/app/mailbox/counter`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.getByText('Stream2 RD household notice overdue', { exact: true }).click();
  await page.waitForTimeout(4000);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  console.log(`# web ${who}: Counter → "Stream2 RD household notice overdue" → ${page.url().replace(w.WEB, '').replace(/[0-9a-f-]{36}/, '<id>')}`);
  for (const l of [...new Set(log)]) console.log(l);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
