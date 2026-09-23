// Decision 3 (Home gigs): GET /api/homes/:id/gigs and /nearby-gigs as the owner, a lease resident,
// a stranger, and with a malformed Home id. Prints status and the gig titles (never tokens).
// Usage: node home-gigs-probe.cjs <label>
const h = require('./h.cjs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const label = process.argv[2] || 'run';
  console.log(`# ${label}`);
  const show = (r) => (r.status === 200 ? JSON.stringify((r.json.gigs || []).map((g) => `${g.status}:${g.title}`)) : JSON.stringify(r.json));
  for (const who of ['owner', 'viewer', 'rdnohome']) {
    const s = await h.login(who);
    const r = await h.api('GET', `/api/homes/${HOME}/gigs`, s);
    console.log(`${who} GET /api/homes/<home>/gigs ${r.status} ${show(r)}`);
    if (who === 'owner') {
      const n = await h.api('GET', `/api/homes/${HOME}/nearby-gigs?limit=10`, s);
      console.log(`${who} GET /api/homes/<home>/nearby-gigs?limit=10 ${n.status} ${show(n)}`);
      const bad = await h.api('GET', '/api/homes/not-a-home/gigs', s);
      console.log(`${who} GET /api/homes/not-a-home/gigs ${bad.status} ${JSON.stringify(bad.json)}`);
    }
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
