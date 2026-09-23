// node discover.cjs <label> : Hub Discover → tap the first task tile; record where it lands.
const fs = require('fs');
const { chromium } = require('/private/tmp/pantopus-shared-ux-edit/frontend/apps/web/node_modules/@playwright/test');
const { BASE, OUT, shot } = require('./lib.cjs');
const label = process.argv[2];
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: '/private/tmp/pantopus-shared-ux-runtime/web/.alice-state.json' });
  const page = await context.newPage();
  await page.goto(`${BASE}/app/hub`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const tile = page.getByText('Hang two shelves (bid check)').first();
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await page.waitForTimeout(6000);
  const url = page.url();
  const body = (await page.locator('body').innerText()).split('\n').filter(Boolean).slice(0, 12).join(' | ');
  await shot(page, `${label}-discover-task`);
  const log = `landed: ${url}\npage: ${body}\n`;
  fs.writeFileSync(`${OUT}/${label}-discover-task.txt`, log);
  console.log(log);
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
