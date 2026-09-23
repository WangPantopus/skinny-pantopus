// T45: what the compose home context returns for the fixture Home (GET /api/mailbox/compose/home-context/:homeId).
// Usage: node t45-home-context.cjs <label>
const h = require('./h.cjs'); const fs = require('node:fs'); const { execFileSync } = require('node:child_process');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [label] = process.argv.slice(2);
  const active = execFileSync(__dirname + '/psql.sh', ['-At', '-c', `select count(*) from "HomeOccupancy" where home_id='${HOME}' and is_active`], { encoding: 'utf8' }).trim();
  const o = await h.login('owner');
  const r = await h.api('GET', `/api/mailbox/compose/home-context/${HOME}`, o);
  const j = r.json || {};
  const line = `# ${label} home-context (${new Date().toISOString()}): active occupancies in DB ${active}; GET -> ${r.status} memberCount ${j.memberCount}, members ${JSON.stringify((j.members || []).map((m) => `${m.name} (${m.role})`))}`;
  console.log(line);
  fs.writeFileSync(`${__dirname}/work/t45-${label}-home-context.txt`, line + '\n');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
