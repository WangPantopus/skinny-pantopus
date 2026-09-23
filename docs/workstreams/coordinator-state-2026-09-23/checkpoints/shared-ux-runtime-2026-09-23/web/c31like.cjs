// node c31like.cjs <label> <postId> : with POST /api/posts/<id>/like failing (500), tap the like; record the like count and any toast.
const fs = require('fs');
const { BASE, OUT, open, login, shot } = require('./lib.cjs');
const FAULT = '/private/tmp/pantopus-shared-ux-runtime/fault.json';
const [label, postId] = process.argv.slice(2);
(async () => {
  const { browser, page } = await open();
  await login(page, 'alice');
  await page.goto(`${BASE}/app/feed/post/${postId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  fs.writeFileSync(FAULT, JSON.stringify({ path: `/api/posts/${postId}/like`, method: 'POST', status: 500, body: '{"error":"Failed to toggle like"}' }));
  const likeBtn = page.getByText(/\d+ likes?/).first();
  const before = await likeBtn.innerText();
  await likeBtn.click();
  await page.waitForTimeout(1200);
  const toastText = await page.getByText("Couldn't update your like").count();
  await shot(page, `${label}-like-failed`);
  await page.waitForTimeout(2500);
  const after = await page.getByText(/\d+ likes?/).first().innerText();
  fs.unlinkSync(FAULT);
  const out = `like label before: ${before}\nlike label after failed tap: ${after}\nerror toast shown: ${toastText > 0}\n`;
  fs.writeFileSync(`${OUT}/${label}-c31like.txt`, out);
  console.log(out);
  await browser.close();
})().catch((e) => { try { fs.unlinkSync(FAULT); } catch {} console.error('ERR', e.message); process.exit(1); });
