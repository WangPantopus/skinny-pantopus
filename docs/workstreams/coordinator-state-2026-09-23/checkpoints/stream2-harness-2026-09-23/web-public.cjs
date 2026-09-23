// R06 web step 3/5: anonymous third-party check on the real /verify-residency/[code] page (no cookies).
const fs = require('node:fs'); const w = require('./web-lib.cjs');
(async () => {
  const [code, tag, typed] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, userAgent: 'stream2-r06-web-anon' });
  const page = await ctx.newPage(); const net = []; w.netLog(page, net);
  if (typed === 'typed') {
    await page.goto(w.WEB + '/verify-residency', { waitUntil: 'networkidle', timeout: 90000 });
    await page.getByLabel('Letter verification code').fill(code.toLowerCase().replace(/-/g, ' '));
    await page.getByRole('button', { name: /Check/ }).click();
  } else {
    await page.goto(w.WEB + '/verify-residency/' + code, { waitUntil: 'networkidle', timeout: 90000 });
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${w.OUT}/${tag}.png`, fullPage: false });
  const text = await page.innerText('main');
  const cookies = await ctx.cookies();
  fs.writeFileSync(`${w.OUT}/${tag}.json`, JSON.stringify({ code, mode: typed || 'deeplink', cookies: cookies.map(c => c.name), net, text }, null, 2));
  console.log(JSON.stringify({ cookies: cookies.map(c => c.name), net, text }, null, 1));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
