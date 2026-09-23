// node c31.cjs <label> <postId> : on the post page, (1) post a comment with Send, then try deleting it; (2) press Ctrl+Enter twice on a new draft.
const fs = require('fs');
const { BASE, OUT, open, login, shot } = require('./lib.cjs');
const [label, postId] = process.argv.slice(2);
(async () => {
  const { browser, page, requests } = await open();
  await login(page, 'alice');
  await page.goto(`${BASE}/app/feed/post/${postId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const out = [];
  const box = page.getByPlaceholder('Add a comment, emoji, or photo…');
  const tag = `${label}-${Date.now().toString(36)}`;
  // (1) delete flow
  await box.fill(`sux delete check ${tag}`);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForTimeout(3000);
  const row = page.getByText(`sux delete check ${tag}`).first();
  out.push(`posted: ${await row.count() > 0}`);
  const commentBlock = row.locator('xpath=ancestor::div[.//button[normalize-space()="Delete"]][1]');
  await commentBlock.getByRole('button', { name: 'Delete', exact: true }).first().click();
  await page.waitForTimeout(1500);
  const dialog = page.getByText('Delete this comment?');
  const hasDialog = (await dialog.count()) > 0;
  out.push(`confirm dialog after Delete: ${hasDialog}`);
  await shot(page, `${label}-after-delete-click`);
  if (hasDialog) {
    await page.getByRole('button', { name: 'Cancel' }).first().click();
    await page.waitForTimeout(1000);
    out.push(`after Cancel, comment still shown: ${(await page.getByText(`sux delete check ${tag}`).count()) > 0}`);
    await commentBlock.getByRole('button', { name: 'Delete', exact: true }).first().click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await page.waitForTimeout(2500);
  }
  out.push(`comment gone at end: ${(await page.getByText(`sux delete check ${tag}`).count()) === 0}`);
  // (2) double submit
  await box.fill(`sux double submit ${tag}`);
  await box.focus();
  await page.keyboard.press('Control+Enter');
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(4000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  const copies = await page.getByText(`sux double submit ${tag}`).count();
  out.push(`double Ctrl+Enter -> copies after reload: ${copies}`);
  await shot(page, `${label}-after-double-submit`);
  const posts = requests.filter((r) => r.method === 'POST' && r.path.endsWith('/comments')).length;
  const dels = requests.filter((r) => r.method === 'DELETE' && r.path.includes('/comments/')).length;
  out.push(`POST comments: ${posts}, DELETE comments: ${dels}, tag ${tag}`);
  fs.writeFileSync(`${OUT}/${label}-c31.txt`, out.join('\n') + '\n');
  console.log(out.join('\n'));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
