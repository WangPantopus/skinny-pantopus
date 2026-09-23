// Tap notifications in the web notification list and record where each lands.
const w = require('./web-lib.cjs');
(async () => {
  const [who, label, shotPrefix, ...titles] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  console.log(`# web ${who}: tap notifications [${label}] ${new Date().toISOString()}`);
  let n = 0;
  for (const title of titles) {
    n += 1;
    await page.goto(`${w.WEB}/app/notifications`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2500);
    const item = page.getByText(title, { exact: true }).first();
    if (!(await item.count())) { console.log(`- "${title}": not in the list`); continue; }
    await item.click();
    await page.waitForTimeout(5000);
    const url = page.url().replace(w.WEB, '').replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (x) => '<' + x.slice(0, 8) + '>');
    const t = (await page.innerText('body')).split('\n').map(s => s.trim()).filter(Boolean);
    const heading = await page.locator('h1').first().innerText().catch(() => '');
    const notFound = t.some(l => /404|could not be found|Page not found|This page/i.test(l));
    console.log(`- "${title}" → ${url}  | h1: ${heading || '-'}${notFound ? '  | NOT FOUND page' : ''}`);
    if (shotPrefix) await page.screenshot({ path: `${w.OUT}/${shotPrefix}-${n}.png` });
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
