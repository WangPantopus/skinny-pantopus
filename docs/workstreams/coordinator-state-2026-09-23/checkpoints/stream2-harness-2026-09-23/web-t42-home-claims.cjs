// T42 web Home trust claims on the real pages: Travel Mode (/app/mailbox/vacation and /app/mailbox/travel, as the
// lease resident, who has no hold) and the Community share prompt (/app/mailbox/community, as the owner).
// Usage: node web-t42-home-claims.cjs <label> [publish]
const w = require('./web-lib.cjs'); const h = require('./h.cjs'); const fs = require('node:fs');
(async () => {
  const [label, publish] = process.argv.slice(2);
  const b = await w.browser();
  const ctxFor = async (who) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome' });
    const c = h.creds(who);
    const r = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
    if (r.status() !== 200) throw new Error('web login failed ' + who);
    return ctx;
  };
  const out = [`# ${label} (${new Date().toISOString()})`];
  const lines = async (p, re) => (await p.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => re.test(l));
  const v = await ctxFor('viewer');
  for (const path of ['/app/mailbox/vacation', '/app/mailbox/travel']) {
    const p = await v.newPage();
    await p.goto(w.WEB + path, { waitUntil: 'networkidle', timeout: 90000 });
    await p.waitForTimeout(2500);
    out.push(`${path} (lease resident): ${JSON.stringify(await lines(p, /Verified Neighbor|Auto-gig|Auto-post gig|locker|carrier facility|Only verified|trusted neighbors|Hold in Vault|Forward to household|Urgent items|urgent items/i))}`);
    const checked = await p.locator('input[type="radio"]:checked, [aria-checked="true"], [aria-pressed="true"]').evaluateAll((els) => els.map((e) => (e.closest('label,button,div') || e).innerText.replace(/\s+/g, ' ').trim().slice(0, 60)));
    out.push(`  selected: ${JSON.stringify(checked)}`);
    await p.screenshot({ path: `${w.OUT}/t42-${label}-${path.split('/').pop()}.png`, fullPage: true });
    await p.close();
  }
  const o = await ctxFor('owner');
  const p = await o.newPage();
  const publishCalls = [];
  p.on('response', async (r) => { if (/\/community\/publish$/.test(new URL(r.url()).pathname)) { let j = null; try { j = await r.json(); } catch (_) {} publishCalls.push(`${r.status()} reach=${j && j.reach}`); if (j && j.item && j.item.id) fs.appendFileSync(__dirname + '/work/t42-community-ids.txt', j.item.id + '\n'); } });
  await p.goto(w.WEB + '/app/mailbox/community', { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(3000);
  out.push(`/app/mailbox/community (owner) prompt: ${JSON.stringify(await lines(p, /eligible to share|Reach|households/i))}`);
  await p.screenshot({ path: `${w.OUT}/t42-${label}-community.png` });
  const share = p.getByRole('button', { name: 'Share with Neighborhood' });
  if (await share.count()) {
    await share.first().click(); await p.waitForTimeout(1000);
    out.push(`  share modal: ${JSON.stringify(await lines(p, /Share with|households|nearby/i))}`);
    await p.screenshot({ path: `${w.OUT}/t42-${label}-community-modal.png` });
    if (publish) {
      const confirm = p.getByRole('button', { name: 'Confirm & Share' });
      out.push(`  confirm button: ${JSON.stringify(await confirm.innerText())}`);
      await confirm.click(); await p.waitForResponse((r) => /community\/publish$/.test(new URL(r.url()).pathname)).catch(() => null); await p.waitForTimeout(800);
      out.push(`  after publishing: POST /community/publish ${JSON.stringify(publishCalls)}; page says ${JSON.stringify(await lines(p, /Shared with/i))}`);
      await p.screenshot({ path: `${w.OUT}/t42-${label}-community-published.png` });
    }
  } else out.push('  no share button');
  console.log(out.join('\n'));
  fs.writeFileSync(`${__dirname}/work/t42-${label}.txt`, out.join('\n') + '\n');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
