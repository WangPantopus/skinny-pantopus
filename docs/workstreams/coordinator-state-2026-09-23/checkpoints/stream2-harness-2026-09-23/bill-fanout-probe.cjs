// Decision 6: a bill letter sent attn_only for the viewer. Does it fan out into a household HomeBill that
// finance viewers read? Control: the same bill sent to the whole household.
// Usage: node bill-fanout-probe.cjs <tag>
const h = require('./h.cjs');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
(async () => {
  const tag = process.argv[2] || 'run';
  const owner = await h.login('owner'); const viewer = await h.login('viewer');
  const send = async (label, destination) => {
    const r = await h.api('POST', '/api/mailbox/send', owner, { destination,
      envelope: { type: 'bill', subject: `Stream2 RD bill fanout ${tag} ${label}`, senderBusinessName: `Stream2 Probe Utility ${tag} ${label}`, payoutAmount: 7.5 },
      content: 'Synthetic bill letter for the fan-out check.' });
    const id = r.json && r.json.mail && r.json.mail.id;
    if (id) fs.appendFileSync(__dirname + '/work/t6-made-mail-ids.txt', `${tag} ${id}\n`);
    const bill = id ? sql(`select coalesce(string_agg(b.id::text || ':' || coalesce(b.provider_name,'') || ':' || b.amount, ','), 'none') from "MailLink" l join "HomeBill" b on b.id = l.target_id where l.mail_item_id = '${id}' and l.target_type = 'bill'`) : 'none';
    console.log(`${label}: send HTTP ${r.status} letter=${id ? id.slice(0, 8) : '-'} household HomeBill via MailLink: ${bill}`);
    return { id, bill };
  };
  console.log(`# ${tag}: owner sends a bill letter (type bill, payoutAmount 7.5)`);
  const attn = await send('attn-only-viewer', { deliveryTargetType: 'home', homeId: HOME, attnUserId: viewer.id, visibility: 'attn_only' });
  const house = await send('household', { deliveryTargetType: 'home', homeId: HOME });
  const list = await h.api('GET', `/api/homes/${HOME}/bills`, owner);
  const bills = (list.json && list.json.bills) || [];
  const names = bills.map((b) => b.provider_name).filter((n) => n && n.includes(`Stream2 Probe Utility ${tag}`));
  console.log(`owner (finance viewer, not the attention person) GET /api/homes/<home>/bills ${list.status}: ${JSON.stringify(names)}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
