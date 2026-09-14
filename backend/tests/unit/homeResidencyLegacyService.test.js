const db = require('../__mocks__/supabaseAdmin');
const service = require('../../services/homeResidencyLegacyService');
const express = require('express');
const request = require('supertest');
const router = require('../../routes/home');
const notifications = require('../../services/notificationService');
const id = n => `ddc25601-0000-4000-8000-${String(n).padStart(12, '0')}`;
const home = id(100), actor = id(1), claimId = id(200);
const input = intent => ({ homeId: home, actorId: actor, intent });
function result({ role = 'member', created = false, routing = 'household_review' } = {}) {
  return { ok: true, actor_id: actor, home_id: home, occupancy_id: id(300),
    claimed_role: ['renter', 'tenant', 'lease_resident'].includes(role) ? 'renter' : 'household',
    created, reused: !created, routing,
    claim: { id: claimId, home_id: home, user_id: actor, status: 'pending', claimed_role: role,
      claimed_address: 'Caller assertion', claimed_latitude: null, claimed_longitude: null,
      reviewed_by: null, reviewed_at: null, review_note: null,
      created_at: '2026-09-12T00:00:00Z', updated_at: '2026-09-12T00:00:00Z',
      cold_start_mode: routing === 'household_review' ? null : routing,
      postcard_auto_routed: false, postcard_code_id: null } };
}
const app = express(); app.use(express.json()); app.use('/homes', router);
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });

test.each([{}, { claimed_role: null, claimed_address: null }, { claimed_role: '', claimed_address: '' }])(
  'omission reaches the locked policy without inventing a role, UUID or address snapshot: %j', async intent => {
    const rpc = jest.fn(async () => ({ data: result({ role: 'tenant' }), error: null })); db.setRpcMock(rpc);
    const r = await service.submit(input(intent));
    expect(r.claim.claimed_role).toBe('tenant');
    expect(rpc).toHaveBeenCalledWith('submit_legacy_home_residency', { p_home_id: home, p_actor_id: actor, p_intent: intent });
  });
test.each(['renter', 'tenant', 'lease_resident', 'household', 'member', 'family', 'roommate'])(
  'residential alias %s preserves the caller assertion and committed role', async role => {
    db.setRpcMock(async () => ({ data: result({ role }), error: null }));
    await expect(service.submit(input({ claimed_role: role, claimed_address: 'Caller assertion' })))
      .resolves.toMatchObject({ claim: { claimed_role: role, claimed_address: 'Caller assertion' } });
  });
test.each([[], null, 4, { claimed_role: ['member'] }, { claimed_role: false }, { claimed_address: {} },
  { claimed_address: 2 }, { claimed_address: 'x'.repeat(1001) }, { request_id: id(500) }, { address: {} },
  { claimed_role: 'guest' }, { claimed_role: 'caregiver' }, { claimed_role: 'restricted_member' },
  { claimed_role: 'service_provider' }, { claimed_role: 'unknown' }])('malformed/nonresidential legacy input never reaches SQL: %j', async intent => {
  const rpc = jest.fn(); db.setRpcMock(rpc);
  await expect(service.submit(input(intent))).rejects.toMatchObject({ statusCode: 400, code: 'RESIDENCY_SUBMISSION_INVALID' });
  expect(rpc).not.toHaveBeenCalled();
});
test.each(['owner', 'admin', 'manager', 'property_manager'])('elevated %s requires the separate ownership flow', async role => {
  const rpc = jest.fn(); db.setRpcMock(rpc);
  await expect(service.submit(input({ claimed_role: role }))).rejects.toMatchObject({ statusCode: 409, code: 'OWNERSHIP_FLOW_REQUIRED' });
  expect(rpc).not.toHaveBeenCalled();
});
test.each([
  r => { r.home_id = id(999); }, r => { r.actor_id = id(999); }, r => { r.claim.user_id = id(999); },
  r => { r.claim.home_id = id(999); }, r => { r.occupancy_id = []; }, r => { r.created = 'false'; },
  r => { r.created = true; r.reused = true; }, r => { r.routing = ['household_review']; },
  r => { r.claim.status = 'verified'; }, r => { r.claim.claimed_role = ['member']; },
  r => { r.claimed_role = 'renter'; }, r => { r.claim.cold_start_mode = 'self_bootstrap'; },
  r => { r.claim.created_at = false; }, r => { r.claim.claimed_latitude = '1'; },
  r => { r.claim.postcard_auto_routed = 'false'; }, r => { r.claim.postcard_code_id = 'not-a-uuid'; },
])('malformed or cross-bound result stays unavailable', async change => {
  const value = result(); change(value); db.setRpcMock(async () => ({ data: value, error: null }));
  await expect(service.submit(input({}))).rejects.toMatchObject({ statusCode: 503, code: 'RESIDENCY_LEGACY_UNAVAILABLE' });
});
test.each([null, [], {}, { ok: false, code: ['RESIDENCY_ALREADY_VERIFIED'], status: 409 },
  { ok: false, code: 'private upstream details', status: 403 }])('invalid error/transport result fails closed: %j', async value => {
  db.setRpcMock(async () => ({ data: value, error: null }));
  await expect(service.submit(input({}))).rejects.toMatchObject({ statusCode: 503 });
});
test('an uncertain SQL outcome stays retryable without a made-up claim or receipt', async () => {
  db.setRpcMock(async () => { throw new Error('private transport detail'); });
  await expect(service.submit(input({}))).rejects.toMatchObject({ statusCode: 503 });
});
test.each([['RESIDENCY_ALREADY_VERIFIED', 409], ['MEMBERSHIP_RENEWAL_REQUIRED', 409],
  ['RESIDENCY_EXISTING_REQUEST', 409], ['RESIDENCY_HOME_UNAVAILABLE', 403], ['HOME_NOT_FOUND', 404]])(
  'current-policy error %s preserves its status', async (code, status) => {
    db.setRpcMock(async () => ({ data: { ok: false, code, status }, error: null }));
    await expect(service.submit(input({}))).rejects.toMatchObject({ statusCode: status, code });
  });
