const { open, login, shot, text, BASE } = require('./lib.cjs');
(async () => {
  const { browser, page } = await open();
  await login(page);
  console.log('after login url', page.url());
  await page.waitForTimeout(3000);
  await shot(page, 'smoke-after-login');
  console.log((await text(page, 'smoke-after-login')).slice(0, 600));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
