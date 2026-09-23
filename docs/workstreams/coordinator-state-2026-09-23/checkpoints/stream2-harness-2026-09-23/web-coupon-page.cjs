// Web /app/mailbox/coupon (deep link): what the page shows, and (when it can) what "placing an order" does.
// Usage: node web-coupon-page.cjs <who> <label> <shot>
const w = require('./web-lib.cjs');
(async () => {
  const [who, label, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const calls = []; const errors = [];
  page.on('response', (r) => { const u = r.url().replace(w.WEB, ''); if (/coupon|offer|earn/i.test(u) && /^\/api/.test(u)) calls.push(`${r.request().method()} ${u.split('?')[0]} ${r.status()}`); });
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
  await page.goto(`${w.WEB}/app/mailbox/coupon?offerId=stream2-probe-offer`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  const lines = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter(Boolean);
  const i = lines.findIndex((l) => l === 'Coupon');
  console.log(`# web ${who}: /app/mailbox/coupon?offerId=… [${label}]`);
  console.log(`page: ${JSON.stringify(lines.slice(Math.max(0, i), i + 10))}`);
  console.log(`page errors: ${JSON.stringify(errors)}; requests: ${JSON.stringify(calls)}`);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
