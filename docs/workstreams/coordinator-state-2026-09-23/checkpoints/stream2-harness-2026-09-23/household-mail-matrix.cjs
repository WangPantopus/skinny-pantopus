// Household mail delivery matrix after the drawer fix (API): who lists each letter in which drawer, and the item read.
// Letters from the owner: to the Home (all members), to the Home for the lease resident's attention only, and to the
// lease resident as a person at the Home. Also a non-member trying to send to the Home.
const h = require('./h.cjs'); const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const owner = await h.login('owner'); const viewer = await h.login('viewer'); const rdios = await h.login('rdios'); const stranger = await h.login('rdnohome');
  const send = async (who, body, name) => {
    const r = await h.api('POST', '/api/mailbox/send', who, { type: 'notice', subject: `Stream2 RD matrix: ${name}`, content: 'Synthetic household mail matrix letter.', ...body });
    const id = r.json && r.json.mail && r.json.mail.id; if (id) fs.appendFileSync(__dirname + '/work/t35-mail-ids.txt', id + '\n');
    return { status: r.status, id, error: r.json && r.json.error };
  };
  const view = async (id) => {
    const out = [];
    for (const [name, s] of [['owner', owner], ['viewer', viewer], ['rdios', rdios], ['rdnohome', stranger]]) {
      const seen = [];
      for (const d of ['home', 'personal']) {
        const r = await h.api('GET', `/api/mailbox/v2/drawer/${d}?limit=50&offset=0&tab=incoming`, s);
        if (((r.json && r.json.mail) || []).some((m) => m.id === id)) seen.push(d);
      }
      const item = await h.api('GET', `/api/mailbox/v2/item/${id}`, s);
      out.push(`${name}: ${seen.join('+') || '-'} / item ${item.status}`);
    }
    return out.join('; ');
  };
  const cases = [
    ['to the Home (all members)', owner, { destination: { deliveryTargetType: 'home', homeId: HOME, visibility: 'home_members' } }],
    ['to the Home, attention: lease resident only', owner, { destination: { deliveryTargetType: 'home', homeId: HOME, attnUserId: viewer.id, visibility: 'attn_only' } }],
    ['to the lease resident as a person at the Home', owner, { destination: { deliveryTargetType: 'user', homeId: HOME, userId: viewer.id, attnUserId: viewer.id, visibility: 'attn_only' } }],
    ['non-member sends to the Home', stranger, { destination: { deliveryTargetType: 'home', homeId: HOME, visibility: 'home_members' } }],
  ];
  for (const [name, who, body] of cases) {
    const r = await send(who, body, name);
    if (!r.id) { console.log(`${name}: send ${r.status} ${JSON.stringify(r.error)}`); continue; }
    const row = sql(`select 'drawer=' || drawer || ' recipient_user=' || coalesce(left(recipient_user_id::text,8),'null') || ' target=' || coalesce(delivery_target_type,'null') || ' visibility=' || coalesce(delivery_visibility,'null') || ' attn=' || coalesce(left(attn_user_id::text,8),'null') from "Mail" where id='${r.id}'`);
    console.log(`${name}: send ${r.status} (${row}) -> ${await view(r.id)}`);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
