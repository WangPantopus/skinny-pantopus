// Decision 5: an attn_only Home letter for the viewer, filed by the viewer into the Business drawer
// (POST /api/mailbox/v2/resolve, the call Android's routing/disambiguation screens and Mail Day triage make).
// Who can read it afterwards? Usage: node business-attn-probe.cjs <tag>
const h = require('./h.cjs');
const fs = require('node:fs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const tag = process.argv[2] || 'run';
  const owner = await h.login('owner'); const viewer = await h.login('viewer'); const editor = await h.login('editor');
  const s = await h.api('POST', '/api/mailbox/send', owner, {
    destination: { deliveryTargetType: 'home', homeId: HOME, attnUserId: viewer.id, visibility: 'attn_only' },
    envelope: { type: 'letter', subject: `Stream2 RD business attn ${tag}` }, content: 'Synthetic attn_only letter for the viewer.' });
  const id = s.json && s.json.mail && s.json.mail.id;
  console.log(`# ${tag}: owner sends attn_only Home letter for the viewer: HTTP ${s.status} id=${id ? id.slice(0, 8) : '-'}`);
  if (!id) process.exit(1);
  fs.appendFileSync(__dirname + '/work/t5-made-mail-ids.txt', `${tag} ${id}\n`);
  const check = async (label) => {
    const out = [];
    for (const [who, sess] of [['viewer (attention)', viewer], ['editor', editor], ['owner', owner]]) {
      const r = await h.api('GET', `/api/mailbox/v2/item/${id}`, sess);
      const d = await h.api('GET', '/api/mailbox/v2/drawer/business?limit=50', sess);
      const items = (d.json && (d.json.items || d.json.mail || d.json.data)) || [];
      out.push(`${who}: item ${r.status}, business drawer ${d.status} ${items.some((m) => m.id === id) ? 'LISTS it' : 'does not list it'}`);
    }
    console.log(`${label}\n  ${out.join('\n  ')}`);
  };
  await check('before filing (Home letter, attn_only for the viewer):');
  const res = await h.api('POST', '/api/mailbox/v2/resolve', viewer, { mailId: id, drawer: 'business' });
  console.log(`viewer files it into Business: POST /api/mailbox/v2/resolve HTTP ${res.status}`);
  await check('after filing into Business (privacy business_team):');
  // Control: an ordinary household letter (no attention person) filed into Business stays with the household.
  const hs = await h.api('POST', '/api/mailbox/send', owner, {
    destination: { deliveryTargetType: 'home', homeId: HOME }, envelope: { type: 'letter', subject: `Stream2 RD business household ${tag}` },
    content: 'Synthetic household letter.' });
  const hid = hs.json && hs.json.mail && hs.json.mail.id;
  if (hid) fs.appendFileSync(__dirname + '/work/t5-made-mail-ids.txt', `${tag} ${hid}\n`);
  const hr = await h.api('POST', '/api/mailbox/v2/resolve', viewer, { mailId: hid, drawer: 'business' });
  const out = [];
  for (const [who, sess] of [['viewer', viewer], ['editor', editor], ['owner', owner]]) {
    const r = await h.api('GET', `/api/mailbox/v2/item/${hid}`, sess); out.push(`${who}: item ${r.status}`);
  }
  console.log(`control household letter ${hid ? hid.slice(0, 8) : '-'} filed into Business (HTTP ${hr.status}): ${out.join(', ')}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
