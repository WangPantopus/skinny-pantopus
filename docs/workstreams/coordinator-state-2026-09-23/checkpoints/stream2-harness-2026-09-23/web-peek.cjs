const w = require('./web-lib.cjs');
(async () => {
  const [who, path, shot] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, who); const page = await ctx.newPage();
  await page.goto(w.WEB + path, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png`, fullPage: true });
  console.log((await page.evaluate(() => document.visibilityState)), '\n', (await page.innerText('body')).slice(0, 1500));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
