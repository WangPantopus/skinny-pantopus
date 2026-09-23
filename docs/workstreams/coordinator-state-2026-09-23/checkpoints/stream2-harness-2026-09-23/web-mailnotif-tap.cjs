// Tap the newest "New mail arrived" notification in the web list and record where it lands.
const w = require('./web-lib.cjs');
(async () => {
  const [who, label, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const log = [];
  page.on('response', (resp) => { const u = resp.url().replace(w.WEB, ''); if (/\/api\/mailbox\/v2\/(item|drawer)\//.test(u)) log.push(`${resp.request().method()} ${u.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (x) => '<' + x.slice(0, 8) + '>')} ${resp.status()}`); });
  await page.goto(`${w.WEB}/app/notifications`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.getByText('New mail arrived', { exact: true }).first().click();
  await page.waitForTimeout(6000);
  const url = page.url().replace(w.WEB, '').replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (x) => '<' + x.slice(0, 8) + '>');
  const t = (await page.innerText('body')).split('\n').map(s => s.trim()).filter(Boolean);
  const hit = t.find(l => l.startsWith('Stream2 RD household letter')) || (t.includes('Select a mail item') ? 'Select a mail item' : '-');
  console.log(`# web ${who}: tap "New mail arrived" [${label}] → ${url}\n  shows: ${hit}`);
  for (const l of [...new Set(log)]) console.log('  ' + l);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
