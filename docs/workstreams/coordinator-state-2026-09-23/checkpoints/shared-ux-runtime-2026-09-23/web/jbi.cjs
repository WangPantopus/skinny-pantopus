// node jbi.cjs <label> : sign in as alice, open /app/hub, record the "Jump Back In" tiles (text + whether each has an svg icon).
const fs = require('fs');
const { BASE, OUT, open, login, shot } = require('./lib.cjs');
const label = process.argv[2];
(async () => {
  const { browser, page } = await open();
  await login(page, 'alice');
  await page.goto(`${BASE}/app/hub`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const section = page.locator('h2:has-text("Jump Back In")').locator('xpath=..');
  await section.scrollIntoViewIfNeeded();
  const tiles = section.locator('button');
  const n = await tiles.count();
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = tiles.nth(i);
    const text = (await t.innerText()).replace(/\s+/g, ' ').trim();
    const svg = await t.locator('svg').count();
    out.push(`tile ${i + 1}: "${text}" svgIcon=${svg > 0}`);
  }
  await shot(page, `${label}-jbi`);
  fs.writeFileSync(`${OUT}/${label}-jbi.txt`, out.join('\n') + '\n');
  console.log(out.join('\n'));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
