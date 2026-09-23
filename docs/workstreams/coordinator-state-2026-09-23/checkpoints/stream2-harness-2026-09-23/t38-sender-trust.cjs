// T38 sender business identity matrix (API): letters to the lease resident (viewer) as a person at the fixture Home,
// each with a different senderBusinessName, through the real POST /api/mailbox/send. For each: the stored Mail row,
// what the recipient's Me drawer and item read return, and the stored mail object's envelope.
// Usage: node t38-sender-trust.cjs <label>
const h = require('./h.cjs'); const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [label] = process.argv.slice(2);
  const owner = await h.login('owner'); const editor = await h.login('editor'); const viewer = await h.login('viewer');
  const cases = [
    ['A', 'editor (no business) types "Clark County Utilities"', editor, 'Clark County Utilities'],
    ['B', 'editor (bakery team viewer, no mail.send) types the bakery name', editor, 'Stream2 T38 Verified Bakery'],
    ['C', 'owner of the verified bakery types "stream2 t38 verified bakery"', owner, 'stream2 t38 verified bakery'],
    ['D', 'owner of the unverified studio types its name', owner, 'Stream2 T38 Unverified Studio'],
    ['E', 'owner types "Clark County Utilities" (not theirs)', owner, 'Clark County Utilities'],
    ['F', 'owner, no business name (control)', owner, null],
  ];
  console.log(`# ${label}: POST /api/mailbox/send, person letters to the lease resident (${new Date().toISOString()})`);
  for (const [tag, name, who, biz] of cases) {
    const body = { type: 'letter', subject: `Stream2 T38 ${label}-${tag}`, content: `Synthetic Stream2 sender identity letter ${label}-${tag}.`,
      destination: { deliveryTargetType: 'user', homeId: HOME, userId: viewer.id, attnUserId: viewer.id, visibility: 'attn_only' } };
    if (biz) body.senderBusinessName = biz;
    const r = await h.api('POST', '/api/mailbox/send', who, body);
    const id = r.json && r.json.mail && r.json.mail.id;
    if (!id) { console.log(`${tag} ${name}: send ${r.status} ${JSON.stringify(r.json)}`); continue; }
    fs.appendFileSync(__dirname + '/work/t38-mail-ids.txt', id + '\n');
    const row = sql(`select 'sender_trust=' || coalesce(sender_trust,'null') || ' sender_business_name=' || coalesce('"' || sender_business_name || '"','null') || ' sender_display="' || coalesce(sender_display,'') || '"' from "Mail" where id='${id}'`);
    const drawer = await h.api('GET', '/api/mailbox/v2/drawer/personal?limit=50', viewer);
    const d = ((drawer.json && drawer.json.mail) || []).find((m) => m.id === id) || {};
    const item = await h.api('GET', `/api/mailbox/v2/item/${id}`, viewer);
    const obj = await h.api('GET', `/api/mailbox/${id}/object`, viewer);
    const env = obj.json && obj.json.payload && obj.json.payload.envelope;
    console.log(`${tag} ${name}: send ${r.status}\n    stored: ${row}\n    recipient drawer: sender_trust=${d.sender_trust} sender_display="${d.sender_display}"; item: sender_trust=${item.json && item.json.mail && item.json.mail.sender_trust}\n    object envelope senderBusinessName: ${obj.status === 200 ? JSON.stringify(env && env.senderBusinessName) : 'object ' + obj.status}`);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
