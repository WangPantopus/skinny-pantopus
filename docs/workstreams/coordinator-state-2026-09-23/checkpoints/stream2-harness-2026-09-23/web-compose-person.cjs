// mail_extracted send fix: web Mailbox compose, quick mode, "Person @ Home" (the viewer), then print the stored
// attention/visibility fields. No tokens printed.
const w = require('./web-lib.cjs'); const { execFileSync } = require('child_process'); const fs = require('fs');
(async () => {
  const [who, recipientQuery, label, shot] = process.argv.slice(2);
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
      sent = { status: resp.status(), id: body?.mail?.id || null, req: resp.request().postDataJSON() };
    }
  });
  await page.goto(`${w.WEB}/app/mailbox?scope=home&homeId=${HOME}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /Compose/ }).first().click();
  await page.waitForTimeout(1500);
  if (recipientQuery === 'self') {
    await page.locator('select').first().selectOption('self');
    await page.waitForTimeout(800);
  } else {
    await page.locator('select').first().selectOption('person');
    await page.waitForTimeout(500);
    await page.getByPlaceholder('Search by name, username, or email').first().fill(recipientQuery);
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: new RegExp(recipientQuery, 'i') }).first().dispatchEvent('mousedown');
    await page.waitForTimeout(800);
  }
  await page.getByPlaceholder('Subject (optional)').fill(`Stream2 S web compose to a person ${label}`);
  await page.getByPlaceholder('Write your message...').fill('Synthetic Stream2 send-fix probe to a person at the Home.');
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-a-compose.png` });
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForTimeout(5000);
  console.log(`# web ${who}: Mailbox → Compose (quick, ${recipientQuery === 'self' ? 'Me @ Home' : 'Person @ Home: ' + recipientQuery}) → Send  [${label}] ${new Date().toISOString()}`);
  if (!sent) { console.log('no POST /api/mailbox/send observed'); await b.close(); return; }
  const p = sent.req || {};
  console.log(`request: destination=${JSON.stringify({ ...p.destination, homeId: '<home>', userId: p.destination?.userId ? '<recipient>' : undefined, attnUserId: p.destination?.attnUserId ? '<recipient>' : undefined })} object.payload=${JSON.stringify(p.object && p.object.payload)}`);
  console.log(`POST /api/mailbox/send ${sent.status} mail=${sent.id ? '<' + sent.id.slice(0, 8) + '>' : '-'}`);
  if (sent.id) {
    fs.appendFileSync(__dirname + '/work/s-sent-mail-ids.txt', sent.id + '\n');
    const row = execFileSync(__dirname + '/psql.sh', ['-Atc', `select json_build_object('recipient_is_owner', recipient_user_id = '3d61b2c3-d767-458a-82ff-a63c5c85da99', 'attn_is_owner', attn_user_id = '3d61b2c3-d767-458a-82ff-a63c5c85da99', 'attn_user_id_set', attn_user_id is not null, 'delivery_visibility', delivery_visibility, 'delivery_target_type', delivery_target_type, 'address_home_id_set', address_home_id is not null, 'sender_display', sender_display, 'display_title', display_title, 'mail_type', mail_type) from "Mail" where id = '${sent.id}'`]).toString().trim();
    console.log('stored: ' + row);
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
