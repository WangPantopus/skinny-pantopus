// node discover2.cjs <label> : sign in as alice, Hub Discover → each filter tab → tap the first item; record where it lands.
const fs = require('fs');
const { BASE, OUT, open, login, shot } = require('./lib.cjs');
const label = process.argv[2];
(async () => {
  const { browser, page, requests } = await open();
  await login(page, 'alice');
  const log = [];
  for (const tab of ['Businesses', 'People', 'Tasks', 'Posts']) {
    await page.goto(`${BASE}/app/hub`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    const rail = page.locator('h2:has-text("Discover")').locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]');
    const tabBtn = rail.getByRole('button', { name: tab, exact: true }).first();
    await tabBtn.scrollIntoViewIfNeeded();
    await tabBtn.click();
    await page.waitForTimeout(5000);
    const railText = (await rail.innerText().catch(() => '')).split('\n').filter(Boolean).join(' | ');
    await shot(page, `${label}-rail-${tab.toLowerCase()}`);
    log.push(`## ${tab}\nrail: ${railText}`);
    const first = rail.locator('div.rounded-xl > button').first();
    if (await first.count() === 0) { log.push('no items to tap\n'); continue; }
    await first.click();
    await page.waitForTimeout(7000);
    const main = await page.locator('main').first().innerText({ timeout: 5000 }).catch(async () => page.locator('body').innerText());
    await shot(page, `${label}-landed-${tab.toLowerCase()}`);
    log.push(`landed: ${page.url()}\npage: ${main.split('\n').filter(Boolean).slice(0, 14).join(' | ')}\n`);
  }
  const bad = requests.filter((r) => r.status >= 400).map((r) => `${r.method} ${r.path} ${r.status}`);
  log.push(`api 4xx/5xx: ${JSON.stringify(bad)}`);
  fs.writeFileSync(`${OUT}/${label}-discover.txt`, log.join('\n') + '\n');
  console.log(log.join('\n'));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
