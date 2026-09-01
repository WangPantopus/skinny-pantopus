// ============================================================
// INTEGRATION TEST: Business Onboarding — Full Lifecycle
//
// Tests the complete business onboarding flow from creation
// through profile setup, verification, founding offer, and
// security boundaries.
//
// Uses jest.mock() to redirect supabaseAdmin/logger to the
// in-memory mock infrastructure without altering the shared
// integration config (existing tests still hit real Supabase).
// ============================================================

jest.mock('../../config/supabaseAdmin', () => require('../__mocks__/supabaseAdmin'));
jest.mock('../../config/supabase', () => require('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => require('../__mocks__/logger'));

const { resetTables, seedTable, getTable, setRpcMock } = require('../__mocks__/supabaseAdmin');
const supabaseAdmin = require('../__mocks__/supabaseAdmin');

const { calculateProfileCompleteness, calculateAndStoreCompleteness } = require('../../utils/businessCompleteness');
const { checkBusinessPermission } = require('../../utils/businessPermissions');
const { computeCompositeScore } = require('../../utils/discoveryScoring');
const { RESERVED_USERNAMES, VERIFICATION_MULTIPLIERS } = require('../../utils/businessConstants');

beforeEach(() => {
  resetTables();
});

// ── Helpers simulating route handler logic ──────────────────

const VERIFICATION_RANK = {
  unverified: 0,
  self_attested: 1,
  document_verified: 2,
  government_verified: 3,
};

const TOTAL_FOUNDING_SLOTS = 50;

/**
 * Simulate publish validation (from PUT /:businessId route handler).
 */
async function validatePublishRequirements(businessId) {
  const { data: profile } = await supabaseAdmin
    .from('BusinessProfile')
    .select('description, categories')
    .eq('business_user_id', businessId)
    .single();

  const { data: locations } = await supabaseAdmin
    .from('BusinessLocation')
    .select('id, location')
    .eq('business_user_id', businessId)
    .eq('is_active', true);

  const missing = [];
  if (!profile?.description || profile.description.length < 50) {
    missing.push('description');
  }
  if (!Array.isArray(profile?.categories) || profile.categories.length === 0) {
    missing.push('categories');
  }
  if (!(locations || []).some(l => l.location !== null)) {
    missing.push('location_with_coordinates');
  }

  return { canPublish: missing.length === 0, missing };
}

/**
 * Simulate self-attestation (from businessVerification route handler).
 */
async function selfAttest(businessId, legalName) {
  const { data: profile } = await supabaseAdmin
    .from('BusinessProfile')
    .select('verification_status')
    .eq('business_user_id', businessId)
    .single();

  const currentStatus = profile?.verification_status || 'unverified';
  if (VERIFICATION_RANK[currentStatus] >= VERIFICATION_RANK.self_attested) {
    return { status: 200, verification_status: currentStatus, idempotent: true };
  }

  const { data: existingPrivate } = await supabaseAdmin
    .from('BusinessPrivate')
    .select('business_user_id')
    .eq('business_user_id', businessId)
    .maybeSingle();

  if (existingPrivate) {
    await supabaseAdmin
      .from('BusinessPrivate')
      .update({ legal_name: legalName.trim(), updated_at: new Date().toISOString() })
      .eq('business_user_id', businessId);
  } else {
    await supabaseAdmin
      .from('BusinessPrivate')
      .insert({ business_user_id: businessId, legal_name: legalName.trim() });
  }

  await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .insert({ business_user_id: businessId, evidence_type: 'self_attestation', status: 'approved' });

  await supabaseAdmin
    .from('BusinessProfile')
    .update({ verification_status: 'self_attested', verification_tier: 'self_attested' })
    .eq('business_user_id', businessId);

  return { status: 200, verification_status: 'self_attested', idempotent: false };
}

/**
 * Simulate evidence upload (from businessVerification route handler).
 */
async function uploadEvidence(businessId, evidenceType) {
  const { data: pending } = await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .select('id')
    .eq('business_user_id', businessId)
    .eq('evidence_type', evidenceType)
    .eq('status', 'pending')
    .maybeSingle();

  if (pending) return { status: 409, code: 'DUPLICATE_PENDING' };

  const { data: approved } = await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .select('id')
    .eq('business_user_id', businessId)
    .eq('evidence_type', evidenceType)
    .eq('status', 'approved')
    .maybeSingle();

  if (approved) return { status: 409, code: 'ALREADY_VERIFIED' };

  const { data: evidence } = await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .insert({ business_user_id: businessId, evidence_type: evidenceType, status: 'pending' })
    .select()
    .single();

  return { status: 201, evidence_id: evidence.id, evidence_status: 'pending' };
}

/**
 * Simulate evidence review (from businessVerification route handler).
 */
async function reviewEvidence(businessId, evidenceId, decision) {
  const { data: evidence } = await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .select('id, business_user_id, status')
    .eq('id', evidenceId)
    .single();

  if (!evidence) return { status: 404, error: 'Evidence not found' };
  if (evidence.business_user_id !== businessId) return { status: 403, error: 'Wrong business' };
  if (evidence.status !== 'pending') return { status: 400, error: `Already ${evidence.status}` };

  await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .update({ status: decision, reviewed_at: new Date().toISOString() })
    .eq('id', evidenceId);

  if (decision === 'approved') {
    await supabaseAdmin
      .from('BusinessProfile')
      .update({
        verification_status: 'document_verified',
        verification_tier: 'document_verified',
        verified_at: new Date().toISOString(),
      })
      .eq('business_user_id', businessId);
    return { status: 200, verification_status: 'document_verified', evidence_status: 'approved' };
  }

  const { data: profile } = await supabaseAdmin
    .from('BusinessProfile')
    .select('verification_status')
    .eq('business_user_id', businessId)
    .single();

  return { status: 200, verification_status: profile?.verification_status || 'unverified', evidence_status: decision };
}

/**
 * Simulate founding offer claim (from businessFounding route handler).
 */
async function claimFoundingOffer(businessId, userId) {
  const access = await checkBusinessPermission(businessId, userId);
  if (!access.hasAccess || !access.isOwner) {
    return { status: 403, error: 'Only owner can claim' };
  }

  const { data: profile } = await supabaseAdmin
    .from('BusinessProfile')
    .select('is_published, verification_status')
    .eq('business_user_id', businessId)
    .single();

  if (!profile) return { status: 404, error: 'Profile not found' };
  if (!profile.is_published) return { status: 400, code: 'NOT_PUBLISHED' };
  if (!profile.verification_status || profile.verification_status === 'unverified') {
    return { status: 400, code: 'NOT_VERIFIED' };
  }

  const { data: existing } = await supabaseAdmin
    .from('FoundingBusinessSlot')
    .select('id, slot_number')
    .eq('business_user_id', businessId)
    .maybeSingle();

  if (existing) return { status: 409, code: 'ALREADY_CLAIMED', slot_number: existing.slot_number };

  // Count current slots for slot_number assignment
  const { count: currentCount } = await supabaseAdmin
    .from('FoundingBusinessSlot')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  const slotNumber = (currentCount || 0) + 1;
  if (slotNumber > TOTAL_FOUNDING_SLOTS) {
    return { status: 409, code: 'SLOTS_FULL' };
  }

  const { data: slot } = await supabaseAdmin
    .from('FoundingBusinessSlot')
    .insert({
      business_user_id: businessId,
      status: 'active',
      slot_number: slotNumber,
      claimed_at: new Date().toISOString(),
    })
    .select()
    .single();

  return { status: 201, slot_number: slot.slot_number, claimed_at: slot.claimed_at };
}

/**
 * Simulate founding offer status check (from businessFounding route handler).
 */
async function getFoundingOfferStatus(userId) {
  const { count: slotsClaimed } = await supabaseAdmin
    .from('FoundingBusinessSlot')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  const claimed = slotsClaimed || 0;

  const { data: ownerships } = await supabaseAdmin
    .from('BusinessTeam')
    .select('business_user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('role_base', 'owner');

  const businessIds = (ownerships || []).map(o => o.business_user_id);

  let userBusinesses = [];
  if (businessIds.length > 0) {
    const { data: slots } = await supabaseAdmin
      .from('FoundingBusinessSlot')
      .select('business_user_id, slot_number, claimed_at, status')
      .in('business_user_id', businessIds);
    userBusinesses = slots || [];
  }

  return {
    total_slots: TOTAL_FOUNDING_SLOTS,
    slots_claimed: claimed,
    slots_remaining: TOTAL_FOUNDING_SLOTS - claimed,
    is_offer_active: claimed < TOTAL_FOUNDING_SLOTS,
    user_businesses: userBusinesses,
  };
}

/**
 * Simulate rate-limit check for business creation (from POST / route handler).
 */
async function checkCreationRateLimit(userId) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('BusinessTeam')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role_base', 'owner')
    .eq('is_active', true)
    .gte('joined_at', twentyFourHoursAgo);

  return (count || 0) >= 3;
}

// ── SCENARIO 1: Full business creation → setup → publish flow ──

describe('SCENARIO 1: Full business creation → setup → publish flow', () => {
  const BIZ_ID = 'biz-new-1';
  const OWNER_ID = 'user-owner-1';

  beforeEach(() => {
    seedTable('User', [{
      id: BIZ_ID,
      username: 'testbiz',
      name: 'Test Business',
      account_type: 'business',
      tagline: null,
    }]);
    seedTable('BusinessProfile', [{
      business_user_id: BIZ_ID,
      description: null,
      logo_file_id: null,
      banner_file_id: null,
      categories: [],
      public_phone: null,
      public_email: null,
      website: null,
      social_links: null,
      is_published: false,
      verification_status: 'unverified',
      profile_completeness: 0,
    }]);
    seedTable('BusinessTeam', [{
      id: 'team-1',
      business_user_id: BIZ_ID,
      user_id: OWNER_ID,
      role_base: 'owner',
      is_active: true,
    }]);
    seedTable('BusinessLocation', []);
    seedTable('BusinessHours', []);
    seedTable('BusinessCatalogItem', []);
  });

  test('initial completeness is low — only name exists (10 points)', async () => {
    const score = await calculateProfileCompleteness(BIZ_ID);
    expect(score).toBe(10);
  });

  test('completeness increases progressively as profile fields are added', async () => {
    const profiles = getTable('BusinessProfile');

    // Add description (>= 50 chars): +15 → 25
    profiles[0].description = 'A wonderful business that provides top-notch services to the community and beyond.';
    let score = await calculateProfileCompleteness(BIZ_ID);
    expect(score).toBe(25);

    // Add logo: +10 → 35
    profiles[0].logo_file_id = 'logo-file-123';
    score = await calculateProfileCompleteness(BIZ_ID);
    expect(score).toBe(35);

    // Add location with coordinates: +15 → 50
    seedTable('BusinessLocation', [{
      id: 'loc-1',
      business_user_id: BIZ_ID,
      is_active: true,
      location: { type: 'Point', coordinates: [-73.9857, 40.7484] },
    }]);
    score = await calculateProfileCompleteness(BIZ_ID);
    expect(score).toBe(50);

    // Add categories: +5 → 55
    profiles[0].categories = ['home_services', 'plumbing'];
    score = await calculateProfileCompleteness(BIZ_ID);
    expect(score).toBe(55);

    // Add public contact: +10 → 65
    profiles[0].public_phone = '555-1234';
    score = await calculateProfileCompleteness(BIZ_ID);
    expect(score).toBe(65);
  });

  test('publish fails when required fields are missing', async () => {
    const result = await validatePublishRequirements(BIZ_ID);
    expect(result.canPublish).toBe(false);
    expect(result.missing).toContain('description');
    expect(result.missing).toContain('categories');
    expect(result.missing).toContain('location_with_coordinates');
  });

  test('publish succeeds after meeting all requirements', async () => {
    const profiles = getTable('BusinessProfile');
    profiles[0].description = 'A wonderful business that provides top-notch services to the community and beyond.';
    profiles[0].categories = ['home_services'];

    seedTable('BusinessLocation', [{
      id: 'loc-1',
      business_user_id: BIZ_ID,
      is_active: true,
      location: { type: 'Point', coordinates: [-73.9857, 40.7484] },
    }]);

    const result = await validatePublishRequirements(BIZ_ID);
    expect(result.canPublish).toBe(true);
    expect(result.missing).toHaveLength(0);

    // Simulate publish
    await supabaseAdmin
      .from('BusinessProfile')
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq('business_user_id', BIZ_ID);

    const updated = getTable('BusinessProfile');
    expect(updated[0].is_published).toBe(true);
    expect(updated[0].published_at).toBeDefined();
  });

  test('calculateAndStoreCompleteness persists the score to the DB', async () => {
    const score = await calculateAndStoreCompleteness(BIZ_ID);
    expect(score).toBe(10);

    const profiles = getTable('BusinessProfile');
    expect(profiles[0].profile_completeness).toBe(10);
  });

  test('fully populated profile reaches 100% completeness', async () => {
    const profiles = getTable('BusinessProfile');
    profiles[0].description = 'A wonderful business that provides top-notch services to the community and beyond.';
    profiles[0].logo_file_id = 'logo-123';
    profiles[0].banner_file_id = 'banner-123';
    profiles[0].categories = ['home_services'];
    profiles[0].public_phone = '555-1234';
    profiles[0].website = 'https://testbiz.com';

    const users = getTable('User');
    users[0].tagline = 'The best business in town';

    seedTable('BusinessLocation', [{
      id: 'loc-1',
      business_user_id: BIZ_ID,
      is_active: true,
      location: { type: 'Point', coordinates: [-73.9857, 40.7484] },
    }]);
    seedTable('BusinessHours', [{
      id: 'hours-1',
      location_id: 'loc-1',
      day_of_week: 1,
      open_time: '09:00',
      close_time: '17:00',
    }]);
    seedTable('BusinessCatalogItem', [{
      id: 'item-1',
      business_user_id: BIZ_ID,
      status: 'active',
    }]);

    const score = await calculateProfileCompleteness(BIZ_ID);
    expect(score).toBe(100);
  });
});

// ── SCENARIO 2: Verification progression ────────────────────

describe('SCENARIO 2: Verification progression', () => {
  const BIZ_ID = 'biz-verify-1';

  beforeEach(() => {
    seedTable('BusinessProfile', [{
      business_user_id: BIZ_ID,
      verification_status: 'unverified',
    }]);
    seedTable('BusinessPrivate', []);
    seedTable('BusinessVerificationEvidence', []);
  });

  test('progresses through unverified → self_attested → document_verified', async () => {
    // Step 1: starts unverified
    const profiles = getTable('BusinessProfile');
    expect(profiles[0].verification_status).toBe('unverified');

    // Step 2: self-attest → self_attested
    const attestResult = await selfAttest(BIZ_ID, 'Test Business LLC');
    expect(attestResult.status).toBe(200);
    expect(attestResult.verification_status).toBe('self_attested');
    expect(attestResult.idempotent).toBe(false);

    expect(getTable('BusinessProfile')[0].verification_status).toBe('self_attested');
    expect(getTable('BusinessPrivate')[0].legal_name).toBe('Test Business LLC');

    // Step 3: upload evidence → pending
    const uploadResult = await uploadEvidence(BIZ_ID, 'business_license');
    expect(uploadResult.status).toBe(201);
    expect(uploadResult.evidence_status).toBe('pending');

    const evidence = getTable('BusinessVerificationEvidence');
    const pendingEvidence = evidence.find(e => e.evidence_type === 'business_license');
    expect(pendingEvidence.status).toBe('pending');

    // Step 4: approve → document_verified
    const reviewResult = await reviewEvidence(BIZ_ID, pendingEvidence.id, 'approved');
    expect(reviewResult.status).toBe(200);
    expect(reviewResult.verification_status).toBe('document_verified');
    expect(reviewResult.evidence_status).toBe('approved');

    expect(getTable('BusinessProfile')[0].verification_status).toBe('document_verified');
    expect(getTable('BusinessProfile')[0].verified_at).toBeDefined();
  });

  test('discovery scores increase with higher verification tiers', () => {
    const baseRow = {
      neighbor_count: '10',
      distance_meters: '500',
      average_rating: '4.5',
      review_count: '15',
      profile_completeness: '80',
      last_activity_at: new Date().toISOString(),
      completed_gigs: '10',
      profile_created_at: '2024-01-01T00:00:00Z',
    };

    const scores = {};
    for (const status of ['unverified', 'self_attested', 'document_verified', 'government_verified']) {
      scores[status] = computeCompositeScore({ ...baseRow, verification_status: status });
    }

    // Ordering: unverified < self_attested < document_verified < government_verified
    expect(scores.unverified).toBeLessThan(scores.self_attested);
    expect(scores.self_attested).toBeLessThan(scores.document_verified);
    expect(scores.document_verified).toBeLessThan(scores.government_verified);

    // Ratios match VERIFICATION_MULTIPLIERS
    for (const status of ['unverified', 'document_verified', 'government_verified']) {
      const ratio = scores[status] / scores.self_attested;
      const expected = VERIFICATION_MULTIPLIERS[status] / VERIFICATION_MULTIPLIERS.self_attested;
      expect(ratio).toBeCloseTo(expected, 5);
    }
  });
});

// ── SCENARIO 3: Founding offer lifecycle ────────────────────

describe('SCENARIO 3: Founding offer lifecycle', () => {
  const BIZ_ID = 'biz-founding-1';
  const OWNER_ID = 'user-founder-1';

  beforeEach(() => {
    seedTable('BusinessProfile', [{
      business_user_id: BIZ_ID,
      is_published: false,
      verification_status: 'unverified',
    }]);
    seedTable('BusinessTeam', [{
      id: 'team-1',
      business_user_id: BIZ_ID,
      user_id: OWNER_ID,
      role_base: 'owner',
      is_active: true,
    }]);
    seedTable('FoundingBusinessSlot', []);
    seedTable('BusinessPrivate', []);
    seedTable('BusinessVerificationEvidence', []);
  });

  test('full lifecycle: check status → fail → publish + attest → claim → dup → verify count', async () => {
    // Step 1: check status — all 50 slots remaining
    const initialStatus = await getFoundingOfferStatus(OWNER_ID);
    expect(initialStatus.total_slots).toBe(50);
    expect(initialStatus.slots_remaining).toBe(50);
    expect(initialStatus.is_offer_active).toBe(true);
    expect(initialStatus.user_businesses).toHaveLength(0);

    // Step 2: claim with unpublished business → NOT_PUBLISHED
    const failClaim = await claimFoundingOffer(BIZ_ID, OWNER_ID);
    expect(failClaim.status).toBe(400);
    expect(failClaim.code).toBe('NOT_PUBLISHED');

    // Step 3: publish and self-attest
    const profiles = getTable('BusinessProfile');
    profiles[0].is_published = true;
    profiles[0].published_at = new Date().toISOString();

    const attestResult = await selfAttest(BIZ_ID, 'Founding Biz LLC');
    expect(attestResult.verification_status).toBe('self_attested');

    // Step 4: claim → success, slot_number = 1
    const claimResult = await claimFoundingOffer(BIZ_ID, OWNER_ID);
    expect(claimResult.status).toBe(201);
    expect(claimResult.slot_number).toBe(1);
    expect(claimResult.claimed_at).toBeDefined();

    // Step 5: duplicate claim → ALREADY_CLAIMED (409)
    const dupClaim = await claimFoundingOffer(BIZ_ID, OWNER_ID);
    expect(dupClaim.status).toBe(409);
    expect(dupClaim.code).toBe('ALREADY_CLAIMED');

    // Step 6: verify 49 remaining
    const afterStatus = await getFoundingOfferStatus(OWNER_ID);
    expect(afterStatus.slots_claimed).toBe(1);
    expect(afterStatus.slots_remaining).toBe(49);
    expect(afterStatus.user_businesses).toHaveLength(1);
    expect(afterStatus.user_businesses[0].slot_number).toBe(1);
  });

  test('unverified business cannot claim even if published', async () => {
    const profiles = getTable('BusinessProfile');
    profiles[0].is_published = true;

    const result = await claimFoundingOffer(BIZ_ID, OWNER_ID);
    expect(result.status).toBe(400);
    expect(result.code).toBe('NOT_VERIFIED');
  });

  test('non-owner cannot claim founding slot', async () => {
    const profiles = getTable('BusinessProfile');
    profiles[0].is_published = true;
    profiles[0].verification_status = 'self_attested';

    const result = await claimFoundingOffer(BIZ_ID, 'random-user');
    expect(result.status).toBe(403);
  });
});

// ── SCENARIO 4: Security boundaries ─────────────────────────

describe('SCENARIO 4: Security boundaries', () => {
  const BIZ_ID = 'biz-sec-1';
  const OWNER_ID = 'user-owner-sec';
  const STRANGER_ID = 'user-stranger';
  const STAFF_ID = 'user-staff';

  beforeEach(() => {
    seedTable('BusinessProfile', [{
      business_user_id: BIZ_ID,
      description: null,
      categories: [],
      is_published: false,
      verification_status: 'unverified',
    }]);
    seedTable('BusinessTeam', [
      {
        id: 'team-owner',
        business_user_id: BIZ_ID,
        user_id: OWNER_ID,
        role_base: 'owner',
        is_active: true,
      },
      {
        id: 'team-staff',
        business_user_id: BIZ_ID,
        user_id: STAFF_ID,
        role_base: 'staff',
        is_active: true,
      },
    ]);
    seedTable('BusinessRolePermission', [
      { role_base: 'staff', permission: 'profile.view', allowed: true },
      { role_base: 'staff', permission: 'profile.edit', allowed: false },
    ]);
    seedTable('BusinessPermissionOverride', []);
    seedTable('BusinessLocation', []);
  });

  test('non-member is denied access', async () => {
    const access = await checkBusinessPermission(BIZ_ID, STRANGER_ID, 'profile.edit');
    expect(access.hasAccess).toBe(false);
    expect(access.isOwner).toBe(false);
    expect(access.membership).toBeNull();
  });

  test('staff without profile.edit permission is denied', async () => {
    const access = await checkBusinessPermission(BIZ_ID, STAFF_ID, 'profile.edit');
    expect(access.hasAccess).toBe(false);
    expect(access.isOwner).toBe(false);
  });

  test('owner always has full access regardless of permission', async () => {
    const access = await checkBusinessPermission(BIZ_ID, OWNER_ID, 'profile.edit');
    expect(access.hasAccess).toBe(true);
    expect(access.isOwner).toBe(true);
  });

  test('reserved usernames are blocked', () => {
    const reservedNames = ['admin', 'settings', 'dashboard', 'api', 'login', 'signup'];
    for (const name of reservedNames) {
      expect(RESERVED_USERNAMES.has(name)).toBe(true);
    }
    // Non-reserved names pass
    expect(RESERVED_USERNAMES.has('acme_plumbing')).toBe(false);
    expect(RESERVED_USERNAMES.has('joes_garage')).toBe(false);
  });

  test('rate limit blocks 4th business creation within 24 hours', async () => {
    const now = new Date().toISOString();
    seedTable('BusinessTeam', [
      { id: 't1', user_id: 'rate-user', role_base: 'owner', is_active: true, joined_at: now },
      { id: 't2', user_id: 'rate-user', role_base: 'owner', is_active: true, joined_at: now },
      { id: 't3', user_id: 'rate-user', role_base: 'owner', is_active: true, joined_at: now },
    ]);

    const isLimited = await checkCreationRateLimit('rate-user');
    expect(isLimited).toBe(true);

    // Under the limit (2 recent) should pass
    seedTable('BusinessTeam', [
      { id: 't1', user_id: 'rate-user', role_base: 'owner', is_active: true, joined_at: now },
      { id: 't2', user_id: 'rate-user', role_base: 'owner', is_active: true, joined_at: now },
    ]);

    const notLimited = await checkCreationRateLimit('rate-user');
    expect(notLimited).toBe(false);
  });

  test('empty profile cannot be published — all requirements missing', async () => {
    const result = await validatePublishRequirements(BIZ_ID);
    expect(result.canPublish).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining(['description', 'categories', 'location_with_coordinates'])
    );
    expect(result.missing).toHaveLength(3);
  });
});
