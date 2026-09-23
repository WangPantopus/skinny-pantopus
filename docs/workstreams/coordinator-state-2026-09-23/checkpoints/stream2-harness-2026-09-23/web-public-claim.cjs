const fs = require('node:fs'); const w = require('./web-lib.cjs');
(async () => {
  const [code, tag] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, userAgent: 'stream2-r06-web-anon' });
  const page = await ctx.newPage(); const net = [];
  page.on('response', async (r) => { if (/\/api\/public\/residency-claims\//.test(r.url())) { let body = null; try { body = await r.json(); } catch (_) {} net.push({ path: r.url().replace(w.WEB, ''), status: r.status(), body }); } });
  await page.goto(`${w.WEB}/verify-claim/${code}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${w.OUT}/${tag}.png` });
  const text = await page.innerText('main');
  fs.writeFileSync(`${w.OUT}/${tag}.json`, JSON.stringify({ code, net, text }, null, 2));
  console.log(JSON.stringify(net[0] && net[0].body)); const i = text.indexOf('Check\n'); console.log(text.slice(i + 6, i + 260).replace(/\n/g, ' | '));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
