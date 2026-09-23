// Web Mail Day settings: toggle "Business" and press Save Settings; record the PATCH status and whether the
// page confirms or reports anything. Prints no tokens.
const w = require('./web-lib.cjs');
(async () => {
  const [who, shot] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, who); const page = await ctx.newPage();
  const patches = [];
  page.on('response', (r) => { if (r.request().method() === 'PATCH' && r.url().includes('/mailday/settings')) patches.push(r.status()); });
  await page.goto(w.WEB + '/app/mailbox/settings/mail-day', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  const row = page.locator('label', { hasText: 'Business' }).first();
  const sw = row.locator('button[role="switch"]');
  const before = await sw.getAttribute('aria-checked');
  await sw.click();
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelectorAll('.overflow-y-auto').forEach((e) => { e.scrollTop = 0; }));
  await page.waitForTimeout(200);
  const body = await page.innerText('body');
  console.log(JSON.stringify({ who, businessBefore: before, patchStatuses: patches, savedToast: body.includes('Settings saved'), errorShown: /fail|error|could not|couldn/i.test(body.replace(/Neighborhood notices[\s\S]*/,'')) }));
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png`, fullPage: true });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
