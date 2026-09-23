// Compose modal send-error visibility. Captures the modal panel idle, filled, and after a refused send
// (Person @ Home to someone outside the Home), plus the full page after the error.
// Usage: node web-compose-error-shot.cjs <who> <strangerUserId> <label>
const w = require('./web-lib.cjs');
(async () => {
  const [who, stranger, label] = process.argv.slice(2);
  const HOME = 'f0e51100-0000-4000-8000-000000000200';
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome', reducedMotion: 'reduce' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  let sent = null;
  page.on('response', async (resp) => {
    if (resp.url().endsWith('/api/mailbox/send') && resp.request().method() === 'POST') {
      let body = null; try { body = await resp.json(); } catch (_) {}
      sent = { status: resp.status(), body };
    }
  });
  const shot = { animations: 'disabled', caret: 'hide' };
  await page.goto(`${w.WEB}/app/mailbox?scope=home&homeId=${HOME}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /Compose/ }).first().click();
  await page.waitForTimeout(3000);
  const panel = page.locator('div.max-w-lg').filter({ has: page.getByRole('heading', { name: 'Compose Mail' }) }).first();
  await panel.screenshot({ path: `${w.OUT}/${label}-1-idle.png`, ...shot });
  await page.locator('select').filter({ has: page.locator('option[value="person"]') }).first().selectOption('person');
  await page.getByPlaceholder('Search by name, username, or email').first().fill(stranger);
  await page.getByPlaceholder('Subject (optional)').fill('Stream2 RD compose error visibility');
  await page.getByPlaceholder('Write your message...').fill('Synthetic probe: a refused send should explain itself inside the modal.');
  // Close the transient person-suggestion dropdown so the no-error state is static.
  await page.getByPlaceholder('Search by name, username, or email').first().press('Escape');
  await page.getByPlaceholder('Subject (optional)').click();
  await page.waitForTimeout(3000);
  await panel.screenshot({ path: `${w.OUT}/${label}-2-filled.png`, ...shot });
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForTimeout(4000);
  await panel.screenshot({ path: `${w.OUT}/${label}-3-after-error.png`, ...shot });
  await page.screenshot({ path: `${w.OUT}/${label}-4-after-error-page.png`, ...shot });
  const inPanel = (await panel.innerText()).split('\n').map((l) => l.trim()).filter((l) => /live at|failed|couldn|permission/i.test(l));
  console.log(`# web ${who}: compose → Person @ Home → outside the Home → Send [${label}] ${new Date().toISOString()}`);
  console.log(`POST /api/mailbox/send ${sent ? sent.status + ' ' + JSON.stringify(sent.body && sent.body.error) : '(none)'}`);
  console.log(`error text inside the modal panel: ${JSON.stringify(inPanel)}`);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
