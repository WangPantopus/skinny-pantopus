// origin_home_id guard: who may post (create, edit, magic post) a task "from" the fixture Home.
// Prints statuses, and whether a Gig row was written, per case. Never prints tokens.
// Usage: node gig-home-guard-probe.cjs <label>
const h = require('./h.cjs');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const loc = (homeId) => ({ mode: homeId ? 'home' : 'address', latitude: 45.6387, longitude: -122.6615,
  address: '100 Synthetic St, Vancouver, WA', ...(homeId ? { homeId } : {}) });
const keep = (id) => id && fs.appendFileSync(__dirname + '/work/t19-made-gig-ids.txt', id + '\n');
const rows = (title) => sql(`select count(*) || ' row(s)' || coalesce(' origin=' || string_agg(coalesce(origin_home_id::text, 'none'), ','), '') from "Gig" where title = '${title}'`).replace(HOME, '<home>');
(async () => {
  const label = process.argv[2] || 'run';
  const [stranger, former, viewer, owner] = await Promise.all(['rdnohome', 'rdmember', 'viewer', 'owner'].map((w) => h.login(w)));
  console.log(`# ${label}`);
  const create = async (who, sess, title, homeId) => {
    const r = await h.api('POST', '/api/gigs', sess, { title, description: 'Synthetic Stream2 guard probe task.', price: 25, category: 'General', location: loc(homeId) });
    const g = r.json && r.json.gig; keep(g && g.id);
    console.log(`${who.padEnd(9)} POST /api/gigs ${homeId ? 'from <home>' : 'no Home   '} ${r.status} ${r.status >= 400 ? JSON.stringify(r.json) : ''} -> ${rows(title)}`);
    return g && g.id;
  };
  const magic = async (who, sess, title, homeId) => {
    const r = await h.api('POST', '/api/gigs/magic-post', sess, { text: `${title} please`, location: loc(homeId),
      task_format: 'in_person', draft: { title, description: 'Synthetic Stream2 guard probe magic task.', pay_type: 'fixed', budget_fixed: 30, schedule_type: 'flexible' } });
    const g = r.json && (r.json.gig || r.json.task); keep(g && g.id);
    console.log(`${who.padEnd(9)} POST /api/gigs/magic-post ${homeId ? 'from <home>' : 'no Home'} ${r.status} ${r.status >= 400 ? JSON.stringify(r.json) : ''} -> ${rows(title)}`);
    return g && g.id;
  };
  const edit = async (who, sess, id, title, homeId) => {
    const r = await h.api('PATCH', `/api/gigs/${id}`, sess, { location: loc(homeId) });
    console.log(`${who.padEnd(9)} PATCH /api/gigs/<own task> to ${homeId ? '<home>' : 'no Home'} ${r.status} ${r.status >= 400 ? JSON.stringify(r.json) : ''} -> ${rows(title)}`);
  };
  const t = (s) => `Stream2 RD guard ${label} ${s}`;
  await create('stranger', stranger, t('stranger create'), HOME);
  await magic('stranger', stranger, t('stranger magic'), HOME);
  const own = await create('stranger', stranger, t('stranger own task'), null);
  if (own) await edit('stranger', stranger, own, t('stranger own task'), HOME);
  await create('former', former, t('former member create'), HOME);
  await create('viewer', viewer, t('member create'), HOME);
  const om = await magic('owner', owner, t('owner magic'), HOME);
  if (om) await edit('owner', owner, om, t('owner magic'), HOME);
  await create('owner', owner, t('owner no Home'), null);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
