// Web Mailbox compose (quick, Home destination, a chosen deliverable type) and what the page tells the sender.
// With inject=1 the real send response is passed through with fanoutFailed:['task'] added (browser-side),
// to show the partial-failure message.
// Usage: node web-compose-fanout.cjs <who> <typeChipLabel> <inject 0|1> <label> <shot>
const w = require('./web-lib.cjs'); const fs = require('fs');
(async () => {
  const [who, chip, inject, label, shot] = process.argv.slice(2);
  const HOME = 'f0e51100-0000-4000-8000-000000000200';
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  let sent = null;
  await page.route((url) => url.pathname === '/api/mailbox/send', async (route) => {
    const resp = await route.fetch();
    let json = null; try { json = await resp.json(); } catch (_) {}
    if (json && json.mail && json.mail.id) fs.appendFileSync(__dirname + '/work/t10-made-mail-ids.txt', json.mail.id + '\n');
    if (inject === '1' && json) json.fanoutFailed = ['task'];
    sent = { status: resp.status(), fanoutFailed: json && json.fanoutFailed, links: json && (json.fanoutLinks || []).map((l) => l.target_type) };
    await route.fulfill({ response: resp, json });
  });
  await page.goto(`${w.WEB}/app/mailbox?scope=home&homeId=${HOME}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /Compose/ }).first().click();
  await page.waitForTimeout(1500);
  const panel = page.locator('div.max-w-lg').filter({ has: page.getByRole('heading', { name: 'Compose Mail' }) }).first();
  if (chip) await panel.getByRole('button', { name: chip, exact: true }).first().click();
  await page.getByPlaceholder('Subject (optional)').fill(`Stream2 RD compose fanout ${label}`);
  await page.getByPlaceholder('Write your message...').fill('Synthetic Stream2 fan-out probe from the web compose modal.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForTimeout(4500);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}.png` });
  const banner = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => /Mail sent|couldn't be added|Failed to send/.test(l));
  console.log(`# web ${who}: compose (quick, Home, ${chip || 'Letter'}) → Send [${label}] inject=${inject}`);
  console.log(`POST /api/mailbox/send ${sent ? sent.status : '(none)'} links=${JSON.stringify(sent && sent.links)} fanoutFailed=${JSON.stringify(sent && sent.fanoutFailed)}`);
  console.log(`page tells the sender: ${JSON.stringify(banner)}`);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
