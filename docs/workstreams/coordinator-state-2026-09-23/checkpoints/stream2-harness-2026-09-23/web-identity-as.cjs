// R06: what a signed-in account sees on the real Identity page (removed member / non-member denial on web).
const fs = require('node:fs'); const w = require('./web-lib.cjs');
(async () => {
  const [who, tag] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, who); const page = await ctx.newPage();
  const net = []; w.netLog(page, net);
  await page.goto(w.WEB + '/app/place/identity', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${w.OUT}/${tag}.png` });
  const text = await page.innerText('body');
  fs.writeFileSync(`${w.OUT}/${tag}.json`, JSON.stringify({ who, net, text: text.slice(0, 800) }, null, 2));
  console.log(JSON.stringify(net.map((n) => `${n.method} ${n.path} ${n.status} ${JSON.stringify(n.body).slice(0, 120)}`), null, 1)); console.log(text.slice(0, 400));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
