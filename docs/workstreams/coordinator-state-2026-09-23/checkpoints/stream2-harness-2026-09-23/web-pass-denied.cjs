// R06 role guard (passes): a verified guest/service account tries to issue a Residency Pass from the real UI.
const fs = require('node:fs'); const w = require('./web-lib.cjs');
(async () => {
  const [who, tag] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, who); const page = await ctx.newPage();
  const net = []; page.on('response', async (r) => { if (/residency-claims/.test(r.url()) && r.request().method() === 'POST') { let body = null; try { body = await r.json(); } catch (_) {} net.push({ path: r.url().replace(w.WEB, ''), status: r.status(), body }); } });
  await page.goto(w.WEB + '/app/place/identity', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByRole('button', { name: /Prove residency without sharing your address/ }).click();
  await page.getByRole('button', { name: /^City/ }).first().click();
  await page.getByRole('button', { name: /Issue claim/ }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${w.OUT}/${tag}.png` });
  const text = await page.innerText('body');
  const toast = (text.match(/(Only residents of this home can issue a residency claim\.|Could not issue the claim\. Try again\.)/) || [])[0] || null;
  fs.writeFileSync(`${w.OUT}/${tag}.json`, JSON.stringify({ who, net, toast }, null, 2));
  console.log(JSON.stringify({ net, toast }));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
