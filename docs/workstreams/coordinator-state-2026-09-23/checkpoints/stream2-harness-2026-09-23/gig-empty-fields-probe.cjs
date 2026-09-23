// POST /api/gigs and PATCH /api/gigs/:id with empty optional fields sent as null (what the web classic form
// sends), omitted, and invalid. Prints status and the validation message. Never prints tokens.
// Usage: node gig-empty-fields-probe.cjs <label>
const h = require('./h.cjs');
const fs = require('node:fs');
const place = { mode: 'address', latitude: 45.6387, longitude: -122.6615, address: '100 Synthetic St, Vancouver, WA' };
const base = (t) => ({ title: `Stream2 RD empty fields ${t}`, description: 'Synthetic Stream2 empty optional fields probe.', price: 30, location: place });
const say = (r) => (r.status >= 400 ? `${JSON.stringify(r.json && (r.json.details ? r.json.details.map((d) => d.message) : r.json.error))}` : '');
(async () => {
  const label = process.argv[2] || 'run';
  const owner = await h.login('owner');
  console.log(`# ${label}`);
  const keep = (r) => { const id = r.json && r.json.gig && r.json.gig.id; if (id) fs.appendFileSync(__dirname + '/work/t18-made-gig-ids.txt', id + '\n'); return id; };
  const create = async (name, extra) => { const r = await h.api('POST', '/api/gigs', owner, { ...base(`${label} ${name}`), ...extra }); keep(r); console.log(`POST ${name.padEnd(44)} ${r.status} ${say(r)}`); return r; };
  await create('deadline/duration/category null', { deadline: null, estimated_duration: null, category: null });
  await create('scheduled_start null', { scheduled_start: null });
  const ok = await create('fields omitted', {});
  await create('deadline "not-a-date"', { deadline: 'not-a-date' });
  await create('deadline in the past', { deadline: '2020-01-01T00:00:00.000Z' });
  await create('estimated_duration -2', { estimated_duration: -2 });
  const id = ok.json && ok.json.gig && ok.json.gig.id;
  if (id) {
    for (const [name, body] of [['deadline/duration/category null', { deadline: null, estimated_duration: null, category: null }],
      ['set deadline + duration', { deadline: '2026-11-01T00:00:00.000Z', estimated_duration: 3 }],
      ['clear deadline + duration (null)', { deadline: null, estimated_duration: null }],
      ['estimated_duration -2', { estimated_duration: -2 }]]) {
      const r = await h.api('PATCH', `/api/gigs/${id}`, owner, body);
      const g = r.json && r.json.gig;
      console.log(`PATCH ${name.padEnd(43)} ${r.status} ${say(r)}${g ? ` -> deadline=${g.deadline} estimated_duration=${g.estimated_duration}` : ''}`);
    }
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
