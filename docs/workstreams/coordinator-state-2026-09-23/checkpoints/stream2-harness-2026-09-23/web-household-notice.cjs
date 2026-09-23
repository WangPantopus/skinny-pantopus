// Household notice sent from the web compose modal (quick compose, Home destination, Notice) by <sender>, then
// who can see it: the stored Mail row, the Home and Me drawers of other members (web page and API), and a
// non-member's API view. Usage: node web-household-notice.cjs <sender> <label> <shot>
const w = require('./web-lib.cjs'); const fs = require('fs');
const h = require('./h.cjs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [sender, label, shot] = process.argv.slice(2);
  const subject = `Stream2 RD household notice (compose) ${label}`;
  const b = await w.browser();
  const login = async (who) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome' });
    const c = h.creds(who);
    const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
    if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
    return ctx;
  };
  const sctx = await login(sender); const page = await sctx.newPage();
  let mailId = null; let status = null;
  page.on('response', async (r) => {
    if (r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/mailbox/send') {
      status = r.status(); try { const j = await r.json(); mailId = j && j.mail && j.mail.id; } catch (_) {}
      if (mailId) fs.appendFileSync(__dirname + '/work/t35-mail-ids.txt', mailId + '\n');
    }
  });
  await page.goto(`${w.WEB}/app/mailbox?scope=home&homeId=${HOME}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /Compose/ }).first().click();
  await page.waitForTimeout(1500);
  const panel = page.locator('div.max-w-lg').filter({ has: page.getByRole('heading', { name: 'Compose Mail' }) }).first();
  await panel.getByRole('button', { name: 'Notice', exact: true }).first().click();
  await page.getByPlaceholder('Subject (optional)').fill(subject);
  await page.getByPlaceholder('Write your message...').fill('Synthetic Stream2 household notice from the web compose modal.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForTimeout(4000);
  const banner = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => /Mail sent|Failed to send|sent/.test(l)).slice(0, 2);
  console.log(`# ${label}: ${sender} composes a household notice on web (quick, Home destination, Notice)`);
  console.log(`POST /api/mailbox/send -> ${status}; page says ${JSON.stringify(banner)}`);
  if (!mailId) { console.log('no mail id'); await b.close(); return; }
  console.log('stored row: ' + sql(`select 'drawer=' || coalesce(drawer,'null') || ' recipient_user_id=' || coalesce(left(recipient_user_id::text,8),'null') || ' recipient_home_id=' || coalesce(left(recipient_home_id::text,8),'null') || ' delivery_target_type=' || coalesce(delivery_target_type,'null') || ' delivery_visibility=' || coalesce(delivery_visibility,'null') || ' privacy=' || coalesce(privacy,'null') || ' lifecycle=' || coalesce(lifecycle,'null') from "Mail" where id='${mailId}'`).replace(HOME.slice(0, 8), '<home>'));
  for (const who of [sender, 'viewer', 'rdios', 'rdnohome']) {
    const s = await h.login(who);
    const seen = [];
    for (const d of ['home', 'personal']) {
      const r = await h.api('GET', `/api/mailbox/v2/drawer/${d}?limit=50&offset=0&tab=incoming`, s);
      if (((r.json && r.json.mail) || []).some((m) => m.id === mailId)) seen.push(d);
    }
    const item = await h.api('GET', `/api/mailbox/v2/item/${mailId}`, s);
    console.log(`${who.padEnd(8)} drawers listing it: ${seen.length ? seen.join(',') : 'none'}; GET item -> ${item.status}`);
  }
  // The other member's real web Mailbox, Home drawer.
  const vctx = await login('viewer'); const vp = await vctx.newPage();
  await vp.goto(`${w.WEB}/app/mailbox?scope=home&homeId=${HOME}`, { waitUntil: 'networkidle', timeout: 90000 });
  await vp.waitForTimeout(3000);
  const onPage = (await vp.innerText('body')).includes(subject);
  console.log(`viewer's web Mailbox (Home drawer) shows the notice: ${onPage}`);
  if (shot) await vp.screenshot({ path: `${w.OUT}/${shot}.png` });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
