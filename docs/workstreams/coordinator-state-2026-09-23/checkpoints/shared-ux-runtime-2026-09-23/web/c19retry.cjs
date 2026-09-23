// node c19retry.cjs <label> <postId> : with the comments fault active, open the post; then turn the fault off and press the comments "Try again".
const fs = require('fs');
const { BASE, OUT, open, login, shot } = require('./lib.cjs');
const FAULT = '/private/tmp/pantopus-shared-ux-runtime/fault.json';
const [label, postId] = process.argv.slice(2);
(async () => {
  const { browser, page } = await open();
  await login(page, 'alice');
  fs.writeFileSync(FAULT, JSON.stringify({ path: `/api/posts/${postId}/comments`, method: 'GET', status: 500, type: 'application/json', body: '{"error":"Failed to load comments"}' }));
  await page.goto(`${BASE}/app/feed/post/${postId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const section = page.locator('h3:has-text("Comments")').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  const before = (await section.innerText()).split('\n').filter(Boolean).slice(0, 4).join(' | ');
  await section.scrollIntoViewIfNeeded();
  await shot(page, `${label}-failed`);
  fs.unlinkSync(FAULT);
  await section.getByRole('button', { name: 'Try again' }).click();
  await page.waitForTimeout(4000);
  const after = (await section.innerText()).split('\n').filter(Boolean).slice(0, 4).join(' | ');
  await shot(page, `${label}-retried`);
  const out = `comments section with fault: ${before}\ncomments section after fault off + Try again: ${after}\n`;
  fs.writeFileSync(`${OUT}/${label}-c19retry.txt`, out);
  console.log(out);
  await browser.close();
})().catch((e) => { try { fs.unlinkSync(FAULT); } catch {} console.error('ERR', e.message); process.exit(1); });
