// T43 web Home dead ends on the real pages (S2-01, S2-20, S2-23, S2-24).
// Usage: node web-t43-home-dead-ends.cjs <label>
const w = require('./web-lib.cjs'); const h = require('./h.cjs'); const fs = require('node:fs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [label] = process.argv.slice(2);
  const b = await w.browser();
  const ctxFor = async (who) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
    const c = h.creds(who);
    const r = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
    if (r.status() !== 200) throw new Error('login ' + who);
    return ctx;
  };
  const out = [`# ${label} (${new Date().toISOString()})`];
  const lines = async (p, re) => (await p.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => re.test(l));
  const shot = (p, n) => p.screenshot({ path: `${w.OUT}/t43-${label}-${n}.png` });

  // S2-24 + S2-20: the owner's Home dashboard: the property value card and the Add issue panel.
  const o = await ctxFor('owner');
  let p = await o.newPage();
  await p.goto(`${w.WEB}/app/homes/${HOME}/dashboard`, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(3000);
  out.push(`S2-24 dashboard property value card: ${JSON.stringify(await lines(p, /Property insights|No estimate|Estimated Home Value|property estimate|Property value information/i))}`);
  await shot(p, 'dashboard');
  const addBill = p.getByRole('button', { name: 'Add a bill' }).first();
  if (await addBill.count()) {
    await addBill.click(); await p.waitForTimeout(1500);
    out.push(`S2-20 bill panel fields: ${JSON.stringify(await lines(p, /Bill \/ Receipt|Upload a photo or PDF|Photos \(optional\)|attachment|Provider|Amount|Due/i))}`);
    await shot(p, 'bill-panel');
  } else out.push('S2-20: no Add a bill button on the dashboard');
  await p.close();

  // S2-23: the waiting room's Request help (as the no-home account, for whom the page doesn't redirect).
  const n = await ctxFor('rdnohome');
  p = await n.newPage();
  await p.goto(`${w.WEB}/app/homes/${HOME}/waiting-room`, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(2500);
  const help = p.getByRole('button', { name: /Request help/i }).first();
  if (await help.count()) {
    const popupP = p.waitForEvent('popup', { timeout: 4000 }).catch(() => null);
    await help.click();
    await p.waitForTimeout(600);
    const t = await p.locator('[role="status"], [role="alert"]').allInnerTexts().catch(() => []);
    await shot(p, 'waiting-room');
    const popup = await popupP;
    out.push(`S2-23 Request help: popup ${popup ? JSON.stringify(popup.url()) : 'none'}; toasts ${JSON.stringify(t.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean))}`);
  } else out.push(`S2-23: no Request help on ${p.url().replace(w.WEB, '')}: ${JSON.stringify((await lines(p, /./)).slice(0, 8))}`);
  await p.close();

  // S2-01: verify-landlord as the lease resident.
  const v = await ctxFor('viewer');
  p = await v.newPage();
  await p.goto(`${w.WEB}/app/homes/${HOME}/verify-landlord`, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(3000);
  out.push(`S2-01 verify-landlord (lease resident): ${JSON.stringify(await lines(p, /No landlord on file|Invite your landlord|Verify with a mailed code|Upload lease|landlord/i))}`);
  await shot(p, 'verify-landlord');
  const invite = p.getByRole('button', { name: /Invite your landlord/i });
  if (await invite.count()) {
    await invite.first().click();
    await p.waitForURL(/invite-landlord/, { timeout: 15000 }).catch(() => null);
    await p.waitForTimeout(4000);
    out.push(`  Invite your landlord -> ${p.url().replace(w.WEB, '')}: ${JSON.stringify(await lines(p, /404|could not be found|not found|doesn.t exist/i))}`);
    await shot(p, 'invite-landlord');
  } else out.push('  no Invite your landlord option');
  console.log(out.join('\n'));
  fs.writeFileSync(`${__dirname}/work/t43-${label}.txt`, out.join('\n') + '\n');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
