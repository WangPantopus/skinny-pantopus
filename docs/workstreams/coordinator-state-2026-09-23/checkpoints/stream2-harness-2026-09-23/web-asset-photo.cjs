// Route-drift item 3: web Records → asset detail → "Add photo" (file upload).
const w = require('./web-lib.cjs');
(async () => {
  const [who, assetId, label, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const log = [];
  page.on('response', async (resp) => { const u = resp.url().replace(w.WEB, ''); if (/\/api\/mailbox\/v2\/p3\/records\/asset\//.test(u)) log.push(`${resp.request().method()} ${u.replace(assetId, '<asset>')} ${resp.status()}`); });
  await page.goto(`${w.WEB}/app/mailbox/records/${assetId}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.locator('input[type="file"]').first().setInputFiles(__dirname + '/work/rd-probe-1px.png');
  await page.waitForTimeout(4000);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  const text = (await page.innerText('body')).split('\n').map(s => s.trim()).filter(Boolean);
  const i = text.findIndex(l => l.startsWith('Stream2 RD washer'));
  console.log(`# web ${who}: Records → asset "Stream2 RD washer" → Add photo (1-pixel PNG) [${label}]`);
  for (const l of [...new Set(log)]) console.log(l);
  console.log('page: ' + text.slice(i, i + 16).join(' | '));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
