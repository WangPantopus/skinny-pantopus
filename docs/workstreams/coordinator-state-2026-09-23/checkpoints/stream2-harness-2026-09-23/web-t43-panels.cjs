// T43 S2-20 + S2-23 on the real pages: the attachment pickers in the dashboard's Report Issue, Track Bill and
// Track Package panels (owner), and what the waiting room's Request help does (no-home account; window.open is
// wrapped so the exact target is recorded; the call still goes through).
// Usage: node web-t43-panels.cjs <label>
const w = require('./web-lib.cjs'); const h = require('./h.cjs'); const fs = require('node:fs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [label] = process.argv.slice(2);
  const b = await w.browser();
  const ctxFor = async (who) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
    const c = h.creds(who);
    const r = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
    if (r.status() !== 200) throw new Error(`login ${who} ${r.status()}`);
    return ctx;
  };
  const out = [`# ${label} panels + request help (${new Date().toISOString()})`];
  const o = await ctxFor('owner');
  const p = await o.newPage();
  for (const [name, item] of [['issue', 'Report Issue'], ['bill', 'Track Bill'], ['package', 'Track Package']]) {
    await p.goto(`${w.WEB}/app/homes/${HOME}/dashboard`, { waitUntil: 'networkidle', timeout: 120000 });
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Quick actions' }).click();
    await p.waitForTimeout(500);
    await p.getByRole('button', { name: item, exact: true }).click();
    await p.waitForTimeout(1200);
    const body = (await p.innerText('body')).split('\n').map((l) => l.trim());
    const picker = body.filter((l) => /^Photos \(optional\)$|^Bill \/ Receipt \(optional\)$|^Upload (photos|a photo|a screenshot)/.test(l));
    out.push(`${item} panel: file inputs ${await p.locator('input[type="file"]').count()}; picker text ${JSON.stringify(picker)}`);
    await p.screenshot({ path: `${w.OUT}/t43-${label}-panel-${name}.png` });
  }
  await p.close();
  const n = await ctxFor('rdnohome');
  await n.addInitScript(() => {
    const orig = window.open.bind(window);
    window.__opened = [];
    window.open = (...args) => { window.__opened.push(String(args[0])); return orig(...args); };
  });
  const q = await n.newPage();
  await q.goto(`${w.WEB}/app/homes/${HOME}/waiting-room`, { waitUntil: 'networkidle', timeout: 120000 });
  await q.waitForTimeout(2500);
  out.push(`waiting room (${q.url().replace(w.WEB, '')}) buttons: ${JSON.stringify(await q.getByRole('button').allInnerTexts().then((a) => a.map((x) => x.trim()).filter(Boolean).slice(0, 8)))}`);
  await q.getByRole('button', { name: /Request help/i }).first().click();
  await q.waitForTimeout(600);
  const toasts = await q.locator('[role="status"], [role="alert"]').allInnerTexts().catch(() => []);
  await q.screenshot({ path: `${w.OUT}/t43-${label}-request-help.png` });
  out.push(`Request help: window.open targets ${JSON.stringify(await q.evaluate(() => window.__opened))}; toasts ${JSON.stringify(toasts.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean))}`);
  console.log(out.join('\n'));
  fs.writeFileSync(`${__dirname}/work/t43-${label}-panels.txt`, out.join('\n') + '\n');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
