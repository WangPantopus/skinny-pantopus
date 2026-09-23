// T42 fixture for the web Community prompt: a person letter from the lease resident to the owner (real send), and a
// CommunityMailItem for it with neighbors_received 0 (SQL), so the owner's Community page shows the share prompt.
const h = require('./h.cjs'); const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim().split('\n')[0];
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const owner = await h.login('owner'); const viewer = await h.login('viewer');
  const r = await h.api('POST', '/api/mailbox/send', viewer, { type: 'notice', subject: 'Stream2 T42 street closure notice', content: 'Synthetic Stream2 notice for the Community share prompt.',
    destination: { deliveryTargetType: 'user', homeId: HOME, userId: owner.id, attnUserId: owner.id, visibility: 'attn_only' } });
  const mailId = r.json && r.json.mail && r.json.mail.id;
  fs.appendFileSync(__dirname + '/work/t42-mail-ids.txt', mailId + '\n');
  const item = sql(`insert into "CommunityMailItem" (mail_id, published_by, home_id, community_type, published_to, title, sender_display, neighbors_received) values ('${mailId}', '${viewer.id}', '${HOME}', 'civic_notice', 'neighborhood', 'Stream2 T42 street closure notice', 'Stream2 Viewer', 0) returning id`);
  fs.appendFileSync(__dirname + '/work/t42-community-ids.txt', item + '\n');
  console.log(`letter ${r.status} <${mailId.slice(0, 8)}>; community item <${item.slice(0, 8)}>`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
