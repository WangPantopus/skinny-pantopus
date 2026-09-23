// T38: a letter sent through the real web compose modal (Structured Object, recipient = the lease resident as a
// person at the fixture Home), with a typed "Sender business name". Prints the send answer and the stored row.
// Usage: node web-t38-compose.cjs <sender> <subject-tag> <typed business name>
const w = require('./web-lib.cjs'); const h = require('./h.cjs'); const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [sender, tag, typed] = process.argv.slice(2);
  const viewer = await h.login('viewer');
  const b = await w.browser(); const c = h.creds(sender);
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, userAgent: 'stream2-r06-web-chrome' });
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const p = await ctx.newPage();
  let status = null; let mailId = null; let sentBody = null;
  p.on('request', (r) => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/mailbox/send') { try { sentBody = JSON.parse(r.postData() || '{}'); } catch (_) {} } });
  p.on('response', async (r) => {
    if (r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/mailbox/send') {
      status = r.status(); try { const j = await r.json(); mailId = j && j.mail && j.mail.id; } catch (_) {}
      if (mailId) fs.appendFileSync(__dirname + '/work/t38-mail-ids.txt', mailId + '\n');
    }
  });
  await p.goto(`${w.WEB}/app/mailbox?scope=home&homeId=${HOME}`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.getByRole('button', { name: /Compose/ }).first().click();
  await p.waitForTimeout(1500);
  await p.getByRole('button', { name: 'Structured Object' }).click();
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'user', exact: true }).click();
  await p.getByPlaceholder('Search by name, username, or email').last().fill(viewer.id);
  await p.getByPlaceholder('Subject', { exact: true }).fill(`Stream2 T38 web-${tag}`);
  await p.getByPlaceholder('Object content...').fill(`Synthetic Stream2 sender identity letter web-${tag}, sent from the web compose.`);
  await p.getByPlaceholder('Sender business name (optional)').fill(typed);
  await p.getByRole('button', { name: 'Send', exact: true }).click();
  await p.waitForTimeout(4000);
  const said = (await p.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => /sent|Failed|error|required/i.test(l)).slice(0, 3);
  console.log(`# web-${tag}: ${sender} sends from the web compose (Structured Object) with Sender business name "${typed}"`);
  console.log(`  request envelope.senderBusinessName: ${JSON.stringify(sentBody && sentBody.envelope && sentBody.envelope.senderBusinessName)}; POST /api/mailbox/send -> ${status}; page says ${JSON.stringify(said)}`);
  if (mailId) console.log('  stored: ' + sql(`select 'sender_trust=' || coalesce(sender_trust,'null') || ' sender_business_name=' || coalesce('"' || sender_business_name || '"','null') || ' sender_display="' || coalesce(sender_display,'') || '"' from "Mail" where id='${mailId}'`));
  await p.screenshot({ path: `${w.OUT}/t38-web-${tag}-compose.png` });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
