// Web record page "Post Gig": before = the modal (does "Post Task" call any API?); after = the real task form,
// prefilled, posted from the member's Home (the form geocodes a Home without stored coordinates; that one
// geocoder answer is supplied in the browser). Prints requests, what the page says, and whether the task opens.
// Usage: node web-record-post-gig.cjs <who> <assetId> <before|after> <label> <shot>
const w = require('./web-lib.cjs'); const fs = require('fs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [who, assetId, mode, label, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pantopus_first_gig_shared', '1'); } catch (_) {} });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  const posts = [];
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST') return;
    const u = r.url().replace(w.WEB, '').split('?')[0];
    if (!/^\/api\/(gigs|mailbox)/.test(u)) return;
    let j = null; try { j = await r.json(); } catch (_) {}
    const id = j && j.gig && j.gig.id; if (id) fs.appendFileSync(__dirname + '/work/t25-made-gig-ids.txt', id + '\n');
    posts.push(`POST ${u} ${r.status()}${id ? ' gig=' + id.slice(0, 8) : ''}`);
  });
  await page.route('**/api/geo/autocomplete**', (route) => route.fulfill({ json: { suggestions: [
    { suggestion_id: 'stub-1', label: 'Stream2 native fixture, Vancouver WA 98660', center: { lat: 45.6387, lng: -122.6615 } }] } }));
  await page.goto(`${w.WEB}/app/mailbox/records/${assetId}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /Post Gig/ }).first().click();
  await page.waitForTimeout(2500);
  const lines = async () => (await page.innerText('body')).split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(`# web ${who}: record ${assetId.slice(0, 8)} -> Post Gig [${label}]`);
  if (mode === 'before') {
    await page.getByRole('button', { name: /^Post Task$/ }).last().click();
    await page.waitForTimeout(3000);
    console.log(`modal Post Task -> requests ${JSON.stringify(posts)}; page says ${JSON.stringify((await lines()).filter((l) => /Task Posted|Sent to|Posted to/.test(l)))}`);
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  } else {
    const url = page.url().replace(w.WEB, '');
    const title = await page.getByPlaceholder('e.g., Need help moving a couch').inputValue().catch(() => '(no title field)');
    const desc = await page.getByPlaceholder(/Describe what you need/).inputValue().catch(() => '');
    console.log(`Post Gig -> ${url.split('?')[0]} (prefill in URL: ${url.includes('prefill=')}); title=${JSON.stringify(title)} description=${JSON.stringify(desc)}`);
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-form.png` });
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.locator('select').filter({ has: page.locator(`option[value="${HOME}"]`) }).first().selectOption(HOME);
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /^Post Task$/ }).click();
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle').catch(() => {});
    const shown = (await lines()).find((l) => l === title || l.includes(title));
    console.log(`Post Task -> requests ${JSON.stringify(posts)}; now at ${page.url().replace(w.WEB, '')}; task page shows ${JSON.stringify(shown || '(title not found)')}`);
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-task.png` });
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
