// ============================================================
// TEST: LandlordAuthorityService
//
// Unit tests for all 7 methods:
//   requestAuthority, verifyAuthority, inviteTenant,
//   acceptInvite, approveTenantRequest, denyTenantRequest,
//   endLease
//
// Uses the in-memory supabaseAdmin mock.
// ============================================================

const crypto = require('crypto');
const { resetTables, seedTable, getTable, setRpcMock } = require('../__mocks__/supabaseAdmin');

// ── Mock writeAuditLog ──────────────────────────────────────
jest.mock('../../utils/homePermissions', () => ({
  writeAuditLog: jest.fn(),
  applyOccupancyTemplate: jest.fn().mockResolvedValue({
    occupancy: { id: 'mock-occ-template' },
    template: {},
  }),
  VERIFIED_TEMPLATES: {},
  ALL_FALSE_TEMPLATE: {},
}));

// ── Mock notificationService ────────────────────────────────
jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn(),
}));

// ── Mock occupancyAttachService (tested separately) ─────────
const mockOccAttach = jest.fn().mockResolvedValue({
  success: true,
  occupancy: { id: 'mock-occ-id', role: 'lease_resident', role_base: 'lease_resident', verification_status: 'verified', is_active: true, home_id: 'home-1' },
  status: 'attached',
});
const mockOccDetach = jest.fn().mockResolvedValue({ success: true });
jest.mock('../../services/occupancyAttachService', () => ({
  attach: (...args) => mockOccAttach(...args),
  detach: (...args) => mockOccDetach(...args),
}));

const { writeAuditLog } = require('../../utils/homePermissions');
const notificationService = require('../../services/notificationService');
const { LandlordAuthorityService } = require('../../services/addressValidation/landlordAuthorityService');

let service;

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  mockOccAttach.mockResolvedValue({
    success: true,
    occupancy: { id: 'mock-occ-id', role: 'lease_resident', role_base: 'lease_resident', verification_status: 'verified', is_active: true, home_id: 'home-1' },
    status: 'attached',
  });
  mockOccDetach.mockResolvedValue({ success: true });
  service = new LandlordAuthorityService();
});

// ── Seed helpers ────────────────────────────────────────────

function seedHome(overrides = {}) {
  seedTable('Home', [{
    id: 'home-1',
    name: 'Test Home',
    home_type: 'apartment',
    address_id: 'addr-1',
    ...overrides,
  }]);
}

function seedAuthority(overrides = {}) {
  seedTable('HomeAuthority', [{
    id: 'auth-1',
    home_id: 'home-1',
    subject_type: 'user',
    subject_id: 'landlord-1',
    role: 'owner',
    status: 'verified',
    verification_tier: 'standard',
    added_via: 'landlord_portal',
    ...overrides,
  }]);
}

function seedLease(overrides = {}) {
  seedTable('HomeLease', [{
    id: 'lease-1',
    home_id: 'home-1',
    primary_resident_user_id: 'tenant-1',
    start_at: new Date().toISOString(),
    state: 'pending',
    source: 'tenant_request',
    metadata: {},
    ...overrides,
  }]);
}

// ============================================================
// requestAuthority
// ============================================================

