// T42: the owner's web Community item detail: the reach line under the title. Usage: node web-t42-community-detail.cjs <label>
const w = require('./web-lib.cjs'); const h = require('./h.cjs'); const fs = require('node:fs');
(async () => {
  const [label] = process.argv.slice(2);
  const b = await w.browser(); const c = h.creds('owner');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  const p = await ctx.newPage();
  await p.goto(`${w.WEB}/app/mailbox/community`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.getByText('Stream2 T42 street closure notice').last().click();
  await p.waitForTimeout(1500);
  const lines = (await p.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => /households received|Published to|reached/i.test(l));
  const out = `# ${label} (${new Date().toISOString()}): owner's web Community item detail: ${JSON.stringify(lines)}`;
  console.log(out); fs.appendFileSync(`${__dirname}/work/t42-community-detail.txt`, out + '\n');
  await p.screenshot({ path: `${w.OUT}/t42-${label}-community-detail.png` });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
