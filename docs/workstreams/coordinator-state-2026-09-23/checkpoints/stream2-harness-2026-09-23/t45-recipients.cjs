// T45: the compose recipient list for the owner typing a name fragment with the fixture Home selected
// (GET /api/mailbox/compose/recipients?q=<text>&homeId=<home>), in the order the API returns it. People who live in
// the Home (active occupancy) are marked [household].
// Usage: node t45-recipients.cjs <label> [text]
const h = require('./h.cjs'); const fs = require('node:fs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [label, text = 'Package'] = process.argv.slice(2);
  const household = new Set(require('node:child_process').execFileSync(__dirname + '/psql.sh', ['-At', '-c',
    `select user_id from "HomeOccupancy" where home_id='${HOME}' and is_active`], { encoding: 'utf8' }).trim().split('\n'));
  const o = await h.login('owner');
  const r = await h.api('GET', `/api/mailbox/compose/recipients?q=${encodeURIComponent(text)}&homeId=${HOME}`, o);
  const list = ((r.json && r.json.recipients) || []).map((x, i) => `${i + 1}. ${x.name}${household.has(x.userId) ? ' [household]' : ''}`);
  const line = `# ${label} recipients (${new Date().toISOString()}): owner types "${text}" with the Home selected -> ${r.status}, ${list.length} results: ${JSON.stringify(list)}`;
  console.log(line);
  fs.appendFileSync(`${__dirname}/work/t45-${label}-recipients.txt`, line + '\n');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