describe('requestAuthority', () => {
  test('creates a pending HomeAuthority record', async () => {
    seedHome();
    const result = await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed');

    expect(result.success).toBe(true);
    expect(result.authority).toBeDefined();
    expect(result.authority.status).toBe('pending');
    expect(result.authority.role).toBe('owner');
    expect(result.authority.subject_type).toBe('user');
    expect(result.authority.subject_id).toBe('landlord-1');
  });

  test('persists authority to HomeAuthority table', async () => {
    seedHome();
    await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed');

    const records = getTable('HomeAuthority');
    expect(records).toHaveLength(1);
    expect(records[0].home_id).toBe('home-1');
  });

  test('creates claim + evidence when evidence provided', async () => {
    seedHome();
    const result = await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed', {
      storage_ref: 's3://bucket/deed.pdf',
      metadata: { pages: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.claim).toBeDefined();
    expect(result.claim.claim_type).toBe('owner');
    expect(result.claim.state).toBe('submitted');
    expect(result.claim.claim_phase_v2).toBe('evidence_submitted');
    expect(result.claim.routing_classification).toBe('standalone_claim');
    expect(result.claim.identity_status).toBe('not_started');
    expect(result.claim.terminal_reason).toBe('none');
    expect(result.claim.challenge_state).toBe('none');

    const evidence = getTable('HomeVerificationEvidence');
    expect(evidence).toHaveLength(1);
    expect(evidence[0].evidence_type).toBe('deed');
    expect(evidence[0].storage_ref).toBe('s3://bucket/deed.pdf');
    expect(getTable('Home')[0].household_resolution_state).toBe('pending_single_claim');
  });

  test('returns null claim when no evidence provided', async () => {
    seedHome();
    const result = await service.requestAuthority('user', 'landlord-1', 'home-1', 'utility_bill');

    expect(result.success).toBe(true);
    expect(result.claim).toBeNull();
    expect(getTable('HomeVerificationEvidence')).toHaveLength(0);
  });

  test('writes audit log', async () => {
    seedHome();
    await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed');

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'landlord-1', 'AUTHORITY_REQUESTED', 'HomeAuthority',
      expect.any(String),
      expect.objectContaining({ subject_type: 'user', evidence_type: 'deed' }),
    );
  });

  test('returns error when home not found', async () => {
    const result = await service.requestAuthority('user', 'landlord-1', 'missing-home', 'deed');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Home not found');
  });

  test('returns error when active authority already exists (pending)', async () => {
    seedHome();
    seedAuthority({ status: 'pending' });

    const result = await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed');
    expect(result.success).toBe(false);
    expect(result.error).toContain('pending authority request');
  });

  test('returns error when verified authority already exists', async () => {
    seedHome();
    seedAuthority({ status: 'verified' });

    const result = await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed');
    expect(result.success).toBe(false);
    expect(result.error).toContain('verified authority');
  });

  test('allows request when existing authority is revoked', async () => {
    seedHome();
    seedAuthority({ status: 'revoked' });

    const result = await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed');
    expect(result.success).toBe(true);
  });

  test('supports business subject type', async () => {
    seedHome();
    const result = await service.requestAuthority('business', 'biz-1', 'home-1', 'lease');

    expect(result.success).toBe(true);
    expect(result.authority.subject_type).toBe('business');
  });

  test('evidence provider defaults to manual', async () => {
    seedHome();
    await service.requestAuthority('user', 'landlord-1', 'home-1', 'tax_bill', {
      storage_ref: 's3://bucket/tax.pdf',
    });

    const evidence = getTable('HomeVerificationEvidence');
    expect(evidence[0].provider).toBe('manual');
  });
});

// ============================================================
// verifyAuthority
// ============================================================

