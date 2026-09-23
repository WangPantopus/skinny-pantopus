// T45 share-ETA: the owner shares a package ETA with the household (POST /api/mailbox/v2/package/:id/share-eta) and
// we record the notices the other residents receive (stored row + what the recipient's mail detail API returns).
// Creates the package letter on first use (SQL, recorded in work/t45-mail-ids.txt with every notice id).
// Usage: node t45-share-eta.cjs <label>
const h = require('./h.cjs'); const fs = require('node:fs'); const { execFileSync } = require('node:child_process');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const IDS = __dirname + '/work/t45-mail-ids.txt';
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-At', '-F', '\t', '-c', q], { encoding: 'utf8' }).trim();
(async () => {
  const [label] = process.argv.slice(2);
  const out = [`# ${label} share-ETA (${new Date().toISOString()})`];
  const owner = await h.login('owner');
  let pkg = sql(`select id from "Mail" where recipient_user_id='${owner.id}' and subject='Stream2 T45 package from Parcel Co' limit 1`);
  if (!pkg) {
    pkg = sql(`insert into "Mail"(recipient_user_id, recipient_home_id, drawer, mail_object_type, type, category, subject, content, sender_display, sender_trust, urgency, privacy, lifecycle)
      values ('${owner.id}', '${HOME}', 'home', 'envelope', 'package', 'package', 'Stream2 T45 package from Parcel Co', 'Synthetic Stream2 package letter.', 'Stream2 T45 Parcel Co', 'unknown', 'none', 'shared_household', 'delivered') returning id`).split('\n')[0];
    fs.appendFileSync(IDS, pkg + '\n');
    out.push(`package letter created by SQL for the owner: <${pkg.slice(0, 8)}> sender "Stream2 T45 Parcel Co"`);
  }
  const since = sql('select now()');
  const r = await h.api('POST', `/api/mailbox/v2/package/${pkg}/share-eta`, owner);
  out.push(`POST share-eta as the owner -> ${r.status} ${JSON.stringify(r.json)}`);
  const names = { [owner.id]: 'owner' };
  for (const w of ['viewer', 'editor', 'rdios', 'rdmember', 'rdnohome']) names[h.creds(w).id] = w;
  const rows = sql(`select id, recipient_user_id, sender_display, sender_trust, sender_user_id, subject, content from "Mail"
    where subject = 'Package from Stream2 T45 Parcel Co arriving soon' and created_at >= '${since}' order by recipient_user_id`);
  const created = rows ? rows.split('\n').map((l) => l.split('\t')) : [];
  for (const [id, rec, disp, trust, su, subj, content] of created) {
    fs.appendFileSync(IDS, id + '\n');
    out.push(`  notice <${id.slice(0, 8)}> to ${names[rec] || rec.slice(0, 8)}: sender_display ${JSON.stringify(disp)}, sender_trust ${trust}, sender_user_id ${names[su] || su}, subject ${JSON.stringify(subj)}, content ${JSON.stringify(content)}`);
  }
  const mine = created.find((c) => names[c[1]] === 'viewer');
  if (mine) {
    const viewer = await h.login('viewer');
    const d = await h.api('GET', `/api/mailbox/v2/item/${mine[0]}`, viewer);
    const it = d.json && (d.json.item || d.json.mail || d.json);
    out.push(`  the lease resident's GET /api/mailbox/v2/item/<${mine[0].slice(0, 8)}> -> ${d.status}: sender_display ${JSON.stringify(it && it.sender_display)}, sender_trust ${JSON.stringify(it && it.sender_trust)}, subject ${JSON.stringify(it && it.subject)}`);
  }
  console.log(out.join('\n'));
  fs.writeFileSync(`${__dirname}/work/t45-${label}.txt`, out.join('\n') + '\n');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
