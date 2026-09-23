// T36 fixture: letters from the lease resident (viewer) to the owner as a person at the fixture Home, through the real
// POST /api/mailbox/send. They land unread in the owner's Me (personal) drawer. Ids go to work/t36-mail-ids.txt.
// Usage: node t36-setup.cjs <label> [count]
const h = require('./h.cjs'); const fs = require('node:fs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [label, count = '3'] = process.argv.slice(2);
  const viewer = await h.login('viewer'); const owner = await h.login('owner');
  for (let i = 0; i < Number(count); i++) {
    const tag = String.fromCharCode(65 + i);
    const r = await h.api('POST', '/api/mailbox/send', viewer, {
      type: 'letter', subject: `Stream2 T36 letter ${label}-${tag}`, content: `Synthetic Stream2 letter ${label}-${tag} for the web mailbox checks.`,
      destination: { deliveryTargetType: 'user', homeId: HOME, userId: owner.id, attnUserId: owner.id, visibility: 'attn_only' },
    });
    const id = r.json && r.json.mail && r.json.mail.id;
    if (id) fs.appendFileSync(__dirname + '/work/t36-mail-ids.txt', id + '\n');
    console.log(`send ${label}-${tag}: ${r.status} ${id ? '<' + id.slice(0, 8) + '>' : JSON.stringify(r.json)}`);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
