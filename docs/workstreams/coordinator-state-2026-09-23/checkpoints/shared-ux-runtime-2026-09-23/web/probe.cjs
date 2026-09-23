const { chromium } = require('/private/tmp/pantopus-shared-ux-edit/frontend/apps/web/node_modules/@playwright/test');
const { BASE, shot } = require('./lib.cjs');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: '/private/tmp/pantopus-shared-ux-runtime/web/.alice-state.json' });
  const page = await context.newPage();
  await page.goto(`${BASE}/app/hub`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.getByRole('button', { name: 'Quick actions' }).click();
  await page.getByText('Post to Pulse', { exact: true }).click();
  await page.waitForTimeout(2000);
  await shot(page, 'probe-composer');
  const html = await page.locator('div.fixed').filter({ hasText: 'Post to Pulse' }).last().innerHTML().catch(()=>'');
  console.log(html.replace(/class="[^"]*"/g,'').slice(0, 3000));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
