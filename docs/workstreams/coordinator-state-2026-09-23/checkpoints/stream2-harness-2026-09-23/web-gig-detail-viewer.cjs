// Web task page and edit form per viewer, through the web session cookie (Next proxy).
// page: open /app/gigs/<id> and report whether the exact address shows and the saved state.
// edit: (owner) open the edit form, report the Location "Selected" box, change the title, press Save Changes.
// Usage: node web-gig-detail-viewer.cjs <owner|editor|rdnohome|anon> <page|edit> <gigId> <label> <shot>
const w = require('./web-lib.cjs');
(async () => {
  const [who, mode, id, label, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome' });
  if (who !== 'anon') {
    const c = require('./h.cjs').creds(who);
    const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
    if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  }
  const page = await ctx.newPage();
  let detail = null; let patch = null;
  page.on('response', async (r) => {
    const p = r.url().replace(w.WEB, '').split('?')[0];
    if (p === `/api/gigs/${id}` && r.request().method() === 'GET') {
      let j = null; try { j = await r.json(); } catch (_) {}
      const g = j && j.gig; detail = g ? { exact_address: g.exact_address ?? null, locationUnlocked: g.locationUnlocked, viewer_has_saved: g.viewer_has_saved } : { status: r.status() };
    }
    if (p === `/api/gigs/${id}` && r.request().method() === 'PATCH') { let j = null; try { j = await r.json(); } catch (_) {} patch = { status: r.status(), error: j && (j.error || j.details) }; }
  });
  const name = { owner: 'owner', editor: 'assigned helper', rdnohome: 'signed-in stranger', anon: 'anonymous visitor' }[who];
  if (mode === 'edit') {
    await page.goto(`${w.WEB}/app/gigs/new?editGigId=${id}`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2500);
    const t = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter(Boolean);
    const i = t.indexOf('Selected');
    console.log(`# web ${name}: edit form [${label}]`);
    console.log(`GET /api/gigs/<id> ${JSON.stringify(detail)}; Location "Selected": ${JSON.stringify(i >= 0 ? t[i + 1] : '(none)')}`);
    const title = page.getByPlaceholder('e.g., Need help moving a couch');
    await title.fill(((await title.inputValue()) + ' (edited)').slice(0, 120));
    await page.getByRole('button', { name: /^Save Changes$/ }).click();
    await page.waitForTimeout(4000);
    const said = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => /Please fix|exact address|Failed to|Task updated/.test(l)).slice(0, 3);
    console.log(`Save Changes: PATCH ${patch ? `${patch.status}${patch.error ? ' ' + JSON.stringify(patch.error) : ''}` : '(not sent)'}; page says ${JSON.stringify(said)}; url ${page.url().replace(w.WEB, '')}`);
  } else {
    await page.goto(`${w.WEB}/app/gigs/${id}`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(3000);
    const t = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter(Boolean);
    const addr = t.filter((l) => /100 Synthetic St/.test(l)).slice(0, 2);
    const saved = t.filter((l) => /^(Saved|Save|Unsave)$/.test(l)).slice(0, 2);
    const approx = t.filter((l) => /approximate|general area|shared after|exact address/i.test(l)).slice(0, 2);
    console.log(`# web ${name}: task page [${label}]`);
    console.log(`GET /api/gigs/<id> ${JSON.stringify(detail)}; page shows exact address: ${JSON.stringify(addr)}; location notes: ${JSON.stringify(approx)}; save control: ${JSON.stringify(saved)}`);
  }
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png`, fullPage: true });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
