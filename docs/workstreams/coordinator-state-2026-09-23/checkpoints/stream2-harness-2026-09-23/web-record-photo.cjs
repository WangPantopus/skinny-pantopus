// Web record (asset) page: is "Add photo" offered, what happens when a photo is chosen, and does a failed
// "Link Mail Item" say so (the link request is aborted in the browser when abortLink=1).
// Usage: node web-record-photo.cjs <who> <assetId> <label> <shot> [abortLink]
const w = require('./web-lib.cjs'); const fs = require('fs');
(async () => {
  const [who, assetId, label, shot, abortLink] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const calls = [];
  page.on('response', (r) => { const u = r.url().replace(w.WEB, ''); if (/records\/asset|\/photos|\/link/.test(u) && r.request().method() !== 'GET') calls.push(`${r.request().method()} ${u.split('?')[0]} ${r.status()}`); });
  if (abortLink === '1') await page.route(/\/api\/mailbox\/v2\/p3\/records\/.*link/, (route) => route.abort('connectionrefused'));
  await page.goto(`${w.WEB}/app/mailbox/records/${assetId}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);
  const body = () => page.innerText('body').then((t) => t.split('\n').map((l) => l.trim()).filter(Boolean));
  const has = (await body()).some((l) => /Add photo/.test(l));
  console.log(`# web ${who}: record page ${assetId.slice(0, 8)} [${label}]`);
  console.log(`"Add photo" offered: ${has}`);
  if (has) {
    const tmp = __dirname + '/work/t24-photo.png';
    fs.copyFileSync(__dirname + '/work/web/t21-web-list-branch.png', tmp);
    await page.locator('input[type="file"]').first().setInputFiles(tmp);
    await page.waitForTimeout(4000);
    const after = (await body()).filter((l) => /Add photo|Uploading|photo|Photo|error|Error|failed|Failed/.test(l)).slice(0, 5);
    console.log(`after choosing a photo: requests ${JSON.stringify(calls)}; page shows ${JSON.stringify(after)}`);
  }
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  if (abortLink === '1') {
    await page.getByRole('button', { name: /Link/ }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await page.locator('div.max-w-sm button').filter({ hasText: /Stream2|Untitled/ }).first().click().catch(() => {});
    await page.waitForTimeout(2500);
    const said = (await body()).filter((l) => /Couldn't link|Network|error|Error|failed|Failed/.test(l)).slice(0, 3);
    console.log(`Link Mail Item with the request aborted: page says ${JSON.stringify(said)}`);
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-link.png` });
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
