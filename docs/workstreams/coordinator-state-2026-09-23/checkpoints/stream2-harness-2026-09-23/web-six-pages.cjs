// Six-stub PR evidence: the web mailbox Home pages (records, asset detail, community, map, tasks, travel).
// Records each page's Home-scoped requests (status) and the visible text around the content.
const w = require('./web-lib.cjs'); const fs = require('fs');
const H = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [who, label, prefix] = process.argv.slice(2);
  const assetId = fs.readFileSync(__dirname + '/work/rd-created-assets.txt', 'utf8').trim().split('\n').pop();
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  let log = [];
  page.on('response', async (resp) => {
    const u = resp.url().replace(w.WEB, '');
    if (!/\/api\/(mailbox\/v2\/p3\/(records|community|map|tasks|vacation)|homes\/(primary|[0-9a-f-]{36}\/assets))/.test(u)) return;
    let err = ''; if (resp.status() >= 400) { try { const j = await resp.json(); err = ' ' + (j.error || j.message || ''); } catch (_) {} }
    log.push(`${resp.request().method()} ${u.replace(H, '<home>').replace(assetId, '<asset>')} ${resp.status()}${err}`);
  });
  const text = async () => (await page.innerText('main').catch(() => page.innerText('body'))).split('\n').map(s => s.trim()).filter(Boolean);
  const pages = [
    ['records', '/app/mailbox/records', async () => {}],
    ['asset detail', `/app/mailbox/records/${assetId}`, async () => {}],
    ['community', '/app/mailbox/community', async () => {}],
    ['map', '/app/mailbox/map', async () => { const pin = page.locator('.leaflet-marker-icon'); console.log(`  map markers drawn: ${await pin.count()}`); }],
    ['tasks', '/app/mailbox/tasks', async () => {}],
    ['travel', '/app/mailbox/travel', async () => {
      const d = new Date(); const iso = (x) => x.toISOString().slice(0, 10);
      const dates = page.locator('input[type="date"]');
      if (await dates.count() >= 2) {
        await dates.nth(0).fill(iso(new Date(d.getTime() + 7 * 864e5)));
        await dates.nth(1).fill(iso(new Date(d.getTime() + 10 * 864e5)));
        await page.getByRole('button', { name: 'Set Travel Mode' }).click();
        await page.waitForTimeout(3000);
      } else console.log('  (no travel form: a hold may already be set)');
    }],
  ];
  console.log(`# web ${who}: six mailbox Home pages [${label}] ${new Date().toISOString()}`);
  for (const [name, path, act] of pages) {
    log = [];
    await page.goto(w.WEB + path, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(3000);
    console.log(`\n## ${name} (${path.replace(assetId, '<asset>')})`);
    await act();
    for (const l of [...new Set(log)]) console.log('  ' + l);
    const t = await text();
    const start = Math.max(0, t.findIndex(l => /Home Records|Stream2 RD washer|Community|Mailbox Map|Tasks|Travel|Neighborhood|Needs|No /i.test(l)));
    console.log('  page: ' + t.slice(start, start + 14).join(' | ').slice(0, 600));
    if (prefix) await page.screenshot({ path: `${w.OUT}/${prefix}-${name.replace(' ', '-')}.png` });
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
