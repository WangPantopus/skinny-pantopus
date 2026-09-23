// Open one web page as an account and print its API requests and visible text.
const w = require('./web-lib.cjs');
(async () => {
  const [who, path, match, shot, wait] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const log = [];
  page.on('response', async (resp) => { const u = resp.url().replace(w.WEB, ''); if (!new RegExp(match).test(u)) return; let err = ''; if (resp.status() >= 400) { try { const j = await resp.json(); err = ' ' + (j.error || j.message || ''); } catch (_) {} } log.push(`${resp.request().method()} ${u.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (x) => '<' + x.slice(0, 8) + '>')} ${resp.status()}${err}`); });
  await page.goto(w.WEB + path, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(Number(wait || 4000));
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  const t = (await page.innerText('body')).split('\n').map(s => s.trim()).filter(Boolean);
  console.log(`# web ${who}: ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (x) => '<' + x.slice(0, 8) + '>')}`);
  for (const l of [...new Set(log)]) console.log('  ' + l);
  const i = Math.max(0, t.findIndex(l => l === 'Travel Mode') + 1);
  console.log('  page: ' + t.slice(i, i + 16).join(' | ').slice(0, 700));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
