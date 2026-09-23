// PR X probe, remaining write routes (run after the global write limiter window).
const { login, api } = require('./h.cjs'); const fs = require('fs');
const ids = Object.fromEntries(fs.readFileSync(__dirname + '/work/x-fixture-ids.txt', 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const P2 = '/api/mailbox/v2/p2', P3 = '/api/mailbox/v2/p3';
(async () => {
  const label = process.argv[2] || 'run';
  console.log(`# PR X probe tail (${label}) ${new Date().toISOString()}`);
  const s = { viewer: await login('viewer'), editor: await login('editor'), owner: await login('owner') };
  const routes = [
    ['POST', `${P2}/package/${ids.pkg_mail}/unboxing`, { skip: true }, ['editor']],
    ['POST', `${P2}/package/${ids.pkg_mail}/save-warranty`, { type: 'warranty' }, ['viewer', 'editor']],
    ['POST', `${P2}/package/${ids.pkg_mail}/gig`, { gigType: 'hold' }, ['viewer', 'editor']],
    ['POST', `${P2}/package/${ids.pkg_mail}/gig-accepted`, { neighborId: '00000000-0000-4000-8000-000000000001', neighborName: 'Probe' }, ['viewer', 'editor']],
  ];
  for (const [m, path, body, who] of routes) {
    const cells = [];
    for (const w of who) { const r = await api(m, path, s[w], body); cells.push(`${w} ${r.status}${r.status >= 400 && r.json?.error ? ' ' + r.json.error : ''}`); }
    console.log(`${m} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (x) => '<' + x.slice(0, 8) + '>')} | ${cells.join(' | ')}`);
  }
  const bad = await api('POST', `${P3}/map/pin`, s.owner, { homeId: HOME, mailId: ids.outsider_mail, pinType: 'notice', title: 'Stream2 X pin probe (other user mail)', lat: 45.6, lng: -122.6 });
  console.log(`POST ${P3}/map/pin (owner links another user's letter) | owner ${bad.status}${bad.json?.error ? ' ' + bad.json.error : ''}`);
  const ok = await api('POST', `${P3}/map/pin`, s.viewer, { homeId: HOME, mailId: ids.pkg_mail, pinType: 'delivery', title: 'Stream2 X pin probe (own mail)', lat: 45.6, lng: -122.6 });
  console.log(`POST ${P3}/map/pin (viewer links own package mail) | viewer ${ok.status}${ok.json?.error ? ' ' + ok.json.error : ''}`);
  for (const r of [bad, ok]) if (r.json?.pin?.id) fs.appendFileSync(__dirname + '/work/x-created-pins.txt', r.json.pin.id + '\n');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
