const { BASE, OUT, open, login, shot } = require('./lib.cjs');
(async () => {
  const { browser, page } = await open();
  await login(page, 'alice');
  await page.goto(`${BASE}/app/hub`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  await shot(page, 'dbg-hub');
  const t = (await page.locator('body').innerText()).split('\n').filter(Boolean).slice(0, 40).join(' | ');
  console.log(t);
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
