// The Home list's projection for the same accounts (GET /api/homes/my-homes and /primary), for parity with the hub.
const { login, api } = require('./h.cjs');
(async () => {
  console.log(`# Home list parity ${new Date().toISOString()}`);
  for (const w of (process.argv[2] || 'owner,viewer,bannerpending').split(',')) {
    const s = await login(w);
    const l = await api('GET', '/api/homes/my-homes', s);
    const p = await api('GET', '/api/homes/primary', s);
    const homes = (l.json?.homes || []).map(h => ({ id: h.id?.slice(0, 8), name: h.name, address: h.address, city: h.city,
      access_kind: h.access_kind, has_home_access: h.has_home_access, role_base: h.role_base }));
    console.log(`${w}: my-homes ${l.status} ${JSON.stringify(homes)} | primary ${p.status} ${p.json?.home ? p.json.home.id.slice(0, 8) + ' ' + p.json.home.access_kind : 'null'}`);
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
