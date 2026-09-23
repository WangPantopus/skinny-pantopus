// The owner's real Home badge (GET /api/homes/:id/dashboard today.unread_mail_count), per letter: every probe
// letter marked read except one; contribution = badge - badge with all six read. Toggles only the six probe rows.
const { login, api } = require('./h.cjs'); const fs = require('fs'); const { execFileSync } = require('child_process');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const L = Object.fromEntries(fs.readFileSync(__dirname + '/work/y-fixture-ids.txt', 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const KEYS = ['y_shared', 'y_v1_noattn', 'y_attn_members', 'y_attn_only', 'y_attn_admins', 'y_private'];
const all = KEYS.map(k => `'${L[k]}'`).join(',');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
(async () => {
  const label = process.argv[2] || '';
  const o = await login('owner');
  const badge = async () => (await api('GET', `/api/homes/${HOME}/dashboard`, o)).json?.today?.unread_mail_count;
  sql(`update "Mail" set viewed = true where id in (${all})`);
  const base = await badge();
  const cells = [];
  for (const k of KEYS) {
    sql(`update "Mail" set viewed = false where id = '${L[k]}'`);
    cells.push((await badge()) - base);
    sql(`update "Mail" set viewed = true where id = '${L[k]}'`);
  }
  sql(`update "Mail" set viewed = false where id in (${all})`);
  const full = await badge();
  console.log(`# owner real badge per probe letter (${label}); order: ${KEYS.join(' ')}\nowner    ${cells.join(' ')}   (badge with all six read ${base}; with all six unread ${full})`);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
