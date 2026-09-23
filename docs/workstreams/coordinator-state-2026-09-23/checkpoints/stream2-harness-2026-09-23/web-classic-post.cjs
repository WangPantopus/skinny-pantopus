// Web classic task form (/app/gigs/new): post with Deadline and Estimated duration left empty, with a past deadline,
// or edit a task clearing both. Location comes from the form's own prefill link (an address, no Home), the way the
// magic composer's "Edit details" opens this form. Prints the request body keys, the response, what the page says,
// and (for a created task) whether its page opens.
// Usage: node web-classic-post.cjs <who> <new-empty|new-past|new-negative|edit-clear> <label> <shot> [gigId]
const w = require('./web-lib.cjs'); const fs = require('fs');
(async () => {
  const [who, mode, label, shot, gigId] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pantopus_first_gig_shared', '1'); } catch (_) {} });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  let sent = null; let resp = null;
  page.on('request', (req) => {
    const p = req.url().replace(w.WEB, '').split('?')[0];
    if (!['POST', 'PATCH'].includes(req.method()) || !/^\/api\/gigs(\/[0-9a-f-]{36})?$/.test(p)) return;
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    sent = { method: req.method(), keys: Object.keys(body).sort(), nulls: Object.keys(body).filter((k) => body[k] === null).sort() };
  });
  page.on('response', async (r) => {
    const p = r.url().replace(w.WEB, '').split('?')[0];
    if (!['POST', 'PATCH'].includes(r.request().method()) || !/^\/api\/gigs(\/[0-9a-f-]{36})?$/.test(p)) return;
    let json = null; try { json = await r.json(); } catch (_) {}
    resp = { status: r.status(), id: json && json.gig && json.gig.id, details: json && json.details && json.details.map((d) => d.message), error: json && json.error };
    if (r.request().method() === 'POST' && resp.id) fs.appendFileSync(__dirname + '/work/t18-made-gig-ids.txt', resp.id + '\n');
  });
  if (mode === 'edit-clear') {
    // The edit form loads the task without its exact address on web (GET /api/gigs/:id reads only a Bearer
    // token, so a cookie session gets the public view), and Save then asks for an exact address. Re-pick the
    // location through the form's Home tab; its geocoder answer is supplied in the browser (no key here).
    await page.route('**/api/geo/autocomplete**', (route) => route.fulfill({ json: { suggestions: [
      { suggestion_id: 'stub-1', label: 'Stream2 native fixture, Vancouver WA 98660', center: { lat: 45.6387, lng: -122.6615 } }] } }));
    await page.goto(`${w.WEB}/app/gigs/new?editGigId=${gigId}`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.locator('select').filter({ has: page.locator('option[value="f0e51100-0000-4000-8000-000000000200"]') }).first().selectOption('f0e51100-0000-4000-8000-000000000200');
    await page.waitForTimeout(2500);
    await page.locator('input[type="date"]').first().fill('');
    await page.getByPlaceholder('e.g., 2').fill('');
    await page.getByRole('button', { name: /^Save Changes$/ }).click();
  } else {
    const prefill = { latitude: 45.6387, longitude: -122.6615, address: '100 Synthetic St, Vancouver, WA', mode: 'address' };
    await page.goto(`${w.WEB}/app/gigs/new?prefill=${encodeURIComponent(JSON.stringify(prefill))}`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.getByPlaceholder('e.g., Need help moving a couch').fill(`Stream2 RD ${label}: move a couch`);
    await page.getByPlaceholder(/Describe what you need/).fill('Synthetic Stream2 classic task form post.');
    await page.getByPlaceholder('50').fill('35');
    if (mode === 'new-past') await page.locator('input[type="date"]').first().fill('2024-01-15');
    if (mode === 'new-negative') await page.getByPlaceholder('e.g., 2').fill('-2');
    await page.getByRole('button', { name: /^Post Task$/ }).click();
  }
  await page.waitForTimeout(4000);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png`, fullPage: true });
  const said = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => /Please fix|must be|Failed to|Task (posted|updated)|valid date|positive/.test(l)).slice(0, 5);
  console.log(`# web ${who}: classic task form, ${mode} [${label}]`);
  if (mode === 'new-negative') console.log(`browser validation on Estimated Duration: ${JSON.stringify(await page.getByPlaceholder('e.g., 2').evaluate((el) => el.validationMessage))}`);
  console.log(`${sent ? `${sent.method} body keys=${JSON.stringify(sent.keys)} null values=${JSON.stringify(sent.nulls)}` : '(no request)'}`);
  console.log(`response: ${resp ? `${resp.status}${resp.details ? ' ' + JSON.stringify(resp.details) : resp.status >= 400 ? ' ' + JSON.stringify(resp.error) : ''}` : '(none)'}; page says: ${JSON.stringify(said)}; url ${page.url().replace(w.WEB, '')}`);
  if (mode === 'new-empty' && resp && resp.id) {
    await page.waitForURL(new RegExp(`/app/gigs/${resp.id}`), { timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const title = (await page.innerText('body')).split('\n').map((l) => l.trim()).find((l) => l.includes(`Stream2 RD ${label}`));
    console.log(`task page ${page.url().replace(w.WEB, '')} shows: ${JSON.stringify(title || '(title not found)')}`);
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-task.png` });
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
