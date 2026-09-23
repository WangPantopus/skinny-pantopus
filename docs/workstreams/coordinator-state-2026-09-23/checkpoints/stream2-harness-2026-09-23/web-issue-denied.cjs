// R06 role guard: a verified guest/service account tries to issue from the real Identity UI.
const fs = require('node:fs'); const w = require('./web-lib.cjs');
(async () => {
  const [who, tag] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, who); const page = await ctx.newPage();
  const net = []; w.netLog(page, net);
  await page.goto(w.WEB + '/app/place/identity', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByRole('button', { name: /Generate a verified residency letter/ }).click();
  await page.getByLabel('What is this letter for?').fill(`R06 ${who} attempt from web`);
  await page.getByRole('button', { name: /Issue verified letter/ }).click();
  const toast = page.getByText(/Only residents of this home|residency letter|Could not issue/).first();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${w.OUT}/${tag}.png` });
  const text = await page.innerText('body');
  fs.writeFileSync(`${w.OUT}/${tag}.json`, JSON.stringify({ who, net, text: text.slice(0, 1500) }, null, 2));
  console.log(net.map((n) => `${n.method} ${n.path} ${n.status} ${JSON.stringify(n.body).slice(0, 140)}`).join('\n'));
  console.log(/Only residents of this home can issue a residency letter/.test(text) ? 'TOAST SHOWN' : 'no toast text found');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
