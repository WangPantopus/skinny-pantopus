const { BASE, OUT, open, login, shot } = require('./lib.cjs');
(async () => {
  const { browser, page, requests } = await open();
  await login(page, 'alice');
  await page.goto(`${BASE}/app/feed`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  await shot(page, 'feedprobe');
  const t = (await page.locator('main').first().innerText().catch(async () => page.locator('body').innerText())).split('\n').filter(Boolean).slice(0, 30).join(' | ');
  console.log(t);
  console.log('navigator.share:', await page.evaluate(() => typeof navigator.share));
  console.log(requests.filter((r) => r.path.includes('/api/posts')).map((r) => `${r.method} ${r.path} ${r.status}`).slice(0, 8).join('\n'));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
