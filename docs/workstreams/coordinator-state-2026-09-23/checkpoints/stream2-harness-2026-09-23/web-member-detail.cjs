const w = require('./web-lib.cjs');
(async () => {
  const [name, shot] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, 'owner'); const page = await ctx.newPage();
  await page.goto(`${w.WEB}/app/homes/f0e51100-0000-4000-8000-000000000200/dashboard?tab=security`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByText(name, { exact: true }).first().click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  const t = await page.innerText('body'); const i = t.indexOf('Role');
  console.log(t.slice(Math.max(0, i - 300), i + 1500));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
