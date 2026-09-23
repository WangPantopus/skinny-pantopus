// Route-drift item 4: Map → select a pin → "Add to Calendar".
const w = require('./web-lib.cjs');
(async () => {
  const [who, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const log = [];
  page.on('response', (resp) => { const u = resp.url().replace(w.WEB, ''); if (/map\/pin\/[^/]+\/calendar/.test(u)) log.push(`${resp.request().method()} ${u.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/, '<pin>')} ${resp.status()}`); });
  await page.goto(`${w.WEB}/app/mailbox/map`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(4000);
  const markers = page.locator('.leaflet-marker-icon');
  const n = await markers.count();
  let opened = false;
  for (let i = 0; i < n && !opened; i++) {
    await markers.nth(i).click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
    opened = (await page.getByRole('button', { name: /Add to Calendar/ }).count()) > 0;
  }
  console.log(`# web ${who}: Map (${n} markers) → pin sheet ${opened ? 'opened' : 'not opened'}`);
  if (!opened) { await b.close(); return; }
  const title = ((await page.innerText('body')).split('\n').find(l => l.startsWith('Stream2 RD')) || '').trim();
  await page.getByRole('button', { name: /Add to Calendar/ }).first().click();
  await page.waitForTimeout(3000);
  const btn = await page.getByRole('button', { name: /Add(ed)? to Calendar|Adding/ }).first().innerText().catch(() => '-');
  console.log(`  pin: ${title}`);
  for (const l of log) console.log('  ' + l);
  console.log(`  button after the click: "${btn}"`);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
