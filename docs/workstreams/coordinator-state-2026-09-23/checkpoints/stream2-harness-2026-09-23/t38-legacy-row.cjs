// T38: a legacy-shaped letter (sender_trust NULL, a typed sender_business_name, a user sender), inserted by SQL as a
// fixture because the current send route always stores sender_trust. What the lease resident's v2 drawer and item
// read report for it. Usage: node t38-legacy-row.cjs <label> [create]
const h = require('./h.cjs'); const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
(async () => {
  const [label, create] = process.argv.slice(2);
  const viewer = await h.login('viewer'); const editor = await h.login('editor');
  let id = fs.existsSync(__dirname + '/work/t38-legacy-id.txt') ? fs.readFileSync(__dirname + '/work/t38-legacy-id.txt', 'utf8').trim() : '';
  if (create) {
    id = sql(`insert into "Mail" (recipient_user_id, sender_user_id, sender_business_name, sender_display, sender_trust, type, subject, content, drawer, mail_object_type, lifecycle) values ('${viewer.id}', '${editor.id}', 'Clark County Utilities', 'Clark County Utilities', null, 'letter', 'Stream2 T38 legacy-L', 'Synthetic legacy-shaped letter: no sender_trust, a typed business name.', 'personal', 'envelope', 'delivered') returning id`).split('\n')[0];
    fs.writeFileSync(__dirname + '/work/t38-legacy-id.txt', id + '\n'); fs.appendFileSync(__dirname + '/work/t38-mail-ids.txt', id + '\n');
  }
  const drawer = await h.api('GET', '/api/mailbox/v2/drawer/personal?limit=50', viewer);
  const d = ((drawer.json && drawer.json.mail) || []).find((m) => m.id === id) || {};
  const item = await h.api('GET', `/api/mailbox/v2/item/${id}`, viewer);
  console.log(`# ${label}: legacy-shaped letter <${id.slice(0, 8)}> (stored sender_trust NULL, sender_business_name "Clark County Utilities")\n  drawer: sender_trust=${d.sender_trust}; item: sender_trust=${item.json && item.json.mail && item.json.mail.sender_trust}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
