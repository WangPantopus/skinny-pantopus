// mail_extracted send fix: open each web-composed letter in another member's web Home Mailbox and print the detail.
const w = require('./web-lib.cjs');
(async () => {
  const [who, shotPrefix] = process.argv.slice(2);
  const HOME = 'f0e51100-0000-4000-8000-000000000200';
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  await page.goto(`${w.WEB}/app/mailbox?scope=home&homeId=${HOME}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);
  for (const label of ['BASELINE master', 'AFTER fix']) {
    await page.getByText(`Stream2 S web compose ${label}`, { exact: true }).first().click();
    await page.waitForTimeout(3000);
    if (shotPrefix) await page.screenshot({ path: `${w.OUT}/${shotPrefix}-${label.startsWith('B') ? 'baseline' : 'after'}.png` });
    const text = (await page.innerText('body')).split('\n').map(s => s.trim()).filter(Boolean);
    const i = text.findIndex((l, k) => l === `Stream2 S web compose ${label}` && k > text.indexOf('Archived'));
    console.log(`## ${who} opens "Stream2 S web compose ${label}"`);
    console.log(text.slice(Math.max(0, i - 6), i + 10).join(' | '));
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
