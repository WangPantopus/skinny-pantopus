// node railtabs.cjs <label> : sign in as alice, open /app/hub, record the Discover rail's tab labels (and the People tab's content if present).
const fs = require('fs');
const { BASE, OUT, open, login, shot } = require('./lib.cjs');
const label = process.argv[2];
(async () => {
  const { browser, page } = await open();
  await login(page, 'alice');
  await page.goto(`${BASE}/app/hub`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const rail = page.locator('h2:has-text("Discover")').locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]');
  await rail.scrollIntoViewIfNeeded();
  const tabs = await rail.locator('div.flex.gap-1\\.5 > button').allInnerTexts();
  const out = [`Discover tabs: ${JSON.stringify(tabs)}`];
  const people = rail.getByRole('button', { name: 'People', exact: true });
  if (await people.count()) {
    await people.first().click();
    await page.waitForTimeout(5000);
    out.push(`People tab content: ${(await rail.innerText()).split('\n').filter(Boolean).slice(-2).join(' | ')}`);
  }
  await shot(page, `${label}-rail`);
  fs.writeFileSync(`${OUT}/${label}-railtabs.txt`, out.join('\n') + '\n');
  console.log(out.join('\n'));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
