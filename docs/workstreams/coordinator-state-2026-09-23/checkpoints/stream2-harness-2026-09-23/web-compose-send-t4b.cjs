// mail_extracted send fix: send a letter through the real web Mailbox compose modal (quick mode, Home destination)
// and print the stored delivery fields. No tokens printed.
const w = require('./web-lib.cjs'); const { execFileSync } = require('child_process'); const fs = require('fs');
(async () => {
  const [who, label, shot] = process.argv.slice(2);
  const HOME = 'f0e51100-0000-4000-8000-000000000200';
  const b = await w.browser();
  // Desktop viewport: the compose modal's Send button sits below a phone-height viewport.
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
  await page.getByPlaceholder('Subject (optional)').fill(`Stream2 RD sender-list ${label}`);
  await page.getByPlaceholder('Write your message...').fill('Synthetic Stream2 send-fix probe from the web compose modal.');
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-a-compose.png` });
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForTimeout(5000);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-b-after-send.png` });
  console.log(`# web ${who}: Mailbox → Compose (quick, Home destination) → Send  [${label}] ${new Date().toISOString()}`);
  if (!sent) { console.log('no POST /api/mailbox/send observed'); await b.close(); return; }
  const p = sent.req || {};
  console.log(`request: destination=${JSON.stringify(p.destination)} object.payload=${JSON.stringify(p.object && p.object.payload)}`);
  console.log(`POST /api/mailbox/send ${sent.status} mail=${sent.id ? '<' + sent.id.slice(0, 8) + '>' : '-'}`);
  if (sent.id) {
    fs.appendFileSync(__dirname + '/work/t4b-sent-mail-ids.txt', sent.id + '\n');
    const row = execFileSync(__dirname + '/psql.sh', ['-Atc', `select json_build_object('recipient_home_id', recipient_home_id is not null, 'sender_display', sender_display, 'delivery_target_type', delivery_target_type, 'delivery_target_id_set', delivery_target_id is not null, 'address_home_id_set', address_home_id is not null, 'recipient_type', recipient_type, 'attn_label', attn_label, 'delivery_visibility', delivery_visibility, 'mail_type', mail_type, 'display_title', display_title, 'preview_text_set', preview_text is not null, 'primary_action', primary_action, 'content_excerpt_set', content_excerpt is not null, 'mail_extracted', mail_extracted) from "Mail" where id = '${sent.id}'`]).toString().trim();
    console.log('stored: ' + row);
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
