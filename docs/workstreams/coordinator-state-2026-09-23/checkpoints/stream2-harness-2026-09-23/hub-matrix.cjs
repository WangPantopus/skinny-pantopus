// Summarizes the home-derived fields of GET /api/hub for each account. Prints no tokens,
// emails or passwords; home ids are the retained synthetic fixture's.
const { login, api } = require('./h.cjs');
(async () => {
  const label = process.argv[2] || 'run';
  const who = (process.argv[3] || 'owner,viewer,editor,bannerpending').split(',');
  console.log(`# GET /api/hub home-derived fields (${label}) ${new Date().toISOString()}`);
  for (const w of who) {
    const s = await login(w);
    const r = await api('GET', '/api/hub', s);
    const j = r.json || {};
    const homes = (j.homes || []).map(h => ({ id: h.id?.slice(0, 8), name: h.name, addressShort: h.addressShort, city: h.city,
      state: h.state, lat: h.latitude, lng: h.longitude, isPrimary: h.isPrimary, roleBase: h.roleBase, verified: h.verified }));
    const home = j.cards?.home;
    const out = {
      status: r.status,
      homes,
      activeHomeId: j.context?.activeHomeId ? j.context.activeHomeId.slice(0, 8) : null,
      hasHome: j.availability?.hasHome,
      steps: (j.setup?.steps || []).filter(x => ['home', 'verify'].includes(x.key)).map(x => `${x.key}:${x.done}`).join(' '),
      homeStatusItems: (j.statusItems || []).filter(i => i.pillar === 'home').map(i => `${i.type}|${i.title}|${i.subtitle || ''}`),
      homeCard: home ? { newMail: home.newMail, billsDue: (home.billsDue || []).map(b => `${b.name} ${b.amount}`), tasksDue: (home.tasksDue || []).length, memberCount: home.memberCount } : null,
      jumpBackInHome: (j.jumpBackIn || []).filter(x => /homes|scope=home/.test(x.route)).map(x => x.title),
      neighborDensity: j.neighborDensity,
      error: r.status !== 200 ? j : undefined,
    };
    console.log(`\n## ${w}\n` + JSON.stringify(out, null, 1));
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
