const w = require('./web-lib.cjs'); const h = require('./h.cjs');
(async () => {
  const b = await w.browser(); const c = h.creds('viewer');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome' });
  await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  const p = await ctx.newPage();
  p.on('response', (r) => { if (/drawer\/personal/.test(r.url())) console.log('net', r.status(), r.url().replace(w.WEB, '')); });
  await p.goto(`${w.WEB}/app/mailbox/personal`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${w.OUT}/t38-peek.png` });
  console.log((await p.innerText('body')).split('\n').filter((l) => /Stream2|T38|Couldn|error/i.test(l)).slice(0, 20).join('\n'));
  await b.close();
})();
