// R06 Residency Pass: real Identity -> Residency Pass issue (City), view, public check, revoke, public check.
const fs = require('node:fs'); const w = require('./web-lib.cjs');
async function publicCheck(b, code, tag) {
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, userAgent: 'stream2-r06-web-anon' });
  const page = await ctx.newPage(); const net = [];
  page.on('response', async (r) => { if (/\/api\/public\/residency-claims\//.test(r.url())) { let body = null; try { body = await r.json(); } catch (_) {} net.push({ path: r.url().replace(w.WEB, ''), status: r.status(), body }); } });
  await page.goto(`${w.WEB}/verify-claim/${code}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${w.OUT}/${tag}.png` });
  const text = await page.innerText('main');
  await ctx.close();
  return { net, text };
}
(async () => {
  const [who, tagPrefix] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, who);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: w.WEB });
  const page = await ctx.newPage(); const net = [];
  page.on('response', async (r) => { if (/residency-claims/.test(r.url())) { let body = null; try { body = await r.json(); } catch (_) {} net.push({ m: r.request().method(), path: r.url().replace(w.WEB, ''), status: r.status(), body }); } });
  await page.goto(w.WEB + '/app/place/identity', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByRole('button', { name: /Prove residency without sharing your address/ }).click();
  await page.getByRole('button', { name: /^City/ }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${w.OUT}/${tagPrefix}-a-pass-leaf.png` });
  await page.getByRole('button', { name: /Issue claim/ }).click();
  await page.getByText(/Claim issued — code/).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  const bodyText = await page.innerText('body');
  const code = (bodyText.match(/[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/) || [])[0];
  let clip = null; try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch (_) { clip = '[clipboard unreadable]'; }
  await page.screenshot({ path: `${w.OUT}/${tagPrefix}-b-pass-issued.png`, fullPage: true });
  const pub1 = await publicCheck(b, code, `${tagPrefix}-c-public-active`);
  await page.getByRole('button', { name: /Revoke/ }).first().click();
  await page.getByText(/Claim revoked/).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${w.OUT}/${tagPrefix}-d-pass-revoked.png`, fullPage: true });
  const pub2 = await publicCheck(b, code, `${tagPrefix}-e-public-revoked`);
  const res = { who, code, clipboard: clip, net, pub1, pub2 };
  fs.writeFileSync(`${w.OUT}/${tagPrefix}-pass-result.json`, JSON.stringify(res, null, 2));
  console.log(JSON.stringify({ code, clipboard: clip, net: net.map((n) => `${n.m} ${n.path} ${n.status}`), pub1: pub1.net, pub1Text: pub1.text.slice(0, 400), pub2: pub2.net, pub2Text: pub2.text.slice(0, 300) }, null, 1));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
