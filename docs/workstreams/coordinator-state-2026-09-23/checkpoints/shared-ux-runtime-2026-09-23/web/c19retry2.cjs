// node c19retry2.cjs <label> <postId> : with a 503 on the post, open it; then turn the fault off and press "Try Again".
const fs = require('fs');
const { BASE, OUT, open, login, shot } = require('./lib.cjs');
const FAULT = '/private/tmp/pantopus-shared-ux-runtime/fault.json';
const [label, postId] = process.argv.slice(2);
(async () => {
  const { browser, page } = await open();
  await login(page, 'alice');
  fs.writeFileSync(FAULT, JSON.stringify({ path: `/api/posts/${postId}`, method: 'GET', status: 503, type: 'application/json', body: '{"error":"Service temporarily unavailable"}' }));
  await page.goto(`${BASE}/app/feed/post/${postId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const before = (await page.locator('main').first().innerText()).split('\n').filter(Boolean).slice(0, 5).join(' | ');
  await shot(page, `${label}-failed`);
  fs.unlinkSync(FAULT);
  await page.getByRole('button', { name: 'Try Again' }).click();
  await page.waitForTimeout(6000);
  const after = (await page.locator('main').first().innerText()).split('\n').filter(Boolean).slice(0, 8).join(' | ');
  await shot(page, `${label}-retried`);
  const out = `with 503: ${before}\nafter fault off + Try Again: ${after}\n`;
  fs.writeFileSync(`${OUT}/${label}-c19retry2.txt`, out);
  console.log(out);
  await browser.close();
})().catch((e) => { try { fs.unlinkSync(FAULT); } catch {} console.error('ERR', e.message); process.exit(1); });
