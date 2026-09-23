// R06 admission-lapse reproduction: time-bounded real invitation -> accept -> issue -> wait past access end -> public check.
const fs = require('node:fs'); const h = require('./h.cjs'); const HOME = 'f0e51100-0000-4000-8000-000000000200';
const out = []; const log = (k, v) => { out.push({ at: new Date().toISOString(), k, v }); console.log(k, JSON.stringify(v)); };
(async () => {
  const [who, tag, minutes] = process.argv.slice(2);
  const owner = await h.login('owner'); const u = await h.login(who);
  const end = new Date(Date.now() + Number(minutes || 2) * 60 * 1000).toISOString();
  const inv = await h.api('POST', `/api/homes/${HOME}/invite`, owner, { user_id: u.id, relationship: 'member', end_at: end });
  log('invite', { status: inv.status, id: inv.json?.invitation?.id, access_end_at: inv.json?.invitation?.access_end_at, code: inv.json?.code });
  const acc = await h.api('POST', `/api/homes/invitations/${inv.json.invitation.id}/accept`, u);
  log('accept', { status: acc.status, occupancy: acc.json?.occupancy && (({ id, role_base, verification_status, is_active, access_end_at }) => ({ id, role_base, verification_status, is_active, access_end_at }))(acc.json.occupancy) });
  const iss = await h.api('POST', `/api/homes/${HOME}/residency-letters`, u, { purpose: 'R06 time-bounded member letter' });
  log('issue', { status: iss.status, id: iss.json?.letter?.id, code: iss.json?.letter?.letter_code, expires_at: iss.json?.letter?.expires_at });
  const code = iss.json.letter.letter_code;
  log('public-before-end', (await h.api('GET', `/api/public/residency-letters/${code}`, null)).json);
  const wait = Date.parse(end) - Date.now() + 15000; log('waiting-ms', wait);
  await new Promise((r) => setTimeout(r, Math.max(wait, 0)));
  log('member-list-after-end', { status: (await h.api('GET', `/api/homes/${HOME}/residency-letters`, u)).status });
  log('public-after-end', (await h.api('GET', `/api/public/residency-letters/${code}`, null)).json);
  fs.writeFileSync(`${__dirname}/work/${tag}.json`, JSON.stringify(out, null, 2));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
