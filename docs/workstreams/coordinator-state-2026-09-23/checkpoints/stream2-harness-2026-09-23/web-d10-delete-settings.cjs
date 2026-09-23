// D10: the owner deletes the race Home from its Settings tab (success path after the fix).
const w = require('./web-lib.cjs'); const fs = require('fs');
const HOME = fs.readFileSync(__dirname + '/work/d10-race-home-id.txt', 'utf8').trim();
(async () => {
  const [shot] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, 'd10owner'); const page = await ctx.newPage();
  const calls = [];
  page.on('response', (r) => { if (r.request().method() === 'DELETE' && r.url().includes(`/api/homes/${HOME}`)) calls.push(r.status()); });
  await page.goto(w.WEB + `/app/homes/${HOME}/dashboard?tab=settings`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Delete Home' }).first().click();
  await page.waitForTimeout(400);
  const steps = page.locator('button', { hasText: /Continue|Yes|I understand|Next/ });
  if (await steps.count()) { await steps.first().click(); await page.waitForTimeout(300); }
  await page.getByPlaceholder('DELETE').fill('DELETE');
  const nextBtn = page.locator('button:not([disabled])', { hasText: /Continue|Next|Confirm/ });
  if (await nextBtn.count()) { await nextBtn.first().click(); await page.waitForTimeout(300); }
  await page.getByRole('button', { name: /Permanently Delete Home/ }).click();
  await page.waitForTimeout(3000);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png`, fullPage: false });
  console.log(JSON.stringify({ deleteStatuses: calls, landedOn: new URL(page.url()).pathname }));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
