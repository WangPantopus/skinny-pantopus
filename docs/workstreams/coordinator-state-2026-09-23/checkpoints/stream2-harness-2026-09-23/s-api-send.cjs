// mail_extracted send fix: API send without compose metadata, Home destination, attention viewer, attn_only.
const { login, api } = require('./h.cjs'); const fs = require('fs'); const { execFileSync } = require('child_process');
(async () => {
  const label = process.argv[2];
  const o = await login('owner');
  const r = await api('POST', '/api/mailbox/send', o, { destination: { deliveryTargetType: 'home', homeId: 'f0e51100-0000-4000-8000-000000000200', attnUserId: '20bd1f37-7f90-49a4-8445-47eb5acb395d', attnLabel: 'Stream2 Viewer', visibility: 'attn_only' },
    envelope: { type: 'letter', subject: `Stream2 S api attn_only letter ${label}` },
    object: { format: 'mailjson_v1', mimeType: 'application/json', title: 'x', content: 'Synthetic Stream2 send-fix probe', payload: { bodyFormat: 'plain_text' } } });
  const id = r.json?.mail?.id;
  console.log(`# owner POST /api/mailbox/send (API, Home, attn viewer, attn_only, no compose metadata) [${label}] ${new Date().toISOString()}\nstatus ${r.status} mail=${id ? '<' + id.slice(0, 8) + '>' : '-'}`);
  if (!id) return;
  fs.appendFileSync(__dirname + '/work/s-sent-mail-ids.txt', id + '\n');
  console.log('stored: ' + execFileSync(__dirname + '/psql.sh', ['-Atc', `select json_build_object('attn_is_viewer', attn_user_id = '20bd1f37-7f90-49a4-8445-47eb5acb395d', 'attn_user_id_set', attn_user_id is not null, 'attn_label', attn_label, 'delivery_visibility', delivery_visibility, 'delivery_target_type', delivery_target_type, 'sender_display', sender_display) from "Mail" where id = '${id}'`]).toString().trim());
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
