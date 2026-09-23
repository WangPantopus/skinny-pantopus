// Web Mail Day settings save against a backend that refuses it: record the PATCH status and the visible feedback.
const w = require('./web-lib.cjs');
(async () => {
  const [who, shot] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, who); const page = await ctx.newPage();
  const patches = [];
  page.on('response', (r) => { if (r.request().method() === 'PATCH' && r.url().includes('/mailday/settings')) patches.push(r.status()); });
  await page.goto(w.WEB + '/app/mailbox/settings/mail-day', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  const sw = page.locator('label', { hasText: 'Business' }).first().locator('button[role="switch"]');
  await sw.click();
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await page.waitForTimeout(1200);
  const body = await page.innerText('body');
  const toastText = (body.match(/(delivery_time:[^\n]*|Please correct[^\n]*|Failed to update settings[^\n]*|Couldn't save your Mail Day settings\.[^\n]*)/) || [null])[0];
  console.log(JSON.stringify({ who, patchStatuses: patches, savedToast: body.includes('Settings saved'), errorToast: toastText }));
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png`, fullPage: false });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
