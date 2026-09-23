// Web Travel Mode (Mailbox > Travel Mode, /app/mailbox/travel) date fields in a far-east time zone (UTC+14), where the
// local date is a day ahead of UTC: reports each date input's min, fills Departure with the local yesterday, and reads
// the page's own validation. Nothing is submitted. Usage: node web-travel-dates.cjs <who> <label> <shot>
const w = require('./web-lib.cjs');
(async () => {
  const [who, label, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome', timezoneId: 'Pacific/Kiritimati' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  await page.goto(`${w.WEB}/app/mailbox/travel`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
  const localToday = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const utcToday = new Date().toISOString().slice(0, 10);
  const inputs = page.locator('input[type="date"]');
  const n = await inputs.count();
  const mins = []; for (let i = 0; i < n; i++) mins.push(await inputs.nth(i).getAttribute('min'));
  console.log(`# web ${who}: /app/mailbox/travel in Pacific/Kiritimati (UTC+14) [${label}]`);
  console.log(`browser local date ${localToday}; UTC date ${utcToday}; date inputs ${n}; min attributes ${JSON.stringify(mins)}; values ${JSON.stringify(await inputs.evaluateAll((els) => els.map((e) => e.value)))}`);
  if (n >= 2) {
    const y = new Date(localToday + 'T00:00:00Z'); y.setUTCDate(y.getUTCDate() - 1); const yesterday = y.toISOString().slice(0, 10);
    const r = new Date(localToday + 'T00:00:00Z'); r.setUTCDate(r.getUTCDate() + 5); const ret = r.toISOString().slice(0, 10);
    await inputs.nth(0).fill(yesterday); await inputs.nth(1).fill(ret);
    await page.waitForTimeout(800);
    const err = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => /Departure must|Return date must/.test(l));
    const btn = page.getByRole('button', { name: /Set Travel Mode|Activate|Start/ }).first();
    const enabled = (await btn.count()) ? await btn.isEnabled() : 'n/a';
    console.log(`Departure = local yesterday ${yesterday}, Return ${ret}: validation ${JSON.stringify(err)}; submit enabled: ${enabled}`);
  }
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
