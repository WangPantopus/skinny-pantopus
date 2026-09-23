// Web Mailbox compose (quick) to a PERSON at the Home: what the send returns and what the modal shows.
// Usage: node web-compose-person-t4.cjs <who> <recipientUserId> <label> <shot-prefix>
const w = require('./web-lib.cjs');
(async () => {
  const [who, recipient, label, shot] = process.argv.slice(2);
  const HOME = 'f0e51100-0000-4000-8000-000000000200';
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  let sent = null;
  page.on('response', async (resp) => {
    if (resp.url().endsWith('/api/mailbox/send') && resp.request().method() === 'POST') {
      let body = null; try { body = await resp.json(); } catch (_) {}
      sent = { status: resp.status(), body, req: resp.request().postDataJSON() };
    }
  });
  await page.goto(`${w.WEB}/app/mailbox?scope=home&homeId=${HOME}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /Compose/ }).first().click();
  await page.waitForTimeout(1500);
  await page.locator('select').filter({ has: page.locator('option[value="person"]') }).first().selectOption('person');
  await page.waitForTimeout(500);
  await page.getByPlaceholder('Search by name, username, or email').first().fill(recipient);
  await page.waitForTimeout(1200);
  await page.getByPlaceholder('Subject (optional)').fill(`Stream2 RD person compose ${label}`);
  await page.getByPlaceholder('Write your message...').fill('Synthetic Stream2 person-destination probe from the web compose modal.');
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-a.png` });
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForTimeout(5000);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-b.png` });
  console.log(`# web ${who}: Mailbox → Compose (quick, person destination ${recipient.slice(0, 8)}) → Send [${label}] ${new Date().toISOString()}`);
  if (!sent) { console.log('no POST /api/mailbox/send observed'); } else {
    console.log(`request destination=${JSON.stringify(sent.req && sent.req.destination)}`);
    console.log(`POST /api/mailbox/send ${sent.status} ${JSON.stringify(sent.body && (sent.body.error || (sent.body.mail && sent.body.mail.id)))}`);
  }
  const lines = (await page.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => /live at|couldn|permission|failed|sent/i.test(l));
  console.log(`modal/page text: ${JSON.stringify(lines.slice(0, 4))}`);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
