// POST /api/gigs/magic-post with and without task_format, in person (a place) and remote (no place).
// Prints status, error, and the stored task_format per case. Never prints tokens.
// Usage: node magic-post-probe.cjs <label>
const h = require('./h.cjs');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const place = { mode: 'address', latitude: 45.6387, longitude: -122.6615, address: '100 Synthetic St, Vancouver, WA' };
(async () => {
  const label = process.argv[2] || 'run';
  const owner = await h.login('owner');
  console.log(`# ${label}`);
  for (const [name, location, extra] of [
    ['in person, no task_format', place, {}],
    ['remote (no place), no task_format', null, {}],
    ['remote (no place), task_format remote', null, { task_format: 'remote' }],
    ['in person, task_format in_person', place, { task_format: 'in_person' }],
  ]) {
    const title = `Stream2 RD magic ${label} ${name}`;
    const r = await h.api('POST', '/api/gigs/magic-post', owner, { text: `${title} please help`, location, ...extra,
      draft: { title, description: 'Synthetic Stream2 magic post probe task.', pay_type: 'fixed', budget_fixed: 30, schedule_type: 'flexible' } });
    const id = r.json && r.json.gig && r.json.gig.id;
    if (id) fs.appendFileSync(__dirname + '/work/t14-made-gig-ids.txt', id + '\n');
    const stored = id ? sql(`select task_format from "Gig" where id = '${id}'`) : '-';
    console.log(`${name.padEnd(40)} ${r.status} ${r.status >= 400 ? JSON.stringify(r.json) : ''} stored task_format=${stored}`);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
