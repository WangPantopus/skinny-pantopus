// Route-drift item 1: the web Counter page (/app/mailbox/counter) and the MailboxNav Counter badge.
const w = require('./web-lib.cjs');
(async () => {
  const [who, label, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const log = [];
  page.on('response', (resp) => { const u = resp.url().replace(w.WEB, ''); if (/\/api\/mailbox\/v2\/(counter|drawer\/[a-z]+\?[^ ]*tab=counter)/.test(u)) log.push(`${resp.request().method()} ${u} ${resp.status()}`); });
  await page.goto(`${w.WEB}/app/mailbox/counter`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(4000);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  const text = (await page.innerText('body')).split('\n').map(s => s.trim()).filter(Boolean);
  const i = text.indexOf('Needs Attention');
  console.log(`# web ${who}: /app/mailbox/counter [${label}] ${new Date().toISOString()}`);
  for (const l of [...new Set(log)]) console.log(l);
  console.log('page: ' + text.slice(i, i + 12).join(' | '));
  const nav = text.findIndex(l => l === 'Counter');
  console.log('nav Counter row: ' + text.slice(nav, nav + 2).join(' | '));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