test('HTTP preserves the legacy envelope, authenticated actor and actual committed routing, without postal delivery', async () => {
  const value = result({ created: true, role: 'renter', routing: 'self_bootstrap' });
  value.claim.internal_secret = 'must not cross the projection';
  const rpc = jest.fn(async () => ({ data: value, error: null })); db.setRpcMock(rpc);
  const r = await request(app).post(`/homes/${home}/claim`).set('x-test-user-id', actor)
    .send({ claimed_role: 'renter', claimed_address: 'Caller assertion' });
  expect(r.status).toBe(201); expect(r.headers['cache-control']).toBe('private, no-store');
  expect(r.body).toMatchObject({ claim: { id: claimId, home_id: home, user_id: actor,
    cold_start_mode: 'self_bootstrap' }, postcard_requested: false, verification_needed: true,
  current_access: 'not_checked', next_step: 'address_verification' });
  expect(r.body.claim).not.toHaveProperty('internal_secret'); expect(r.body).not.toHaveProperty('command');
  expect(r.body).not.toHaveProperty('delivery_unknown');
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('submit_legacy_home_residency', expect.objectContaining({ p_actor_id: actor }));
  expect(db.getTable('HomeOccupancy')).toHaveLength(0);
  expect(db.getTable('HomePostcardCode')).toHaveLength(0);
});
test('HTTP current-row recovery returns 200 and no second write outside the transaction', async () => {
  db.setRpcMock(async () => ({ data: result({ role: 'tenant' }), error: null }));
  const r = await request(app).post(`/homes/${home}/claim`).set('x-test-user-id', actor).send({});
  expect(r.status).toBe(200); expect(r.body.claim.claimed_role).toBe('tenant'); expect(r.body.postcard_requested).toBe(false);
});
test('a changed saved admission rechecks current reviewers and queues a generic notice after commit', async () => {
  const saved = result({ created: true });
  const rpc = jest.fn(async name => ({ error: null, data: name === 'submit_legacy_home_residency' ? saved
    : { ok: true, home_id: home, actor_id: actor, claim_id: claimId, reviewer_ids: [id(9)] } }));
  db.setRpcMock(rpc);
  await expect(service.submit(input({}))).resolves.toMatchObject({ claim: { id: claimId } });
  expect(rpc.mock.calls.map(call => call[0])).toEqual(['submit_legacy_home_residency', 'get_legacy_home_residency_reviewers']);
  expect(rpc.mock.calls[1][1]).toEqual({ p_home_id: home, p_actor_id: actor, p_claim_id: claimId,
    p_claim_updated_at: saved.claim.updated_at });
  const [notice] = notifications.createBulkNotifications.mock.calls[0][0];
  expect(notice.userId).toBe(id(9)); expect(notice.type).toBe('residency_claim');
  expect(notice.body).not.toContain('Caller assertion');
  expect(notice.metadata).toEqual({ home_id: home, claimant_id: actor, claim_id: claimId });
});
test.each(['read failure', 'malformed recipients', 'authority revoked', 'notice failure'])(
  '%s cannot turn committed admission into a failed submission', async mode => {
    const saved = result({ created: true });
    db.setRpcMock(async name => name === 'submit_legacy_home_residency' ? { data: saved, error: null }
      : mode === 'read failure' ? { data: null, error: { code: '55P03' } }
        : { data: { ok: true, home_id: home, actor_id: actor, claim_id: claimId,
          reviewer_ids: mode === 'malformed recipients' ? [[id(9)]] : mode === 'authority revoked' ? [] : [id(9)] }, error: null });
    if (mode === 'notice failure') notifications.createBulkNotifications.mockRejectedValueOnce(new Error('Controlled notification failure'));
    await expect(service.submit(input({}))).resolves.toMatchObject({ claim: { id: claimId }, created: true });
    if (mode !== 'notice failure') expect(notifications.createBulkNotifications).not.toHaveBeenCalled();
  });
test('unchanged legacy recovery does not duplicate a reviewer notice or query its recipients', async () => {
  const rpc = jest.fn(async () => ({ data: result(), error: null })); db.setRpcMock(rpc);
  await service.submit(input({}));
  expect(rpc).toHaveBeenCalledTimes(1); expect(notifications.createBulkNotifications).not.toHaveBeenCalled();
});
