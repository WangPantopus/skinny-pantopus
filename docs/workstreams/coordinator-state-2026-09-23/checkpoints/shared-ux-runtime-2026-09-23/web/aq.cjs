// node aq.cjs <label> [faultsJson] : sign in as alice, open /app/hub, record the Action Queue items (optionally with backend faults).
const fs = require('fs');
const { BASE, OUT, open, login, shot } = require('./lib.cjs');
const FAULT = '/private/tmp/pantopus-shared-ux-runtime/fault.json';
const [label, faults] = process.argv.slice(2);
(async () => {
  const { browser, page } = await open();
  await login(page, 'alice');
  if (faults) fs.writeFileSync(FAULT, faults);
  await page.goto(`${BASE}/app/hub`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const card = page.locator('h3:has-text("Action Queue")').locator('xpath=..');
  await card.scrollIntoViewIfNeeded();
  const items = (await card.locator('button').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  await shot(page, `${label}-aq`);
  if (faults) fs.unlinkSync(FAULT);
  const out = `faults: ${faults || 'none'}\naction queue items: ${JSON.stringify(items)}\n`;
  fs.writeFileSync(`${OUT}/${label}-aq.txt`, out);
  console.log(out);
  await browser.close();
})().catch((e) => { try { fs.unlinkSync(FAULT); } catch {} console.error('ERR', e.message); process.exit(1); });
