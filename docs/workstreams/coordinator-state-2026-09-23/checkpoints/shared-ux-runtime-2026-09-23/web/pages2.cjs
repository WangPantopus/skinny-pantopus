// node pages2.cjs <label> <path...> : sign in as alice, then visit each path; save text + shot, note API 4xx/5xx.
const fs = require('fs');
const { BASE, OUT, open, login, shot } = require('./lib.cjs');
const [label, ...paths] = process.argv.slice(2);
(async () => {
  const { browser, page, requests } = await open();
  await login(page, 'alice');
  const out = [];
  for (const [i, p] of paths.entries()) {
    const start = requests.length;
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    const t = await page.locator('body').innerText();
    await shot(page, `${label}-page${i}`);
    const bad = requests.slice(start).filter((r) => r.status >= 400).map((r) => `${r.method} ${r.path} ${r.status}`);
    out.push(`== ${p}\nlanded: ${page.url()}\napi 4xx/5xx: ${JSON.stringify(bad)}\n${t.split('\n').filter(Boolean).slice(0, 10).join(' | ')}\n`);
  }
  fs.writeFileSync(`${OUT}/${label}-pages.txt`, out.join('\n'));
  console.log(out.join('\n'));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
