const w = require('./web-lib.cjs'); const h = require('./h.cjs');
(async () => {
  const b = await w.browser(); const c = h.creds('viewer');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome' });
  await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 400)); });
  p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 400)));
  await p.goto(`${w.WEB}/app/mailbox/personal`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(3000);
  console.log((await p.innerText('body')).slice(0, 300));
  await b.close();
})();
