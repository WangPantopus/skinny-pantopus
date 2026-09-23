const w = require('./web-lib.cjs');
(async () => {
  const b = await w.browser(); const ctx = await w.signedInContext(b, 'editor'); const page = await ctx.newPage();
  const net = []; w.netLog(page, net);
  await page.goto(w.WEB + '/app/place/identity', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: w.OUT + '/smoke-identity.png', fullPage: true });
  console.log(JSON.stringify(net.map(n => ({ p: n.path, s: n.status })), null, 0));
  console.log((await page.innerText('body')).slice(0, 900));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
