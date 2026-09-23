// D10: the owner deletes the disposable household from My Homes (real web UI), confirming the dialog.
const w = require('./web-lib.cjs'); const fs = require('fs');
(async () => {
  const [who, shotPrefix] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, who); const page = await ctx.newPage();
  const calls = [];
  page.on('response', (r) => { const u = r.url(); if (r.request().method() === 'DELETE' && u.includes('/api/homes/')) calls.push(`${r.status()} DELETE ${u.replace(/.*\/api\/homes\//, '/api/homes/')}`); });
  await page.goto(w.WEB + '/app/homes', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  const before = await page.innerText('body');
  await page.screenshot({ path: `${w.OUT}/${shotPrefix}-a-my-homes.png`, fullPage: true });
  const btn = page.getByRole('button', { name: 'Delete home' }).first();
  const hasDelete = await btn.count();
  if (hasDelete) {
    await btn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${w.OUT}/${shotPrefix}-b-confirm.png`, fullPage: false });
    const dialogText = await page.innerText('body');
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${w.OUT}/${shotPrefix}-c-after.png`, fullPage: true });
    const after = await page.innerText('body');
    console.log(JSON.stringify({ who, listedBefore: before.includes('Stream2 D10 home'), confirmText: (dialogText.match(/Delete this home\?[^\n]*\n?[^\n]*/) || [''])[0], deleteCalls: calls, listedAfter: after.includes('Stream2 D10 home'), toast: (after.match(/(Failed[^\n]*|HOME_DELETE[^\n]*|cannot[^\n]*|Remove[^\n]*first[^\n]*)/i) || [null])[0] }));
  } else console.log(JSON.stringify({ who, hasDelete: 0, listedBefore: before.includes('Stream2 D10 home') }));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
