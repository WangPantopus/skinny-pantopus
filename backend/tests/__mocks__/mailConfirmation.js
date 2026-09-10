// In-memory RPC boundary for the existing mail orchestration suites. Actual SQL
// locking, rollback, grants and concurrent behavior are tested in db/contracts.
const { randomUUID } = require('crypto');
const { unitKey, destinationFor, destinationForHome, sameDestination } = require('../../services/addressValidation/mailDestination');
module.exports = (p, table) => {
  const result = data => ({ data, error: null });
  const fail = error => result({ error });
  const a = table('AddressVerificationAttempt').find(r => r.id === p.p_attempt_id && r.user_id === p.p_user_id && r.method === 'mail_code');
  if (!a) return fail('NOT_FOUND');
  if (a.status === 'locked') return fail('LOCKED');
  if (a.status === 'expired') return fail('EXPIRED');
  if (!['created', 'sent', 'delivered_unknown', 'verified'].includes(a.status)) return fail('INACTIVE');
  const t = table('AddressVerificationToken').find(r => r.attempt_id === a.id);
  if (!t) return fail('NOT_FOUND');
  const consumed = a.status === 'verified' && !!t.used_at;
  if (!consumed && (t.used_at || a.status === 'verified')) return fail('INCONSISTENT_PROOF');
  if (!consumed && t.attempt_count >= t.max_attempts) { a.status = 'locked'; return fail('LOCKED'); }
  const expired = new Date(a.expires_at) <= new Date();
  if (!consumed && expired) { a.status = 'expired'; return fail('EXPIRED'); }
  if (t.code_hash !== p.p_submitted_hash) {
    if (consumed) return fail('NOT_FOUND');
    if (expired) { a.status = 'expired'; return fail('EXPIRED'); }
    t.attempt_count++;
    if (t.attempt_count >= t.max_attempts) { a.status = 'locked'; return fail('LOCKED'); }
    return result({ error: 'WRONG_CODE', attempts_remaining: t.max_attempts - t.attempt_count });
  }
  const j = table('MailVerificationJob').filter(r => r.attempt_id === a.id).sort((x, y) =>
    (y.metadata?.resend_number || 0) - (x.metadata?.resend_number || 0) || new Date(y.created_at) - new Date(x.created_at))[0];
  if (!j) return fail('NOT_FOUND');
  if (expired && (!consumed || !j.metadata?.confirmed_occupancy_id)) {
    if (!consumed) a.status = 'expired';
    return fail('EXPIRED');
  }
  const adr = table('HomeAddress').find(r => r.id === a.address_id);
  if (!adr) return fail('ADDRESS_CHANGED');
  const current = destinationFor(adr, j.metadata?.unit);
  if (!current) return fail('ADDRESS_CHANGED');
  const legacy = !current.line2 && adr.building_type !== 'multi_unit' && !adr.missing_secondary_flag;
  const destination = j.metadata?.destination || (legacy ? current : null);
  if (!destination) return fail('UNBOUND_DESTINATION');
  if (!sameDestination(destination, current)) return fail('ADDRESS_CHANGED');
  if (!j.metadata?.destination && table('Home').filter(h => h.address_id === a.address_id).length !== 1) return fail('UNBOUND_DESTINATION');
  const matches = table('Home').filter(h => h.address_id === a.address_id && unitKey(h.address2 || adr.address_line2_norm) === unitKey(destination.line2));
  if (matches.length !== 1) return fail('AMBIGUOUS_HOME');
  const h = matches[0];
  if (!sameDestination(destination, destinationForHome(h, adr))) return fail('ADDRESS_CHANGED');
  let o = table('HomeOccupancy').find(r => r.home_id === h.id && r.user_id === p.p_user_id);
  const claims = table('AddressClaim').filter(c => c.user_id === p.p_user_id && c.address_id === a.address_id && unitKey(c.unit_number || adr.address_line2_norm) === unitKey(destination.line2));
  const latestClaim = [...claims].sort((x, y) => (new Date(y.created_at || 0) - new Date(x.created_at || 0)) || String(y.id).localeCompare(String(x.id)))[0];
  if (['frozen', 'frozen_silent'].includes(h.security_state) || latestClaim?.claim_status === 'rejected'
    || (o && (o.is_active !== true || o.end_at || new Date(o.access_start_at) > new Date()
      || (o.access_end_at && new Date(o.access_end_at) <= new Date())
      || ['suspended', 'suspended_challenged', 'inactive', 'moved_out'].includes(o.verification_status)))) return fail('ACCESS_REVOKED');
  if (consumed && j.metadata?.confirmed_occupancy_id) {
    if (!o || o.id !== j.metadata.confirmed_occupancy_id || h.id !== j.metadata.confirmed_home_id || o.verification_status !== 'verified') return fail('ACCESS_REVOKED');
    return result({ reused: true, occupancy: { ...o } });
  }
  if (!o || o.verification_status !== 'verified') {
    if ((h.owner_id && h.owner_id !== p.p_user_id)
      || table('HomeOwner').some(r => r.home_id === h.id && r.owner_status === 'verified' && r.subject_id !== p.p_user_id)
      || table('HomeOccupancy').some(r => r.home_id === h.id && r.user_id !== p.p_user_id && r.is_active)) return fail('HOME_OCCUPIED');
    const template = p.p_templates[o?.age_band === 'child' ? 'child' : o?.age_band === 'teen' ? 'teen' : 'adult'];
    const next = { ...template, home_id: h.id, user_id: p.p_user_id, role: 'member', is_active: true, verification_status: 'verified', verified_at: new Date().toISOString(), verification_expires_at: new Date(Date.now() + p.p_validity_days * 86400000).toISOString() };
    if (o) Object.assign(o, next);
    else { o = { id: randomUUID(), ...next }; table('HomeOccupancy').push(o); }
  }
  a.status = 'verified'; t.used_at ||= new Date().toISOString();
  t.attempt_count += consumed ? 0 : 1;
  for (const c of claims) if (c.claim_status === 'pending') Object.assign(c, { claim_status: 'verified', verification_method: 'mail_code' });
  j.metadata = { ...j.metadata, confirmed_home_id: h.id, confirmed_occupancy_id: o.id };
  table('HomeAuditLog').push({ id: randomUUID(), home_id: h.id, actor_user_id: p.p_user_id, action: 'MAIL_CODE_VERIFIED', target_id: a.id });
  return result({ reused: false, occupancy: { ...o } });
};