describe('verifyAuthority', () => {
  beforeEach(() => {
    seedHome();
    seedAuthority({ status: 'pending' });
  });

  test('verifies authority to verified status', async () => {
    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'verified');

    expect(result.success).toBe(true);
    expect(result.authority.status).toBe('verified');
  });

  test('revokes authority', async () => {
    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'revoked', 'Insufficient evidence');

    expect(result.success).toBe(true);
    expect(result.authority.status).toBe('revoked');
  });

  test('updates verification_tier from evidence quality', async () => {
    // Seed a claim with strong evidence
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-1',
      home_id: 'home-1',
      claimant_user_id: 'landlord-1',
      claim_type: 'owner',
      state: 'submitted',
    }]);
    seedTable('HomeVerificationEvidence', [{
      id: 'ev-1',
      claim_id: 'claim-1',
      evidence_type: 'deed',
      provider: 'manual',
      status: 'verified',
    }]);

    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'verified');

    expect(result.success).toBe(true);
    expect(result.authority.verification_tier).toBe('strong');
  });

  test('uses highest tier when multiple evidence types', async () => {
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-1',
      home_id: 'home-1',
      claimant_user_id: 'landlord-1',
      claim_type: 'owner',
      state: 'submitted',
    }]);
    seedTable('HomeVerificationEvidence', [
      { id: 'ev-1', claim_id: 'claim-1', evidence_type: 'utility_bill', provider: 'manual', status: 'verified' },
      { id: 'ev-2', claim_id: 'claim-1', evidence_type: 'escrow_attestation', provider: 'manual', status: 'verified' },
    ]);

    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'verified');
    expect(result.authority.verification_tier).toBe('legal');
  });

  test('defaults to weak tier when no evidence', async () => {
    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'verified');
    expect(result.authority.verification_tier).toBe('weak');
  });

  test('writes audit log with reviewer info', async () => {
    await service.verifyAuthority('auth-1', 'reviewer-1', 'verified', 'Looks good');

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'reviewer-1', 'AUTHORITY_VERIFIED', 'HomeAuthority', 'auth-1',
      expect.objectContaining({ reviewer_id: 'reviewer-1', note: 'Looks good' }),
    );
  });

  test('returns error for invalid decision', async () => {
    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'maybe');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Decision must be');
  });

  test('returns error when authority not found', async () => {
    const result = await service.verifyAuthority('missing-auth', 'reviewer-1', 'verified');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('returns error when authority already verified', async () => {
    // Change status to verified
    getTable('HomeAuthority')[0].status = 'verified';

    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'verified');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already verified');
  });
});

// ============================================================
// inviteTenant
// ============================================================

