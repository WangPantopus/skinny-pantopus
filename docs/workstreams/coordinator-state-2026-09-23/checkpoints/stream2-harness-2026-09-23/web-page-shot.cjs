// Screenshot Home pages in their normal state (no injected failure), with animations off and the caret hidden,
// for pixel comparison between master and a branch. Also prints the page's main text.
// Usage: node web-page-shot.cjs <who> <homeId> <pages comma list> <shot-prefix>
const w = require('./web-lib.cjs');
(async () => {
  const [who, homeId, list, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome', reducedMotion: 'reduce' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  for (const p of list.split(',')) {
    const page = await ctx.newPage();
    await page.goto(`${w.WEB}/app/homes/${homeId}/${p}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    const main = page.locator('main').first();
    await main.screenshot({ path: `${w.OUT}/${shot}-${p}.png`, animations: 'disabled', caret: 'hide' });
    const text = (await main.innerText()).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8);
    console.log(`${p}: ${JSON.stringify(text)}`);
    await page.close();
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
