// Recorded scan item: the web Mailbox page (v1 GET /api/mailbox, Home scope) shows "Pantopus" as a letter's
// sender until the letter is opened. Prints the row text before and after opening, and the list response sender.
// Usage: node web-v1-list-sender.cjs <who> <subjectFragment> <shot-prefix>
const w = require('./web-lib.cjs');
(async () => {
  const [who, subject, shot] = process.argv.slice(2);
  const HOME = 'f0e51100-0000-4000-8000-000000000200';
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const page = await ctx.newPage();
  let listSender = '(not seen)';
  page.on('response', async (resp) => {
    const u = resp.url();
    if (/\/api\/mailbox\?/.test(u) && resp.request().method() === 'GET') {
      try {
        const j = await resp.json();
        const row = (j.mail || []).find((m) => (m.subject || '').includes(subject));
        if (row) listSender = JSON.stringify({ sender: row.sender ?? null, sender_display_in_payload: Object.hasOwn(row, 'sender_display') });
      } catch (_) {}
    }
  });
  await page.goto(`${w.WEB}/app/mailbox?scope=home&homeId=${HOME}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);
  const rowText = async () => {
    const row = page.locator('button, li, a, div[role="button"]').filter({ hasText: subject }).last();
    return (await row.count()) ? (await row.innerText()).replace(/\s+/g, ' ').trim().slice(0, 160) : '(row not found)';
  };
  console.log(`# web ${who}: /app/mailbox (Home scope) letter "${subject}"`);
  console.log(`list response row sender: ${listSender}`);
  console.log(`1. row before opening: ${await rowText()}`);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-a.png` });
  await page.locator('button, li, a, div[role="button"]').filter({ hasText: subject }).last().click();
  await page.waitForTimeout(3000);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-b.png` });
  console.log(`2. row after opening: ${await rowText()}`);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