// State, dates, authority, expiry and rollback execute the actual SQL contract.
// These tests cover the adapter's proof handling and notification orchestration.
describe('inviteTenant transaction adapter', () => {
  let rpc;
  const create = (token, actor = 'landlord-1') => service.inviteTenant('auth-1', 'home-1', 'Tenant@example.com', '2026-02-31', null, actor, token);
  beforeEach(() => {
    rpc = jest.fn(async (_name, args) => ({ data: { success: true, replayed: false,
      invite: { id: 'invite-1', home_id: args.p_home_id, token_hash: args.p_token_hash,
        invitee_user_id: 'tenant-1', status: 'pending' }, home: { name: 'Test Home' } }, error: null }));
    setRpcMock(rpc);
  });
  test('passes actual actor, raw dates, hashed retained proof and14-day expiry', async () => {
    const token = 'a'.repeat(64); expect((await create(token)).token).toBe(token);
    expect(rpc).toHaveBeenCalledWith('decide_home_lease', { p_action: 'invite', p_actor_id: 'landlord-1',
      p_authority_id: 'auth-1', p_home_id: 'home-1', p_user_email: 'Tenant@example.com',
      p_token_hash: crypto.createHash('sha256').update(token).digest('hex'), p_dates: { start_at: '2026-02-31', end_at: null }, p_validity_days: 14 });
    expect(writeAuditLog).not.toHaveBeenCalled(); expect(getTable('HomeLeaseInvite')).toHaveLength(0);
  });
  test('older callers receive a random server proof', async () => {
    const result = await create(); expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(rpc.mock.calls[0][1].p_token_hash).toBe(crypto.createHash('sha256').update(result.token).digest('hex'));
  });
  test('invalid actor/proof cannot call SQL', async () => {
    expect((await create(undefined, null)).success).toBe(false); expect((await create('bad-proof')).success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  test('a pending invitation replay retries notification with the same existing event key', async () => {
    await create(); expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'tenant-1', type: 'lease_invite', idempotencyKey: 'lease-invite:invite-1' }));
    const original = rpc.getMockImplementation();
    rpc.mockImplementation(async (...args) => { const reply = await original(...args); reply.data.replayed = true; return reply; });
    await create(); expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationService.createNotification.mock.calls[1][0].idempotencyKey).toBe('lease-invite:invite-1');
  });
  test('an accepted invitation replay cannot send an obsolete pending invitation notice', async () => {
    const original = rpc.getMockImplementation();
    rpc.mockImplementation(async (...args) => { const reply = await original(...args); reply.data.replayed = true; reply.data.invite.status = 'accepted'; return reply; });
    expect((await create()).success).toBe(true);
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
  test('RPC failure stays uncertain without a token', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'timeout' } });
    expect(await create()).toEqual({ success: false, status: 503, error: expect.any(String) });
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
  test.each(['home_id', 'token_hash'])('mismatched %s cannot claim a saved invite', async field => {
    const original = rpc.getMockImplementation();
    rpc.mockImplementation(async (...args) => { const reply = await original(...args); reply.data.invite[field] = 'other'; return reply; });
    expect(await create()).toEqual({ success: false, status: 503, error: expect.any(String) });
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
  test('current-authority rejection returns no token or notice', async () => {
    const failure = { success: false, status: 403, error: 'Current verified authority required' };
    rpc.mockResolvedValueOnce({ data: failure, error: null }); expect(await create()).toEqual(failure);
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
});

// ============================================================
// acceptInvite
// ============================================================

// Database state/authority/date/replay assertions now execute the real function
// in scripts/db/contracts/home-lease-decisions.sql, instead of a mock gateway
// that always granted occupancy even when the real gateway refused it.
describe('lease decision adapter', () => {
  let rpc;
  const saved = { success: true, replayed: false,
    lease: { id: 'lease-1', home_id: 'home-1', primary_resident_user_id: 'tenant-1', state: 'active' },
    occupancy: { id: 'occ-1' } };
  beforeEach(() => { rpc = jest.fn().mockResolvedValue({ data: saved, error: null }); setRpcMock(rpc); });

  test('hashes the invite token and passes authenticated identity to the transaction', async () => {
    expect(await service.acceptInvite('raw-proof', 'tenant-1', 'Tenant@example.com')).toEqual(saved);
    expect(rpc).toHaveBeenCalledWith('decide_home_lease', expect.objectContaining({
      p_action: 'accept', p_actor_id: 'tenant-1', p_user_email: 'Tenant@example.com',
      p_token_hash: crypto.createHash('sha256').update('raw-proof').digest('hex'),
    }));
    expect(mockOccAttach).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled(); // SQL owns the atomic audit.
  });
  test('passes reviewed dates, including explicit null, with the actual actor', async () => {
    const dates = { start_at: '2026-10-01', end_at: null };
    await service.approveTenantRequest('lease-1', 'auth-1', dates, 'landlord-1');
    expect(rpc).toHaveBeenCalledWith('decide_home_lease', expect.objectContaining({
      p_action: 'approve', p_actor_id: 'landlord-1', p_lease_id: 'lease-1', p_authority_id: 'auth-1', p_dates: dates,
    }));
    expect(mockOccAttach).not.toHaveBeenCalled();
    expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'tenant-1', type: 'lease_approved', body: expect.stringContaining('approved lease dates'),
    }));
  });
  test('omitted dates remain omitted for stored-date handling in SQL', async () => {
    await service.approveTenantRequest('lease-1', 'auth-1', undefined, 'landlord-1');
    expect(rpc.mock.calls[0][1].p_dates).toEqual({});
  });
  test('does not infer the authenticated actor from an authority id', async () => {
    expect((await service.approveTenantRequest('lease-1', 'auth-1')).success).toBe(false);
    expect((await service.denyTenantRequest('lease-1', 'auth-1')).success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  test.each([null, {}, { success: true, lease: saved.lease, occupancy: null },
    { success: true, occupancy: saved.occupancy }])('does not report success for incomplete RPC result %j', async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    expect((await service.approveTenantRequest('lease-1', 'auth-1', {}, 'landlord-1')).success).toBe(false);
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
  test.each(['transport', 'database'])('failure remains retryable without a success notification: %s', async (failure) => {
    if (failure === 'transport') rpc.mockRejectedValueOnce(new Error('lost reply'));
    else rpc.mockResolvedValueOnce({ data: null, error: { code: '40001' } });
    const result = await service.approveTenantRequest('lease-1', 'auth-1', {}, 'landlord-1');
    expect(result.success).toBe(false);
    expect(notificationService.createNotification).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: { ...saved, replayed: true }, error: null });
    expect((await service.approveTenantRequest('lease-1', 'auth-1', {}, 'landlord-1')).success).toBe(true);
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
  test('returns SQL authorization/state errors without attempting local writes', async () => {
    const rejected = { success: false, error: 'Current verified authority required' };
    rpc.mockResolvedValue({ data: rejected, error: null });
    expect(await service.acceptInvite('proof', 'tenant-1', 't@example.com')).toEqual(rejected);
    expect(mockOccAttach).not.toHaveBeenCalled();
    expect(getTable('HomeLease')).toHaveLength(0);
  });
  test.each([undefined, 'Background check failed'])('denial keeps its existing notification and reason: %s', async (reason) => {
    await service.denyTenantRequest('lease-1', 'auth-1', reason, 'landlord-1');
    expect(rpc).toHaveBeenCalledWith('decide_home_lease', expect.objectContaining({
      p_action: 'deny', p_actor_id: 'landlord-1', p_reason: reason || null,
    }));
    expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'lease_denied', body: reason ? `Your lease request was denied: ${reason}`
        : 'Your lease request was denied by the property authority.',
    }));
  });
  test('asynchronous notification failure does not undo a committed decision', async () => {
    notificationService.createNotification.mockRejectedValueOnce(new Error('delivery unavailable'));
    expect(await service.approveTenantRequest('lease-1', 'auth-1', {}, 'landlord-1')).toEqual(saved);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

// End/move-out persistence and generation checks execute the real SQL contract.
describe('lease end adapter', () => {
  let rpc;
  const saved = { success: true, replayed: false,
    lease: { id: 'lease-1', home_id: 'home-1', primary_resident_user_id: 'tenant-1', state: 'ended' } };
  beforeEach(() => { rpc = jest.fn().mockResolvedValue({ data: saved, error: null }); setRpcMock(rpc); });
  test('forwards the actor and authority and notifies after committed end', async () => {
    expect(await service.endLease('lease-1', 'landlord-1', { authorityId: 'auth-1' })).toEqual(saved);
    expect(rpc).toHaveBeenCalledWith('decide_home_lease', expect.objectContaining({
      p_action: 'end', p_actor_id: 'landlord-1', p_authority_id: 'auth-1', p_lease_id: 'lease-1',
    }));
    expect(mockOccDetach).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
    expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'lease_ended', userId: 'tenant-1', body: expect.stringContaining('retain your own content history'),
    }));
  });
  test('move-out passes its reason into the same transaction', async () => {
    await service.endLease('lease-1', 'co-resident', { moveOut: true, reason: 'Moving' });
    expect(rpc).toHaveBeenCalledWith('decide_home_lease', expect.objectContaining({
      p_action: 'move_out', p_actor_id: 'co-resident', p_authority_id: null, p_reason: 'Moving',
    }));
    expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'co-resident', title: 'You have moved out' }));
  });
  test('failed end and completed replay send no success or duplicate notification', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '40001' } });
    expect((await service.endLease('lease-1', 'tenant-1')).success).toBe(false);
    rpc.mockResolvedValueOnce({ data: { ...saved, replayed: true }, error: null });
    expect((await service.endLease('lease-1', 'tenant-1')).success).toBe(true);
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
  test('reports ambiguous historical linkage without an end notification', async () => {
    const rejected = { success: false, error: 'Historical lease membership requires review before ending access' };
    rpc.mockResolvedValue({ data: rejected, error: null });
    expect(await service.endLease('lease-1', 'tenant-1')).toEqual(rejected);
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
});

