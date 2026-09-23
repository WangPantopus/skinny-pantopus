// PR Y: the owner sends a real v1 letter to the Home, attention viewer, with the given visibility; then lists who
// was notified (Notification rows for that mail). No tokens printed.
const { login, api } = require('./h.cjs'); const fs = require('fs'); const { execFileSync } = require('child_process');
const HOME = 'f0e51100-0000-4000-8000-000000000200', VIEWER = '20bd1f37-7f90-49a4-8445-47eb5acb395d';
const names = { '3d61b2c3-d767-458a-82ff-a63c5c85da99': 'owner', [VIEWER]: 'viewer', 'de50270f-222e-405f-bc30-9ecc7801c245': 'editor', '971d5c92-cb5d-4e33-aa23-a0f2d00a01b7': 'xmember' };
(async () => {
  const [visibility, label] = process.argv.slice(2);
  const o = await login('owner');
  const r = await api('POST', '/api/mailbox/send', o, { destination: { deliveryTargetType: 'home', homeId: HOME, attnUserId: VIEWER, attnLabel: 'Stream2 Viewer', visibility },
    type: 'bill', subject: `Stream2 Y sent ${visibility} (${label})`, content: 'Synthetic Stream2 PR Y send probe', payoutAmount: 0,
    // A compose-style send (stationery set), as the app's compose sends it; see the note on mail_extracted.
    object: { format: 'mailjson_v1', payload: { stationeryTheme: 'classic_cream' } } });
  const mailId = r.json?.mail?.id || r.json?.id || r.json?.mailId;
  console.log(`# owner POST /api/mailbox/send (Home, attn viewer, visibility ${visibility}, compose stationery) ${label} ${new Date().toISOString()}\nstatus ${r.status}${r.status >= 400 ? ' ' + JSON.stringify(r.json).slice(0, 200) : ''} mail=${mailId ? '<' + mailId.slice(0, 8) + '>' : '-'}`);
  if (!mailId) return;
  const stored = execFileSync(__dirname + '/psql.sh', ['-Atc', `select coalesce(attn_user_id::text,'-') || ' ' || coalesce(delivery_visibility,'-') from "Mail" where id = '${mailId}'`]).toString().trim().split(' ');
  console.log(`stored attn=${names[stored[0]] || stored[0]} delivery_visibility=${stored[1]}`);
  fs.appendFileSync(__dirname + '/work/y-sent-mail-ids.txt', mailId + '\n');
  await new Promise(res => setTimeout(res, 4000));
  const rows = execFileSync(__dirname + '/psql.sh', ['-Atc', `select user_id, type, title from "Notification" where metadata->>'mail_id' = '${mailId}' order by user_id`]).toString().trim().split('\n').filter(Boolean);
  console.log(`notified: ${rows.map(l => names[l.split('|')[0]] || 'other').join(', ') || 'nobody'}`);
  for (const l of rows) console.log(`  ${names[l.split('|')[0]] || 'other'} | ${l.split('|').slice(1).join(' | ')}`);
  const ids = execFileSync(__dirname + '/psql.sh', ['-Atc', `select id from "Notification" where metadata->>'mail_id' = '${mailId}'`]).toString().trim();
  if (ids) fs.appendFileSync(__dirname + '/work/y-notification-ids.txt', ids + '\n');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
