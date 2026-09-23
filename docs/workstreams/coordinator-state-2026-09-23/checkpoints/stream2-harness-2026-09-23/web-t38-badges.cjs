// T38: the lease resident's real web Mailbox (Me drawer): the trust badge shown beside each T38 letter, and the badge
// in one letter's detail. Usage: node web-t38-badges.cjs <label> <detail-tag>
const w = require('./web-lib.cjs'); const h = require('./h.cjs'); const fs = require('node:fs');
(async () => {
  const [label, detailTag] = process.argv.slice(2);
  const b = await w.browser();
  const c = h.creds('viewer');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome' });
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const p = await ctx.newPage();
  await p.goto(`${w.WEB}/app/mailbox/personal`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(3000);
  const rows = await p.evaluate((lbl) => {
    const out = [];
    for (const el of document.querySelectorAll('[role="list"] > *')) {
      const text = el.innerText || '';
      const m = text.match(new RegExp(`Stream2 T38 ${lbl}-([A-Z])`));
      if (!m) continue;
      const badge = el.querySelector('span[aria-label]');
      const firstLine = text.split('\n').map((s) => s.trim()).filter(Boolean)[0];
      out.push(`${m[1]}: sender shown "${firstLine}", badge ${badge ? JSON.stringify(badge.getAttribute('aria-label')) : 'none'}`);
    }
    return out.sort();
  }, label);
  const lines = [`# ${label}: lease resident's web Mailbox, Me drawer (${new Date().toISOString()})`, ...rows];
  await p.screenshot({ path: `${w.OUT}/t38-${label}-list.png` });
  const target = p.getByText(`Stream2 T38 ${label}-${detailTag}`, { exact: true }).first();
  await target.click(); await p.waitForTimeout(3000);
  const detailBadge = await p.evaluate(() => {
    const labels = [...document.querySelectorAll('span[aria-label]')].map((s) => s.getAttribute('aria-label'));
    return labels;
  });
  lines.push(`detail of ${detailTag}: badges on the page ${JSON.stringify(detailBadge)}`);
  await p.screenshot({ path: `${w.OUT}/t38-${label}-detail-${detailTag}.png` });
  console.log(lines.join('\n'));
  fs.writeFileSync(`${__dirname}/work/t38-${label}-web.txt`, lines.join('\n') + '\n');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
