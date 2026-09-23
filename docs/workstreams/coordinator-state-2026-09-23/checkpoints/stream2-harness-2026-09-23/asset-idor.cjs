// Records assets authorization probe: the owner creates a Home asset through the real Home route; an outsider
// reads the p3 records list with ?homeId=. Prints no tokens.
const { login, api } = require('./h.cjs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const owner = await login('owner'); const outsider = await login('outsider');
  let assetId = process.argv[2];
  console.log(`# records/assets probe ${new Date().toISOString()}`);
  if (!assetId) {
    const c = await api('POST', `/api/homes/${HOME}/assets`, owner, { category: 'appliance', name: 'Stream2 probe dishwasher', room: 'Kitchen', brand: 'ProbeBrand', serial_number: 'SN-PROBE-1', purchase_price: 999 });
    assetId = c.json?.asset?.id;
    console.log('owner POST /api/homes/:id/assets', c.status, JSON.stringify({ id: assetId && assetId.slice(0, 8), error: c.json?.error }));
  }
  const r1 = await api('GET', `/api/mailbox/v2/p3/records/assets?homeId=${HOME}`, outsider);
  console.log('outsider GET /p3/records/assets?homeId=<home>', r1.status, JSON.stringify(r1.json && (r1.json.assets ? r1.json.assets.map(a => ({ name: a.name, category: a.category, room: a.room })) : r1.json)));
  const r2 = await api('GET', `/api/homes/${HOME}/assets`, outsider);
  console.log('outsider GET /api/homes/:id/assets (Home route)', r2.status, JSON.stringify(r2.json).slice(0, 160));
  const r3 = await api('GET', `/api/mailbox/v2/p3/records/asset/${assetId}/mail`, outsider);
  console.log('outsider GET /p3/records/asset/:id/mail', r3.status, JSON.stringify(r3.json).slice(0, 160));
  require('fs').writeFileSync(__dirname + '/.asset-probe-id', assetId || '');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