describe('_tierRank', () => {
  test('ranks weak < standard < strong < legal', () => {
    expect(service._tierRank('weak')).toBeLessThan(service._tierRank('standard'));
    expect(service._tierRank('standard')).toBeLessThan(service._tierRank('strong'));
    expect(service._tierRank('strong')).toBeLessThan(service._tierRank('legal'));
  });

  test('returns 0 for unknown tiers', () => {
    expect(service._tierRank('unknown')).toBe(0);
  });
});

// ============================================================
// Constants
// ============================================================

describe('Constants', () => {
  test('INVITE_EXPIRY_DAYS is 14', () => {
    expect(LandlordAuthorityService.INVITE_EXPIRY_DAYS).toBe(14);
  });

  test('EVIDENCE_TIER_MAP has expected mappings', () => {
    const map = LandlordAuthorityService.EVIDENCE_TIER_MAP;
    expect(map.deed).toBe('strong');
    expect(map.escrow_attestation).toBe('legal');
    expect(map.utility_bill).toBe('weak');
    expect(map.lease).toBe('standard');
  });
});

describe('intended recipient lease preview', () => {
  const token = 'b'.repeat(64);
  beforeEach(() => {
    seedHome({ home_type: 'apartment', city: 'Synthetic' }); seedAuthority();
    seedTable('HomeLeaseInvite', [{ id: 'invite-1', home_id: 'home-1', token_hash: crypto.createHash('sha256').update(token).digest('hex'),
      invitee_user_id: 'tenant-1', invitee_email: 'Tenant@example.com', status: 'pending',
      proposed_start: '2026-09-01', proposed_end: null, expires_at: new Date(Date.now() + 86400000).toISOString(),
      landlord_subject_type: 'user', landlord_subject_id: 'landlord-1' }]);
  });
  test('returns only the preview without accepting or exposing proof/authority fields', async () => {
    const before = JSON.stringify(getTable('HomeLeaseInvite'));
    const result = await service.previewInvite(token, 'tenant-1', 'tenant@example.com');
    expect(result).toEqual({ success: true, home: { id: 'home-1', name: 'Test Home', city: 'Synthetic' }, account_email: 'tenant@example.com',
      invitation: { status: 'pending', proposed_start: '2026-09-01', proposed_end: null, expires_at: expect.any(String) } });
    expect(JSON.stringify(getTable('HomeLeaseInvite'))).toBe(before);
    expect(getTable('HomeLease')).toHaveLength(0); expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
  test.each([['other-user', 'tenant@example.com'], ['tenant-1', 'other@example.com'], ['tenant-1', '']])(
    'does not reveal a Home to mismatched identity %s / %s', async (actor, email) => {
      expect(await service.previewInvite(token, actor, email)).toEqual({ success: false, status: 404, error: expect.any(String) });
    });
  test('expired pending invites cannot be actionable; accepted ones remain recoverable', async () => {
    getTable('HomeLeaseInvite')[0].expires_at = '2020-01-01';
    expect(await service.previewInvite(token, 'tenant-1', 'tenant@example.com')).toEqual(expect.objectContaining({ success: false, status: 410 }));
    getTable('HomeLeaseInvite')[0].status = 'accepted';
    expect(await service.previewInvite(token, 'tenant-1', 'tenant@example.com')).toEqual(expect.objectContaining({ success: true }));
  });
  test('revoked authority cannot offer acceptance', async () => {
    getTable('HomeAuthority')[0].status = 'revoked';
    expect(await service.previewInvite(token, 'tenant-1', 'tenant@example.com')).toEqual(expect.objectContaining({ success: false, status: 403 }));
  });
});
