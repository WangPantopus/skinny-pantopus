// T36: a booklet-shaped letter (fixture) on the owner's web letter page: the footer buttons, and what Share does.
// Usage: node web-t36-booklet.cjs <label>
const w = require('./web-lib.cjs'); const h = require('./h.cjs'); const fs = require('node:fs');
(async () => {
  const [label] = process.argv.slice(2);
  const id = fs.readFileSync(__dirname + '/work/t36-booklet-id.txt', 'utf8').trim();
  const b = await w.browser(); const c = h.creds('owner');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  const p = await ctx.newPage();
  const reqs = []; p.on('request', (r) => { if (/\/api\//.test(r.url()) && r.method() !== 'GET') reqs.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  await p.goto(`${w.WEB}/app/mailbox/personal/${id}`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(3000);
  const footer = await p.locator('button, a').evaluateAll((els) => els.map((e) => (e.innerText || '').trim()).filter((t) => /^(Save to Vault|Download|Share)$/.test(t)));
  console.log(`# ${label}: booklet letter <${id.slice(0, 8)}> on /app/mailbox/personal/<id>; footer buttons ${JSON.stringify(footer)}`);
  await p.screenshot({ path: `${w.OUT}/t36-${label}-booklet.png` });
  const share = p.getByRole('button', { name: 'Share', exact: true });
  if (await share.count()) {
    const before = reqs.length; const url = p.url();
    await share.first().click(); await p.waitForTimeout(1500);
    console.log(`  Share clicked: new non-GET requests ${JSON.stringify(reqs.slice(before))}; url changed ${p.url() !== url}; dialogs ${await p.locator('[role="dialog"]').count()}`);
  } else console.log('  no Share button');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
