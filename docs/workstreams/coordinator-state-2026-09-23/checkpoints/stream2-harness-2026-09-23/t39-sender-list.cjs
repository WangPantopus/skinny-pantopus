// T39: GET /api/mailbox/sender-businesses for each fixture account (and with the editor's mail.send override), plus
// what POST /send now returns for the business. Usage: node t39-sender-list.cjs <label>
const h = require('./h.cjs'); const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [label] = process.argv.slice(2);
  const bakery = fs.readFileSync(__dirname + '/work/t38-business-ids.txt', 'utf8').split('\n').find((l) => l.startsWith('bakery ')).split(' ')[1];
  const show = (r) => `${r.status} ${JSON.stringify((r.json && r.json.businesses || []).map((b) => `${b.name}${b.verified ? ' (verified)' : ''}`))}`;
  console.log(`# ${label} (${new Date().toISOString()})`);
  for (const who of ['owner', 'editor', 'viewer', 'rdnohome']) {
    const s = await h.login(who);
    console.log(`  ${who}: GET /api/mailbox/sender-businesses -> ${show(await h.api('GET', '/api/mailbox/sender-businesses', s))}`);
  }
  console.log(`  no session -> ${(await h.api('GET', '/api/mailbox/sender-businesses', null)).status}`);
  const editor = await h.login('editor'); const viewer = await h.login('viewer'); const owner = await h.login('owner');
  sql(`insert into "BusinessPermissionOverride" (business_user_id, user_id, permission, allowed) values ('${bakery}', '${editor.id}', 'mail.send', true)`);
  console.log(`  editor with a mail.send override on the bakery -> ${show(await h.api('GET', '/api/mailbox/sender-businesses', editor))}`);
  sql(`delete from "BusinessPermissionOverride" where business_user_id='${bakery}' and user_id='${editor.id}' and permission='mail.send'`);
  console.log(`  override removed -> ${show(await h.api('GET', '/api/mailbox/sender-businesses', editor))}`);
  for (const [tag, who, biz] of [['S1', owner, 'Stream2 T38 Verified Bakery'], ['S2', editor, 'Clark County Utilities']]) {
    const r = await h.api('POST', '/api/mailbox/send', who, { type: 'letter', subject: `Stream2 T39 api-${tag}`, content: `Synthetic Stream2 letter api-${tag}.`, senderBusinessName: biz,
      destination: { deliveryTargetType: 'user', homeId: HOME, userId: viewer.id, attnUserId: viewer.id, visibility: 'attn_only' } });
    const id = r.json && r.json.mail && r.json.mail.id; if (id) fs.appendFileSync(__dirname + '/work/t39-mail-ids.txt', id + '\n');
    console.log(`  ${who.id === owner.id ? 'owner' : 'editor'} sends with "${biz}": ${r.status}; response mail.senderBusinessName=${JSON.stringify(r.json && r.json.mail && r.json.mail.senderBusinessName)}`);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
