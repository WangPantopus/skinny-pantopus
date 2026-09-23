// T43 S2-20 reproduction: add a bill with an attachment on the owner's Home dashboard and record what the page says
// and what the create request carries. Records the new bill id in work/t43-bill-ids.txt for cleanup.
// Usage: node web-t43-bill-attach.cjs <label>
const w = require('./web-lib.cjs'); const h = require('./h.cjs'); const fs = require('node:fs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [label] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = h.creds('owner');
  const r = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (r.status() !== 200) throw new Error('login owner ' + r.status());
  const out = [`# ${label} bill with attachment (${new Date().toISOString()})`];
  const p = await ctx.newPage();
  const calls = [];
  p.on('request', (q) => {
    const u = new URL(q.url());
    if (q.method() !== 'GET' && /\/api\/(homes|upload|files|media)/.test(u.pathname)) {
      let keys = null; try { keys = Object.keys(JSON.parse(q.postData() || '{}')); } catch (_) { keys = `non-JSON body (${(q.headers()['content-type'] || '').split(';')[0]})`; }
      calls.push(`${q.method()} ${u.pathname} body keys ${JSON.stringify(keys)}`);
    }
  });
  p.on('response', async (s) => {
    const u = new URL(s.url());
    if (s.request().method() === 'POST' && u.pathname === `/api/homes/${HOME}/bills`) {
      let j = null; try { j = await s.json(); } catch (_) {}
      calls.push(`  -> ${s.status()}`);
      if (j && j.bill && j.bill.id) fs.appendFileSync(`${__dirname}/work/t43-bill-ids.txt`, j.bill.id + '\n');
    }
  });
  await p.goto(`${w.WEB}/app/homes/${HOME}/dashboard`, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Add a bill' }).first().click();
  await p.waitForTimeout(1200);
  await p.getByPlaceholder('e.g., PGE, Comcast, etc.').fill(`T43 ${label} attachment probe`);
  await p.getByPlaceholder('0.00').fill('12.34');
  const inputs = p.locator('input[type="file"]');
  out.push(`file inputs in the panel: ${await inputs.count()}`);
  if (await inputs.count()) {
    await inputs.first().setInputFiles(`${__dirname}/work/t43-receipt.pdf`);
    await p.waitForTimeout(800);
    out.push(`picker shows: ${JSON.stringify((await p.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => /t43-receipt|receipt\.pdf/i.test(l)))}`);
  }
  await p.screenshot({ path: `${w.OUT}/t43-${label}-bill-form.png` });
  await p.getByRole('button', { name: 'Add Bill' }).click();
  await p.waitForResponse((s) => s.request().method() === 'POST' && new URL(s.url()).pathname === `/api/homes/${HOME}/bills`, { timeout: 20000 }).catch(() => null);
  await p.waitForTimeout(600);
  const t = await p.locator('[role="status"], [role="alert"]').allInnerTexts().catch(() => []);
  out.push(`requests: ${JSON.stringify(calls)}`);
  out.push(`toasts after saving: ${JSON.stringify(t.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean))}`);
  await p.screenshot({ path: `${w.OUT}/t43-${label}-bill-saved.png` });
  console.log(out.join('\n'));
  fs.writeFileSync(`${__dirname}/work/t43-${label}-bill.txt`, out.join('\n') + '\n');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
