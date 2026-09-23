// attn_only letters and household fan-outs: document (type document), package (type package),
// task (outcome create_task). Prints the MailLink targets each letter created, for attn_only vs household.
// Usage: node fanout-all-probe.cjs <tag>
const h = require('./h.cjs');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
(async () => {
  const tag = process.argv[2] || 'run';
  const owner = await h.login('owner'); const viewer = await h.login('viewer');
  const cases = [
    ['document', { type: 'document' }, {}],
    ['package', { type: 'package' }, {}],
    ['task', { type: 'letter' }, { outcomes: ['create_task'] }],
  ];
  console.log(`# ${tag}: owner sends letters; MailLink fan-out targets per letter`);
  for (const [label, envelope, payload] of cases) {
    for (const [scope, destination] of [
      ['attn_only for viewer', { deliveryTargetType: 'home', homeId: HOME, attnUserId: viewer.id, visibility: 'attn_only' }],
      ['household', { deliveryTargetType: 'home', homeId: HOME }],
    ]) {
      const r = await h.api('POST', '/api/mailbox/send', owner, { destination,
        envelope: { ...envelope, subject: `Stream2 RD fanout ${tag} ${label} ${scope}` },
        content: `Synthetic ${label} letter.`, object: { format: 'plain_text', content: `Synthetic ${label} letter.`, payload } });
      const id = r.json && r.json.mail && r.json.mail.id;
      if (id) fs.appendFileSync(__dirname + '/work/t8-made-mail-ids.txt', `${tag} ${id}\n`);
      const links = id ? sql(`select coalesce(string_agg(target_type, ','), 'none') from "MailLink" where mail_item_id = '${id}'`) : '-';
      let viewerOpens = '-';
      if (id && scope.startsWith('attn')) viewerOpens = (await h.api('GET', `/api/mailbox/v2/item/${id}`, viewer)).status;
      console.log(`${label.padEnd(8)} ${scope.padEnd(20)} send ${r.status} links=${links}${scope.startsWith('attn') ? ` viewer opens ${viewerOpens}` : ''}`);
    }
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
