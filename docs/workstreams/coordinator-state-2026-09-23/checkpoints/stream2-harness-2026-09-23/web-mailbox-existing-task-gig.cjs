// Web mailbox Tasks, an existing mail task: its "Post as Gig" -> (before) the modal's Post Task, or (after) the
// household-task publication flow for that task, published with a synthetic budget. The work location comes from the
// address picker, whose geocoder has no key here, so its two geocoder answers are supplied in the browser; every
// Pantopus request is real. Usage: node web-mailbox-existing-task-gig.cjs <who> <before|after> <label> <shot>
const w = require('./web-lib.cjs'); const fs = require('fs');
const TASK_TITLE = 'Stream2 RD follow up on the city notice';
(async () => {
  const [who, mode, label, shot] = process.argv.slice(2);
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
    const id = j && j.gig && j.gig.id; if (id) fs.appendFileSync(__dirname + '/work/t30-made-gig-ids.txt', id + '\n');
    posts.push(`POST ${u.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (m) => m.slice(0, 8))} ${r.status()}${j && j.code ? ' ' + j.code : ''}${id ? ' gig=' + id.slice(0, 8) : ''}`);
  });
  await page.route('**/api/geo/autocomplete**', (route) => route.fulfill({ json: { suggestions: [
    { suggestion_id: 'stub-1', label: 'Stream2 native fixture, Vancouver WA 98660', primary_text: 'Stream2 native fixture', secondary_text: 'Vancouver, WA 98660', center: { lat: 45.6387, lng: -122.6615 } }] } }));
  await page.route('**/api/geo/resolve**', (route) => route.fulfill({ json: { normalized: {
    address: 'Stream2 native fixture', city: 'Vancouver', state: 'WA', zipcode: '98660', latitude: 45.6387, longitude: -122.6615, verified: false, source: 'stub' } } }));
  await page.goto(`${w.WEB}/app/mailbox/tasks`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
  await page.getByText(TASK_TITLE).first().click();
  await page.waitForTimeout(1500);
  const lines = async () => (await page.innerText('body')).split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(`# web ${who}: mailbox Tasks -> "${TASK_TITLE}" -> Post as Gig [${label}]`);
  await page.getByRole('button', { name: 'Post as Gig', exact: true }).click();
  await page.waitForTimeout(2500);
  if (mode === 'before') {
    await page.getByRole('button', { name: /^Post Task$/ }).last().click();
    await page.waitForTimeout(8000);
    const shown = (await lines()).filter((l) => /Posting|Task Posted|Failed|error|couldn/i.test(l));
    console.log(`modal Post Task -> requests ${JSON.stringify(posts)}; after 8 s the page shows ${JSON.stringify(shown)}`);
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  } else {
    await page.waitForURL(/\/app\/gigs\/new/, { timeout: 20000 }).catch(() => {});
    await page.waitForSelector('text=Private household task', { timeout: 30000 }).catch(() => {});
    const url = page.url().replace(w.WEB, '');
    const src = (await lines()).filter((l) => l === TASK_TITLE || /Find help for this task|Private household task|Publish Gig|already has a published Gig/.test(l));
    console.log(`-> ${url.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (m) => m.slice(0, 8))}; page shows ${JSON.stringify(src)}`);
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-composer.png` });
    await page.getByRole('button', { name: 'Use household task title' }).click();
    await page.locator('#home-gig-description').fill('Synthetic Stream2 check: follow up with the city about the notice on our street.');
    await page.locator('#home-gig-price').fill('40');
    const addr = page.getByLabel('Choose the work location');
    await addr.fill('Stream2 native');
    await page.waitForTimeout(1500);
    await page.getByRole('listbox').getByRole('option').first().dispatchEvent('mousedown');
    await page.getByRole('listbox').getByRole('option').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Publish Gig' }).click();
    await page.waitForTimeout(5000);
    const after = (await lines()).filter((l) => /publication|Open Gig|Publication|error|Review the public/i.test(l));
    console.log(`Publish Gig -> requests ${JSON.stringify(posts)}; page shows ${JSON.stringify(after)}`);
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-published.png` });
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
