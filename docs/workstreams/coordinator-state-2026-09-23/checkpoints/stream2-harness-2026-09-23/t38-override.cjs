// T38: the editor (a 'viewer' on the verified bakery's team) gets a per-user override allowing mail.send (SQL
// fixture), sends a letter with the bakery's name through the real send route, then the override is removed.
const h = require('./h.cjs'); const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const editor = await h.login('editor'); const viewer = await h.login('viewer');
  const bakery = fs.readFileSync(__dirname + '/work/t38-business-ids.txt', 'utf8').split('\n').find((l) => l.startsWith('bakery ')).split(' ')[1];
  console.log(`# override: editor gets mail.send on the bakery (${new Date().toISOString()})`);
  console.log('  ' + sql(`insert into "BusinessPermissionOverride" (business_user_id, user_id, permission, allowed) values ('${bakery}', '${editor.id}', 'mail.send', true) returning 'override allowed=' || allowed`).split('\n')[0]);
  const r = await h.api('POST', '/api/mailbox/send', editor, { type: 'letter', subject: 'Stream2 T38 override-M', content: 'Synthetic Stream2 sender identity letter override-M.', senderBusinessName: 'Stream2 T38 Verified Bakery',
    destination: { deliveryTargetType: 'user', homeId: HOME, userId: viewer.id, attnUserId: viewer.id, visibility: 'attn_only' } });
  const id = r.json && r.json.mail && r.json.mail.id; if (id) fs.appendFileSync(__dirname + '/work/t38-mail-ids.txt', id + '\n');
  console.log(`  editor sends with "Stream2 T38 Verified Bakery": ${r.status}; stored: ` + sql(`select 'sender_trust=' || coalesce(sender_trust,'null') || ' sender_business_name=' || coalesce('"' || sender_business_name || '"','null') from "Mail" where id='${id}'`));
  console.log('  removed: ' + sql(`delete from "BusinessPermissionOverride" where business_user_id='${bakery}' and user_id='${editor.id}' and permission='mail.send' returning 'override deleted'`).split('\n')[0]);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
