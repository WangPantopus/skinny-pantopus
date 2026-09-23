// PR X web check: open a mailbox item through the real web item page and record the v2 item calls.
const w = require('./web-lib.cjs');
(async () => {
  const [who, drawer, itemId, shot] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, who); const page = await ctx.newPage();
  const log = [];
  page.on('response', (resp) => {
    const u = resp.url().replace(w.WEB, '');
    if (!/\/api\/mailbox\//.test(u)) return;
    log.push(`${resp.request().method()} ${u} ${resp.status()}`);
  });
  await page.goto(`${w.WEB}/app/mailbox/${drawer}/${itemId}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3500);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png`, fullPage: false });
  const text = (await page.innerText('main').catch(() => page.innerText('body'))).replace(/\n{2,}/g, '\n');
  console.log(`# web ${who} opens /app/mailbox/${drawer}/<${itemId.slice(0, 8)}>`);
  for (const l of log) console.log(l.replace(itemId, `<${itemId.slice(0, 8)}>`));
  console.log('--- page text (first 700 chars)\n' + text.slice(0, 700));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
