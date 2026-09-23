// T36 after: the vault menu's Try again after a folders load failure, then a successful filing of letter <tag>.
// Usage: node web-t36-vault-ok.cjs <label> <subject-tag>
const w = require('./web-lib.cjs'); const h = require('./h.cjs');
const FAIL = { status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) };
(async () => {
  const [label, tag] = process.argv.slice(2);
  const owner = await h.login('owner');
  const id = (await h.api('GET', '/api/mailbox/v2/drawer/personal?limit=50', owner)).json.mail.find((m) => m.subject === `Stream2 T36 letter ${tag}`).id;
  const b = await w.browser(); const c = h.creds('owner');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  const p = await ctx.newPage();
  const net = []; p.on('response', (r) => { const u = new URL(r.url()); if (/vault\/(folders|file)/.test(u.pathname)) net.push(`${r.request().method()} ${u.pathname} -> ${r.status()}`); });
  await p.route(/\/api\/mailbox\/v2\/p2\/vault\/folders/, (route) => route.fulfill(FAIL));
  await p.goto(`${w.WEB}/app/mailbox/personal/${id}`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.getByRole('button', { name: /File to Vault/ }).first().click(); await p.waitForTimeout(800);
  const menu = async () => (await p.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => /^(Taxes|Warranties|Receipts)$|Couldn't load|Try again|Loading folders|Filed to vault/.test(l));
  console.log(`# ${label}: letter ${tag}\n  folders failing, menu: ${JSON.stringify(await menu())}`);
  await p.unroute(/\/api\/mailbox\/v2\/p2\/vault\/folders/);
  await p.getByRole('button', { name: 'Try again', exact: true }).click(); await p.waitForTimeout(2500);
  console.log(`  after Try again (folders answer again), menu: ${JSON.stringify(await menu())}`);
  await p.screenshot({ path: `${w.OUT}/t36-${label}-vault-retried.png` });
  await p.getByRole('button', { name: /Taxes/ }).first().click(); await p.waitForTimeout(2500);
  console.log(`  filed to Taxes: page says ${JSON.stringify(await menu())}; menu open ${(await p.getByRole('button', { name: /^📋?\s*Taxes/ }).count()) > 0}`);
  console.log('  network: ' + net.join('; '));
  await p.screenshot({ path: `${w.OUT}/t36-${label}-vault-filed.png` });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
