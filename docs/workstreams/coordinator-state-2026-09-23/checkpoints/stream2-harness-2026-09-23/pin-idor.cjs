// Map pin authorization probe: the owner creates a household pin through the real route; an outsider
// (no Home) and household members read it. Prints no tokens.
const { login, api } = require('./h.cjs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const P3 = '/api/mailbox/v2/p3';
(async () => {
  const mode = process.argv[2] || 'probe';
  const owner = await login('owner'); const outsider = await login('outsider'); const viewer = await login('viewer');
  let pinId = process.argv[3];
  console.log(`# map pin probe (${mode}) ${new Date().toISOString()}`);
  if (!pinId) {
    const c = await api('POST', `${P3}/map/pin`, owner, { homeId: HOME, pinType: 'delivery', title: 'Stream2 pin probe: package at side door', body: 'Synthetic household note', lat: 45.6, lng: -122.6, visibleTo: 'household' });
    pinId = c.json?.pin?.id;
    console.log('owner POST /map/pin', c.status, JSON.stringify({ id: pinId && pinId.slice(0, 8), visible_to: c.json?.pin?.visible_to, error: c.json?.error }));
  }
  const show = (label, r) => console.log(label, r.status, JSON.stringify(r.json && (r.json.pins ? { count: r.json.pins.length, titles: r.json.pins.map(p => p.title) } : r.json.pin ? { title: r.json.pin.title, body: r.json.pin.body, home: String(r.json.pin.home_id).slice(0, 8), linked_mail: r.json.pin.linked_mail } : r.json)));
  show('outsider GET /map/pins?homeId=<home>', await api('GET', `${P3}/map/pins?homeId=${HOME}`, outsider));
  show('outsider GET /map/pins (no homeId)', await api('GET', `${P3}/map/pins`, outsider));
  show('outsider GET /map/pin/:id', await api('GET', `${P3}/map/pin/${pinId}`, outsider));
  show('viewer GET /map/pins?homeId=<home>', await api('GET', `${P3}/map/pins?homeId=${HOME}`, viewer));
  show('owner GET /map/pins', await api('GET', `${P3}/map/pins`, owner));
  console.log('pinId8', pinId && pinId.slice(0, 8));
  require('fs').writeFileSync(__dirname + '/.pin-probe-id', pinId || '');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
