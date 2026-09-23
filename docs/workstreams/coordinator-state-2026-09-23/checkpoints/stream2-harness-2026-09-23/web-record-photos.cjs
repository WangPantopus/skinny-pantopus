// Web record page photos (S2-02 part B): as <who>, open the fixture record "Stream2 RD washer", report the Add photo
// button and the photos that actually load (img naturalWidth > 0), then (owner) add a photo through the page's file
// input and try a text file named .jpg. Signed photo URLs are never printed. Usage: node web-record-photos.cjs <who> <label> <shot>
const w = require('./web-lib.cjs'); const fs = require('fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const ASSET = sql(`select id from "HomeAsset" where home_id='f0e51100-0000-4000-8000-000000000200' and name='Stream2 RD washer'`);
(async () => {
  const [who, label, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const posts = [];
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST' || !r.url().includes('/photos')) return;
    let j = null; try { j = await r.json(); } catch (_) {}
    if (j && j.photo && j.photo.id) fs.appendFileSync(__dirname + '/work/t32-photo-ids.txt', j.photo.id + '\n');
    posts.push(`POST .../records/asset/<washer>/photos ${r.status()}${j && j.error ? ' ' + JSON.stringify(j.error) : ''}`);
  });
  const state = async (tag) => {
    await page.waitForTimeout(2500);
    const addBtn = await page.getByRole('button', { name: /Add photo|Uploading/ }).count();
    const imgs = await page.$$eval('img', (els) => els.filter((e) => (e.getAttribute('src') || '').includes('/storage/v1/object/'))
      .map((e) => ({ loaded: e.complete && e.naturalWidth > 0, signed: (e.getAttribute('src') || '').includes('/object/sign/') })));
    const alert = await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
    console.log(`${tag}: Add photo button ${addBtn ? 'shown' : 'not shown'}; photo images ${imgs.length} (loaded ${imgs.filter((i) => i.loaded).length}, signed ${imgs.filter((i) => i.signed).length})${alert.length ? '; alert ' + JSON.stringify(alert) : ''}`);
  };
  await page.goto(`${w.WEB}/app/mailbox/records/${ASSET}`, { waitUntil: 'networkidle', timeout: 120000 });
  console.log(`# web ${who}: /app/mailbox/records/<washer> [${label}]`);
  await state('opened');
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-opened.png` });
  if (await page.getByRole('button', { name: 'Add photo' }).count()) {
    await page.locator('input[type="file"]').setInputFiles(__dirname + '/work/t32/washer.jpg');
    await state('after choosing washer.jpg');
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-added.png` });
    await page.locator('input[type="file"]').setInputFiles({ name: 'not-a-photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('this is text, not a JPEG image\n'.repeat(10)) });
    await state('after choosing a text file named .jpg');
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-rejected.png` });
  }
  console.log(`requests: ${JSON.stringify(posts)}`);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
