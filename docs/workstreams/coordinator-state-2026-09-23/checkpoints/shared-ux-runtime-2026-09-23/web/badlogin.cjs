const { chromium } = require('/private/tmp/pantopus-shared-ux-edit/frontend/apps/web/node_modules/@playwright/test');
const { BASE, shot } = require('./lib.cjs');
const fs = require('fs');
const label = process.argv[2];
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('you@example.com').fill('sux.alice.0923@example.com');
  await page.getByPlaceholder('Your password').fill('definitely-not-the-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForTimeout(4000);
  await shot(page, `${label}-badlogin`);
  const t = await page.locator('body').innerText();
  const lines = t.split('\n').filter((l) => /invalid|incorrect|password|wrong|went wrong/i.test(l));
  fs.writeFileSync(`/private/tmp/pantopus-shared-ux-runtime/web/out/${label}-badlogin.txt`, lines.join('\n') + '\n');
  console.log(JSON.stringify(lines));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
