// node c12.cjs <label> : Discover rail with GET /api/hub/discovery failing (500), then fault off + Try again if offered.
const fs = require('fs');
const { BASE, OUT, open, login, shot } = require('./lib.cjs');
const FAULT = '/private/tmp/pantopus-shared-ux-runtime/fault.json';
const label = process.argv[2];
(async () => {
  const { browser, page } = await open();
  await login(page, 'alice');
  fs.writeFileSync(FAULT, JSON.stringify({ path: '/api/hub/discovery', method: 'GET', status: 500, type: 'application/json', body: '{"error":"Failed to load discovery"}' }));
  await page.goto(`${BASE}/app/hub`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const rail = page.locator('h2:has-text("Discover")').locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]');
  await rail.scrollIntoViewIfNeeded();
  const out = [`with 500: ${(await rail.innerText()).split('\n').filter(Boolean).join(' | ')}`];
  await shot(page, `${label}-failed`);
  fs.unlinkSync(FAULT);
  const retry = rail.getByRole('button', { name: 'Try again' });
  if (await retry.count()) {
    await retry.click();
    await page.waitForTimeout(5000);
    out.push(`after fault off + Try again: ${(await rail.innerText()).split('\n').filter(Boolean).slice(0, 12).join(' | ')}`);
    await shot(page, `${label}-retried`);
  } else {
    out.push('no Try again offered');
  }
  fs.writeFileSync(`${OUT}/${label}-c12.txt`, out.join('\n') + '\n');
  console.log(out.join('\n'));
  await browser.close();
})().catch((e) => { try { fs.unlinkSync(FAULT); } catch {} console.error('ERR', e.message); process.exit(1); });
