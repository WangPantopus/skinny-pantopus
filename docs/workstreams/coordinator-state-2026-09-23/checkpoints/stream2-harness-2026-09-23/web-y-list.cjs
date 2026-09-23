// PR Y web check: the real web Home mailbox (/app/mailbox?scope=home&homeId=…, v1 list) for one account; lists
// which "Stream2 Y" letters the page shows and the list request's status.
const w = require('./web-lib.cjs');
(async () => {
  const [who, shot] = process.argv.slice(2);
  const HOME = 'f0e51100-0000-4000-8000-000000000200';
  const b = await w.browser(); const ctx = await w.signedInContext(b, who); const page = await ctx.newPage();
  const log = [];
  page.on('response', (resp) => { const u = resp.url().replace(w.WEB, ''); if (/\/api\/mailbox(\?|\/)/.test(u) && !/v2\/p3/.test(u)) log.push(`${resp.request().method()} ${u.replace(HOME, '<home>')} ${resp.status()}`); });
  await page.goto(`${w.WEB}/app/mailbox?scope=home&homeId=${HOME}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(4000);
  const text = await page.innerText('body');
  const seen = [...new Set(text.split('\n').map(s => s.trim()).filter(s => s.startsWith('Stream2 Y')))];
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png`, fullPage: true });
  console.log(`# web ${who}: /app/mailbox?scope=home&homeId=<home>`);
  for (const l of log.filter(l => /\/api\/mailbox\?/.test(l))) console.log(l);
  console.log('Stream2 Y letters shown:\n  ' + (seen.join('\n  ') || '(none)'));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
