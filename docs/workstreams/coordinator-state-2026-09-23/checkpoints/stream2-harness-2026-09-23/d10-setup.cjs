// D10 disposable household: admit a member through the real invite routes, then create household data through
// real routes (bill, member's residency letter). Prints no tokens.
const h = require('./h.cjs'); const fs = require('fs');
const HOME = fs.readFileSync(__dirname + '/work/d10-home-id.txt', 'utf8').trim();
(async () => {
  const owner = await h.login('d10owner'); const member = await h.login('d10member');
  console.log(`# D10 setup ${new Date().toISOString()} home ${HOME.slice(0, 8)}`);
  const inv = await h.api('POST', `/api/homes/${HOME}/invite`, owner, { user_id: member.id, relationship: 'member' });
  console.log('owner invite', inv.status, JSON.stringify({ role: inv.json?.invitation?.proposed_role_base, error: inv.json?.error }));
  const acc = await h.api('POST', `/api/homes/invitations/${inv.json?.invitation?.id}/accept`, member);
  console.log('member accept', acc.status, JSON.stringify({ role_base: acc.json?.occupancy?.role_base, verification_status: acc.json?.occupancy?.verification_status }));
  const bill = await h.api('POST', `/api/homes/${HOME}/bills`, owner, { bill_type: 'water', provider_name: 'Stream2 D10 Water', amount: 42.5, due_date: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10) });
  console.log('owner bill', bill.status, JSON.stringify({ id: bill.json?.bill?.id?.slice(0, 8), error: bill.json?.error }));
  const letter = await h.api('POST', `/api/homes/${HOME}/residency-letters`, member, { purpose: 'Stream2 D10 proof of residence' });
  const code = letter.json?.letter?.verification_code || letter.json?.letter?.code || letter.json?.code;
  console.log('member letter', letter.status, JSON.stringify({ id: letter.json?.letter?.id?.slice(0, 8), status: letter.json?.letter?.status, error: letter.json?.error }));
  fs.writeFileSync(__dirname + '/work/d10-letter.json', JSON.stringify({ id: letter.json?.letter?.id, code }), { mode: 0o600 });
  const lists = await h.api('GET', '/api/homes/my-homes', owner);
  const card = (lists.json?.homes || []).find(x => x.id === HOME);
  console.log('owner my-homes', lists.status, JSON.stringify(card && { access_kind: card.access_kind, role_base: card.role_base, can_delete_home: card.can_delete_home }));
  const elig = await h.api('GET', `/api/homes/my-homes`, member);
  const mcard = (elig.json?.homes || []).find(x => x.id === HOME);
  console.log('member my-homes', elig.status, JSON.stringify(mcard && { access_kind: mcard.access_kind, role_base: mcard.role_base, can_delete_home: mcard.can_delete_home }));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
