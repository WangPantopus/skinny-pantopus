// PR X probe: every v2 mail-by-id handler for an outsider (no Home), the addressee (viewer) and a household
// member (editor). Prints route statuses only; no tokens, no content beyond subjects.
const { login, api } = require('./h.cjs'); const fs = require('fs');
const ids = Object.fromEntries(fs.readFileSync(__dirname + '/work/x-fixture-ids.txt', 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const LETTER = fs.readFileSync(__dirname + '/work/m01-mail-ids.txt', 'utf8').split('\n')[0].trim();
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const V2 = '/api/mailbox/v2', P2 = V2 + '/p2', P3 = V2 + '/p3';
const routes = [
  ['GET', `${V2}/item/${LETTER}`], ['POST', `${V2}/item/${LETTER}/action`, { action: 'remind' }], ['POST', `${V2}/route`, { mailId: LETTER }],
  ['GET', `${V2}/package/${ids.pkg_mail}`], ['PATCH', `${V2}/package/${ids.pkg_mail}/status`, { status: 'in_transit' }],
  ['POST', `${V2}/package/${ids.pkg_mail}/share-eta`], ['POST', `${V2}/package/${ids.pkg_mail}/neighbor-gig`],
  ['GET', `${P2}/booklet/${ids.booklet}`], ['GET', `${P2}/booklet/${ids.booklet}/page/1`], ['POST', `${P2}/booklet/${ids.booklet}/download`],
  ['GET', `${P2}/bundle/${ids.bundle}/items`], ['POST', `${P2}/bundle/action`, { bundleId: ids.bundle, action: 'open_all' }],
  ['GET', `${P2}/certified/${ids.cert}/proof`], ['POST', `${P2}/vault/file`, { mailId: LETTER, folderId: ids.folder }],
  ['GET', `${P2}/vault/folder/${ids.folder}/items`], ['POST', `${P2}/package/${ids.pkg_mail}/unboxing`, { skip: true }],
  ['POST', `${P2}/package/${ids.pkg_mail}/save-warranty`, { type: 'warranty' }], ['POST', `${P2}/package/${ids.pkg_mail}/gig`, { gigType: 'hold' }],
  ['POST', `${P2}/package/${ids.pkg_mail}/gig-accepted`, { neighborId: '00000000-0000-4000-8000-000000000001', neighborName: 'Probe' }],
];
(async () => {
  const label = process.argv[2] || 'run'; const who = (process.argv[3] || 'm01outsider,viewer,editor').split(',');
  console.log(`# PR X probe (${label}) ${new Date().toISOString()}`);
  const sessions = {}; for (const w of who) sessions[w] = await login(w);
  console.log(['route'].concat(who).join(' | '));
  for (const [m, path, body] of routes) {
    const cells = [];
    for (const w of who) { const r = await api(m, path, sessions[w], body); cells.push(`${r.status}${r.status >= 400 && r.json?.error ? ' ' + r.json.error : ''}`); }
    console.log(`${m} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (x) => '<' + x.slice(0, 8) + '>')} | ${cells.join(' | ')}`);
  }
  // Map pin linking another user's mail (owner is a member of the fixture Home; the mail is the outsider's own letter).
  const owner = await login('owner');
  const pin = await api('POST', `${P3}/map/pin`, owner, { homeId: HOME, mailId: ids.outsider_mail, pinType: 'notice', title: 'Stream2 X pin probe', lat: 45.6, lng: -122.6 });
  console.log(`POST ${P3}/map/pin (owner links the outsider's letter) | owner ${pin.status}${pin.json?.error ? ' ' + pin.json.error : ''}`);
  if (pin.json?.pin?.id) fs.appendFileSync(__dirname + '/work/x-created-pins.txt', pin.json.pin.id + '\n');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
