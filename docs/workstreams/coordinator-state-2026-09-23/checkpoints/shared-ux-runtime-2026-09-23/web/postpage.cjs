// node postpage.cjs <label> <postId> : sign in as alice, open the post page; record the visible state (and API 4xx/5xx).
const fs = require('fs');
const { BASE, OUT, open, login, shot } = require('./lib.cjs');
const [label, postId] = process.argv.slice(2);
(async () => {
  const { browser, page, requests } = await open();
  await login(page, 'alice');
  const start = requests.length;
  await page.goto(`${BASE}/app/feed/post/${postId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const body = (await page.locator('main').first().innerText().catch(async () => page.locator('body').innerText()))
    .split('\n').filter(Boolean).slice(0, 18).join(' | ');
  await shot(page, `${label}-postpage`);
  const reqs = requests.slice(start).filter((r) => r.path.includes('/api/posts/')).map((r) => `${r.method} ${r.path.replace(postId, '<post>')} ${r.status}`);
  const out = `page: ${body}\nposts API calls: ${JSON.stringify(reqs)}\n`;
  fs.writeFileSync(`${OUT}/${label}-postpage.txt`, out);
  console.log(out);
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
