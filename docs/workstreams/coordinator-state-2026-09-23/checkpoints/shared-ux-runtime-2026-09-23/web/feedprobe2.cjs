const { BASE, OUT, open, login, shot } = require('./lib.cjs');
(async () => {
  const { browser, page, requests } = await open();
  await login(page, 'alice');
  for (const tab of ['Connections', 'Beacons']) {
    await page.goto(`${BASE}/app/feed`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    await page.getByRole('button', { name: tab, exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(5000);
    const t = (await page.locator('main').first().innerText().catch(async () => page.locator('body').innerText())).split('\n').filter(Boolean).slice(0, 25).join(' | ');
    console.log(`== ${tab}: ${t}`);
  }
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
