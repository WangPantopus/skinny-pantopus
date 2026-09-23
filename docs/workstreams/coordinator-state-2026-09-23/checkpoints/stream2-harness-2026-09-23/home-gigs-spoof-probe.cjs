// Does POST /api/gigs accept a location.homeId the poster has no access to, and would the new
// GET /api/homes/:id/gigs then show that stranger's task on the household's card?
// Usage: node home-gigs-spoof-probe.cjs <label>
const h = require('./h.cjs');
const fs = require('node:fs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const label = process.argv[2] || 'run';
  const stranger = await h.login('rdnohome'); const owner = await h.login('owner');
  const access = await h.api('GET', `/api/homes/${HOME}/gigs`, stranger);
  console.log(`# ${label}`);
  console.log(`stranger GET /api/homes/<home>/gigs ${access.status} ${JSON.stringify(access.json)}`);
  const r = await h.api('POST', '/api/gigs', stranger, {
    title: 'Stream2 RD spoof: not from this Home', description: 'Synthetic Stream2 probe task, posted by a non-member.',
    price: 25, category: 'General',
    location: { mode: 'address', latitude: 45.6387, longitude: -122.6615, address: '100 Synthetic St, Vancouver, WA', homeId: HOME },
  });
  const gig = r.json && (r.json.gig || r.json);
  if (gig && gig.id) fs.appendFileSync(__dirname + '/work/t12-made-gig-ids.txt', gig.id + '\n');
  console.log(`stranger POST /api/gigs with location.homeId=<home> ${r.status} ${gig && gig.id ? 'gig=' + gig.id.slice(0, 8) + ' origin_home_id=' + (gig.origin_home_id === HOME ? '<home>' : gig.origin_home_id) : JSON.stringify(r.json).slice(0, 160)}`);
  const seen = await h.api('GET', `/api/homes/${HOME}/gigs`, owner);
  console.log(`owner GET /api/homes/<home>/gigs ${seen.status} ${JSON.stringify((seen.json.gigs || []).map((g) => `${g.status}:${g.title}`))}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
