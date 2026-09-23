// mail_extracted send fix: how the web-composed letter appears in another member's web Home Mailbox (sender line).
const w = require('./web-lib.cjs');
(async () => {
  const [who, label, shot] = process.argv.slice(2);
  const HOME = 'f0e51100-0000-4000-8000-000000000200';
  const b = await w.browser(); const ctx = await w.signedInContext(b, who); const page = await ctx.newPage();
  await page.goto(`${w.WEB}/app/mailbox?scope=home&homeId=${HOME}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3500);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  const lines = (await page.innerText('body')).split('\n').map(s => s.trim()).filter(Boolean);
  console.log(`# web ${who}: Home Mailbox rows for "Stream2 S web compose" [${label}]`);
  lines.forEach((l, i) => { if (l.startsWith('Stream2 S web compose')) console.log(`  sender row: ${lines[i - 2] || ''} | ${lines[i - 1] || ''} | subject: ${l}`); });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
