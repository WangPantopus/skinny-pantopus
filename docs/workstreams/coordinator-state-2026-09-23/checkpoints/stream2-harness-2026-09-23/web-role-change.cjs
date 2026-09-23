// D07: owner changes a member's role from Members & Security -> member detail (real UI), optionally after typing an expiry date.
const fs = require('node:fs'); const w = require('./web-lib.cjs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [handle, date, roleLabel, tag] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, 'owner'); const page = await ctx.newPage();
  const net = []; page.on('response', async (r) => { if (/\/members\/[^/]+\/role/.test(r.url())) { let body = null; try { body = await r.json(); } catch (_) {} net.push({ m: r.request().method(), path: r.url().replace(w.WEB, ''), status: r.status(), req: r.request().postData(), body }); } });
  await page.goto(`${w.WEB}/app/homes/${HOME}/dashboard?tab=security`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByText('@' + handle, { exact: true }).first().click();
  await page.getByText('Access Expiry Date').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1000);
  const before = await page.locator('input[type="date"]').first().inputValue();
  if (date && date !== '-') await page.locator('input[type="date"]').first().fill(date);
  await page.getByRole('button', { name: new RegExp('^' + roleLabel) }).first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${w.OUT}/${tag}.png` });
  const text = await page.innerText('body');
  const err = (text.match(/Changing a role cannot change existing access dates\.|Failed to change role/) || [])[0] || null;
  fs.writeFileSync(`${w.OUT}/${tag}.json`, JSON.stringify({ handle, typedDate: date, expiryFieldBefore: before, roleLabel, net, err }, null, 2));
  console.log(JSON.stringify({ expiryFieldBefore: before, net: net.map((n) => `${n.m} ${n.status} ${n.req} ${JSON.stringify(n.body)}`), err }, null, 1));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
