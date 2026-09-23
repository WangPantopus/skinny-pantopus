// D07: owner opens Members & Security -> member detail -> Access Expiry Date -> Set (real UI).
const fs = require('node:fs'); const w = require('./web-lib.cjs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [memberName, date, tag] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, 'owner'); const page = await ctx.newPage();
  const net = []; page.on('response', async (r) => { if (/\/members\/[^/]+\/(role|permissions)/.test(r.url())) { let body = null; try { body = await r.json(); } catch (_) {} net.push({ m: r.request().method(), path: r.url().replace(w.WEB, ''), status: r.status(), req: r.request().postData(), body }); } });
  await page.goto(`${w.WEB}/app/homes/${HOME}/dashboard?tab=security`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByText('@' + memberName, { exact: true }).first().click();
  await page.getByText('Access Expiry Date').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${w.OUT}/${tag}-a-detail.png` });
  await page.locator('input[type="date"]').first().fill(date);
  await page.getByRole('button', { name: /^Set$/ }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${w.OUT}/${tag}-b-after-set.png` });
  const text = await page.innerText('body');
  const err = (text.match(/Changing a role cannot change existing access dates\.|Failed to update expiry|[^\n]*expir[^\n]*/i) || [])[0];
  fs.writeFileSync(`${w.OUT}/${tag}.json`, JSON.stringify({ memberName, date, net, err }, null, 2));
  console.log(JSON.stringify({ net, err }, null, 1));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
