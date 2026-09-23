// T44 S2-05 web: the visit setup's "Link an access code" row (/app/homes/<id>/scheduling/visits/new, as the owner).
// Records what a click does: URL, dialogs, non-GET requests, and the Access section's text.
// Usage: node web-t44-visit-access.cjs <label>
const w = require('./web-lib.cjs'); const h = require('./h.cjs'); const fs = require('node:fs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [label] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = h.creds('owner');
  const r = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (r.status() !== 200) throw new Error('login owner ' + r.status());
  const out = [`# ${label} visit setup access row (${new Date().toISOString()})`];
  const p = await ctx.newPage();
  const writes = []; const popups = []; const dialogs = [];
  p.on('request', (q) => { if (q.method() !== 'GET' && /\/api\//.test(q.url())) writes.push(`${q.method()} ${new URL(q.url()).pathname}`); });
  p.on('popup', (x) => popups.push(x.url()));
  p.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
  const url = `${w.WEB}/app/homes/${HOME}/scheduling/visits/new`;
  await p.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(2500);
  const body = (await p.innerText('body')).split('\n').map((l) => l.trim()).filter(Boolean);
  const i = body.findIndex((l) => /^Access$/i.test(l));
  out.push(`page: ${p.url().replace(w.WEB, '')}; Access section: ${JSON.stringify(i >= 0 ? body.slice(i, i + 3) : 'not found')}`);
  const row = p.getByRole('button', { name: /Link an access code/i });
  out.push(`"Link an access code" controls: ${await row.count()}`);
  // Scroll the form's own scroll container to the bottom so the whole Access section shows.
  await p.evaluate(() => {
    let e = document.querySelector('textarea');
    while (e && e !== document.body) {
      if (e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible') { e.scrollTop = e.scrollHeight; break; }
      e = e.parentElement;
    }
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${w.OUT}/t44-${label}-visit-setup.png` });
  if (await row.count()) {
    const before = p.url();
    await row.first().click();
    await p.waitForTimeout(2500);
    const dlg = await p.locator('[role="dialog"], [role="alertdialog"]').count();
    out.push(`after click: url ${p.url() === before ? 'unchanged' : p.url().replace(w.WEB, '')}; dialogs/sheets ${dlg}; popups ${JSON.stringify(popups)}; native dialogs ${JSON.stringify(dialogs)}; api writes ${JSON.stringify(writes)}`);
    await p.screenshot({ path: `${w.OUT}/t44-${label}-after-click.png` });
  }
  console.log(out.join('\n'));
  fs.writeFileSync(`${__dirname}/work/t44-${label}.txt`, out.join('\n') + '\n');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
