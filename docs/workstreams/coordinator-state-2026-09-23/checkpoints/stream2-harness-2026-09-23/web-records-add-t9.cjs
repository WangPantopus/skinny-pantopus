// Route-drift item 2: web Mailbox → Records → "Add asset manually" → Create Asset.
const w = require('./web-lib.cjs'); const fs = require('fs');
(async () => {
  const [who, name, category, label, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const log = [];
  page.on('response', async (resp) => {
    const u = resp.url().replace(w.WEB, '');
    if (resp.request().method() === 'POST' && /assets/.test(u)) {
      let body = null; try { body = await resp.json(); } catch (_) {}
      log.push(`POST ${u.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/, '<home>')} ${resp.status()}${body?.error ? ' ' + body.error : ''}`);
      if (body?.asset?.id) fs.appendFileSync(__dirname + '/work/t9-created-assets.txt', body.asset.id + '\n');
    }
  });
  await page.goto(`${w.WEB}/app/mailbox/records`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.getByText('Add asset manually').click();
  await page.waitForTimeout(800);
  await page.getByPlaceholder('e.g. Samsung 55" QLED TV').fill(name);
  if (category) await page.locator('select').first().selectOption(category);
  await page.getByPlaceholder('e.g. Living Room').fill('Kitchen');
  await page.getByPlaceholder('e.g. Samsung', { exact: true }).fill('Stream2 Brand');
  await page.getByPlaceholder('e.g. QN55Q80C').fill('S2-RD-100');
  await page.getByRole('button', { name: 'Create Asset' }).click();
  await page.waitForTimeout(4000);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  const text = (await page.innerText('main').catch(() => page.innerText('body'))).split('\n').map(s => s.trim()).filter(Boolean);
  console.log(`# web ${who}: Records → Add asset manually → "${name}" (${category || 'appliance'}) → Create Asset [${label}]`);
  for (const l of log) console.log(l);
  const i = text.findIndex(l => l.includes(name));
  console.log('page after: ' + (i >= 0 ? text.slice(Math.max(0, i - 2), i + 6).join(' | ') : text.slice(0, 20).join(' | ')));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
