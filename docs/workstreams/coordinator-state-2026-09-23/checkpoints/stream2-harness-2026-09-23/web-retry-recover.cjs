// A Home page whose reads fail first, then recover: shows the page's failure state, clicks its Retry,
// and shows what it renders once /api/homes/<home>/... requests succeed again.
// Usage: node web-retry-recover.cjs <who> <homeId> <page> <shot-prefix>
const w = require('./web-lib.cjs');
(async () => {
  const [who, homeId, p, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome', reducedMotion: 'reduce' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  let failing = true; let aborted = 0; let passed = 0;
  const matcher = new RegExp(`/api/homes/${homeId}(/|\\?|$)`);
  await page.route((url) => matcher.test(url.toString()), (route) => {
    if (failing) { aborted += 1; return route.abort('failed'); }
    passed += 1; return route.continue();
  });
  await page.goto(`${w.WEB}/app/homes/${homeId}/${p}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const main = page.locator('main').first();
  const lines = async () => (await main.innerText()).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8);
  console.log(`# web ${who}: ${p} with reads failing, then Retry after the network recovers`);
  console.log(`1. failing (aborted ${aborted}): ${JSON.stringify(await lines())}`);
  if (shot) await main.screenshot({ path: `${w.OUT}/${shot}-1-failing.png`, animations: 'disabled', caret: 'hide' });
  failing = false;
  const retry = page.getByRole('button', { name: 'Retry', exact: true });
  if (await retry.count()) {
    await retry.first().click();
    await page.waitForTimeout(3000);
    console.log(`2. after Retry (passed ${passed}): ${JSON.stringify(await lines())}`);
    if (shot) await main.screenshot({ path: `${w.OUT}/${shot}-2-after-retry.png`, animations: 'disabled', caret: 'hide' });
  } else {
    console.log('2. no Retry button on the page');
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
