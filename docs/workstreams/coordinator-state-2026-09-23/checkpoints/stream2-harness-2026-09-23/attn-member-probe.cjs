// Attention/recipient member checks on the v1 send (the API the compose screens call), as the owner.
// Home letters (attn_only) to: missing account, former resident, stranger, viewer (control);
// person letters to: viewer, editor, rdios (member), stranger, former resident; and "self".
// Usage: node attn-member-probe.cjs <tag>
const h = require('./h.cjs');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const extra = h.envFile(__dirname + '/extra-accounts.env');
const P = {
  viewer: '20bd1f37-7f90-49a4-8445-47eb5acb395d', editor: 'de50270f-222e-405f-bc30-9ecc7801c245',
  rdios: '600214de-e561-4f19-81a9-4bcc297b13e6', former: 'eb4390ef-e6f5-42bd-8004-25a65de2dabe',
  stranger: extra.RDNOHOME_ID, missing: randomUUID(),
};
(async () => {
  const tag = process.argv[2] || 'run';
  const owner = await h.login('owner');
  const made = [];
  const send = async (label, body) => {
    const r = await h.api('POST', '/api/mailbox/send', owner, body);
    const id = r.json && r.json.mail && r.json.mail.id;
    if (id) made.push(id);
    console.log(`${label}: HTTP ${r.status} ${r.json && r.json.error ? JSON.stringify(r.json.error) : ''}${id ? ' id=' + id.slice(0, 8) : ''}`);
  };
  console.log(`# ${tag}: owner sends via POST /api/mailbox/send`);
  for (const k of ['missing', 'former', 'stranger', 'viewer']) {
    await send(`home letter, attn_only for ${k}`, { destination: { deliveryTargetType: 'home', homeId: HOME, attnUserId: P[k], visibility: 'attn_only' },
      envelope: { type: 'letter', subject: `Stream2 RD attn ${tag} home ${k}` }, content: 'Synthetic attention probe.' });
  }
  for (const k of ['viewer', 'editor', 'rdios', 'stranger', 'former']) {
    await send(`person letter to ${k}`, { destination: { deliveryTargetType: 'user', homeId: HOME, userId: P[k], attnUserId: P[k], visibility: 'attn_only' },
      envelope: { type: 'letter', subject: `Stream2 RD attn ${tag} person ${k}` }, content: 'Synthetic person probe.' });
  }
  await send('person letter to self (owner)', { destination: { deliveryTargetType: 'user', homeId: HOME, userId: owner.id, attnUserId: owner.id, visibility: 'attn_only' },
    envelope: { type: 'letter', subject: `Stream2 RD attn ${tag} person self` }, content: 'Synthetic self probe.' });
  fs.appendFileSync(__dirname + '/work/t4-made-mail-ids.txt', made.map((id) => `${tag} ${id}`).join('\n') + (made.length ? '\n' : ''));
  console.log(`created ${made.length} letters (ids in work/t4-made-mail-ids.txt)`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
