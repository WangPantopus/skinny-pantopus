// Harness: owner invites a synthetic user through the real invite route; the invitee accepts through the real accept route.
const h = require('./h.cjs'); const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [who, relationship] = process.argv.slice(2);
  const owner = await h.login('owner'); const target = await h.login(who);
  const inv = await h.api('POST', `/api/homes/${HOME}/invite`, owner, { user_id: target.id, relationship });
  console.log('invite', inv.status, JSON.stringify({ id: inv.json?.invitation?.id, role: inv.json?.invitation?.proposed_role_base, status: inv.json?.invitation?.status, code: inv.json?.code, error: inv.json?.error }));
  if (inv.status !== 201) process.exit(1);
  const acc = await h.api('POST', `/api/homes/invitations/${inv.json.invitation.id}/accept`, target);
  const o = acc.json?.occupancy || {};
  console.log('accept', acc.status, JSON.stringify({ occupancy_id: o.id, role_base: o.role_base, verification_status: o.verification_status, is_active: o.is_active, access_end_at: o.access_end_at, code: acc.json?.code, error: acc.json?.error }));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
