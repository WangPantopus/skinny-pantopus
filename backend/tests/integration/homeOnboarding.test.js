/**
 * Integration tests: Home Onboarding Flows
 *
 * Tests the full lifecycle: home creation, claims, postcard verification,
 * invite acceptance, move-out, and duplicate prevention against a real DB.
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 * and a running backend at BACKEND_URL (default http://localhost:8000).
 */
const { createTestUser, cleanup, apiRequest, admin } = require('./helpers');

// ── Shared test state ──────────────────────────────────────

let ts; // unique timestamp for this run, prevents address collisions
beforeAll(() => {
  ts = Date.now();
});

afterAll(async () => {
  await cleanup();
});

// Helper: build a unique home body with coordinates
function homeBody(suffix, overrides = {}) {
  return {
    address: `${ts} Integration ${suffix} St`,
    city: 'Testville',
    state: 'CA',
    zipcode: '90210',
    home_type: 'house',
    latitude: 34.0901 + Math.random() * 0.001,
    longitude: -118.4065 + Math.random() * 0.001,
    ...overrides,
  };
}

// ============================================================
// SCENARIO A — Owner creates home
// ============================================================
describe('Scenario A: Owner creates home', () => {
  let owner, homeId, responseBody;

  beforeAll(async () => {
    owner = await createTestUser({ name: 'Owner A', username: `owner_a_${ts}` });
    const res = await apiRequest('POST', '/api/homes', owner.token, homeBody('OwnerA', {
      is_owner: true,
      role: 'owner',
    }));
    expect(res.status).toBe(201);
    responseBody = res.body;
    homeId = res.body.home.id;
  });

  test('response indicates ownership verification needed', () => {
    expect(responseBody.requires_verification).toBe(true);
    expect(responseBody.verification_type).toBe('ownership');
    expect(responseBody.home.ownership_status).toBe('pending_verification');
    expect(responseBody.home.ownership_claim_id).toBeDefined();
  });

  test('HomeOccupancy created with role_base=admin, verification_status=pending_doc', async () => {
    const { data: occ } = await admin
      .from('HomeOccupancy')
      .select('*')
      .eq('home_id', homeId)
      .eq('user_id', owner.userId)
      .eq('is_active', true)
      .single();

    expect(occ).not.toBeNull();
    expect(occ.role_base).toBe('admin');
    expect(occ.verification_status).toBe('pending_doc');
  });

  test('all booleans match pending_doc template (all false)', async () => {
    const { data: occ } = await admin
      .from('HomeOccupancy')
      .select('can_manage_home, can_manage_access, can_manage_finance, can_manage_tasks, can_view_sensitive')
      .eq('home_id', homeId)
      .eq('user_id', owner.userId)
      .eq('is_active', true)
      .single();

    // pending_doc is a non-verified status → all false, role downgraded to restricted_member
    expect(occ.can_manage_home).toBe(false);
    expect(occ.can_manage_access).toBe(false);
    expect(occ.can_manage_finance).toBe(false);
    expect(occ.can_manage_tasks).toBe(false);
    expect(occ.can_view_sensitive).toBe(false);
  });

  test('HomeOwnershipClaim created in submitted state', async () => {
    const { data: claim } = await admin
      .from('HomeOwnershipClaim')
      .select('*')
      .eq('home_id', homeId)
      .eq('claimant_user_id', owner.userId)
      .single();

    expect(claim).not.toBeNull();
    expect(claim.state).toBe('submitted');
    expect(claim.claim_type).toBe('owner');
    expect(claim.method).toBe('doc_upload');
  });

  test('HomeOwner created with owner_status=pending', async () => {
    const { data: homeOwner } = await admin
      .from('HomeOwner')
      .select('*')
      .eq('home_id', homeId)
      .eq('subject_id', owner.userId)
      .single();

    expect(homeOwner).not.toBeNull();
    expect(homeOwner.owner_status).toBe('pending');
    expect(homeOwner.is_primary_owner).toBe(true);
    expect(homeOwner.verification_tier).toBe('weak');
    expect(homeOwner.added_via).toBe('claim');
  });

  test('Home.owner_id is set to the owner', async () => {
    const { data: home } = await admin
      .from('Home')
      .select('owner_id, tenure_mode')
      .eq('id', homeId)
      .single();

    expect(home.owner_id).toBe(owner.userId);
    expect(home.tenure_mode).toBe('owner_occupied');
  });
});


// ============================================================
// SCENARIO B — Renter creates home (cold-start self-bootstrap)
// ============================================================
describe('Scenario B: Renter creates home (cold-start self-bootstrap)', () => {
  let renter, homeId;

  beforeAll(async () => {
    renter = await createTestUser({ name: 'Renter B', username: `renter_b_${ts}` });
  });

  test('step 1: POST /api/homes with is_owner=false, role=renter', async () => {
    const res = await apiRequest('POST', '/api/homes', renter.token, homeBody('RenterB', {
      is_owner: false,
      role: 'renter',
    }));

    expect(res.status).toBe(201);
    expect(res.body.requires_verification).toBe(true);
    expect(res.body.verification_type).toBe('residency');
    homeId = res.body.home.id;

    // owner_id should be null for renters
    expect(res.body.home.owner_id).toBeNull();
    expect(res.body.home.tenure_mode).toBe('rental');
  });

  test('step 2: occupancy is provisional_bootstrap with can_manage_tasks=true', async () => {
    const { data: occ } = await admin
      .from('HomeOccupancy')
      .select('*')
      .eq('home_id', homeId)
      .eq('user_id', renter.userId)
      .eq('is_active', true)
      .single();

    expect(occ).not.toBeNull();
    expect(occ.verification_status).toBe('provisional_bootstrap');
    expect(occ.can_manage_tasks).toBe(true);
    expect(occ.can_manage_home).toBe(false);
    expect(occ.can_manage_access).toBe(false);
    expect(occ.can_manage_finance).toBe(false);
    expect(occ.can_view_sensitive).toBe(false);
  });

  test('step 3: POST /:id/claim routes to self_bootstrap', async () => {
    const res = await apiRequest('POST', `/api/homes/${homeId}/claim`, renter.token, {
      claimed_role: 'lease_resident',
    });

    expect(res.status).toBe(201);
    expect(res.body.cold_start).toBe(true);
    expect(res.body.verification_needed).toBe(true);
  });

  test('step 4: claim has cold_start_mode=self_bootstrap', async () => {
    const { data: claim } = await admin
      .from('HomeResidencyClaim')
      .select('*')
      .eq('home_id', homeId)
      .eq('user_id', renter.userId)
      .single();

    expect(claim).not.toBeNull();
    expect(claim.cold_start_mode).toBe('self_bootstrap');
    expect(claim.claimed_role).toBe('lease_resident');
  });

  test('step 5: request postcard', async () => {
    const res = await apiRequest('POST', `/api/homes/${homeId}/request-postcard`, renter.token);
    expect(res.status).toBe(201);
    expect(res.body.postcard).toBeDefined();
    expect(res.body.postcard.id).toBeDefined();
  });

  test('step 6: verify postcard with correct code → promoted to verified', async () => {
    // Read the code directly from DB (in real life, mailed)
    const { data: postcard } = await admin
      .from('HomePostcardCode')
      .select('id, code')
      .eq('home_id', homeId)
      .eq('user_id', renter.userId)
      .eq('status', 'pending')
      .single();

    expect(postcard).not.toBeNull();

    const res = await apiRequest('POST', `/api/homes/${homeId}/verify-postcard`, renter.token, {
      code: postcard.code,
    });

    expect(res.status).toBe(200);
    // No authorities → should be verified directly
    expect(res.body.verification_status).toBe('verified');
  });

  test('step 7: occupancy now has full lease_resident booleans', async () => {
    const { data: occ } = await admin
      .from('HomeOccupancy')
      .select('*')
      .eq('home_id', homeId)
      .eq('user_id', renter.userId)
      .eq('is_active', true)
      .single();

    expect(occ.verification_status).toBe('verified');
    expect(occ.role_base).toBe('lease_resident');
    // lease_resident template
    expect(occ.can_manage_home).toBe(false);
    expect(occ.can_manage_access).toBe(false);
    expect(occ.can_manage_finance).toBe(false);
    expect(occ.can_manage_tasks).toBe(true);
    expect(occ.can_view_sensitive).toBe(true);
  });
});


// ============================================================
// SCENARIO C — Existing home, invite acceptance
// ============================================================
describe('Scenario C: Invite acceptance', () => {
  let owner, invitee, wrongUser, homeId, inviteToken;

  beforeAll(async () => {
    owner = await createTestUser({ name: 'Owner C', username: `owner_c_${ts}` });
    invitee = await createTestUser({ name: 'Invitee C', username: `invitee_c_${ts}` });
    wrongUser = await createTestUser({ name: 'Wrong C', username: `wrong_c_${ts}` });

    // Create home as owner
    const homeRes = await apiRequest('POST', '/api/homes', owner.token, homeBody('OwnerC', {
      is_owner: true,
    }));
    homeId = homeRes.body.home.id;

    // Owner needs can_manage_access, but as pending_doc owner they have all-false booleans.
    // Grant via direct DB update for test purposes.
    await admin
      .from('HomeOccupancy')
      .update({
        can_manage_access: true,
        verification_status: 'verified',
        role_base: 'owner',
      })
      .eq('home_id', homeId)
      .eq('user_id', owner.userId);
  });

  test('create targeted invite for invitee email', async () => {
    const res = await apiRequest('POST', `/api/homes/${homeId}/invite`, owner.token, {
      email: invitee.userRow.email,
      relationship: 'member',
    });

    expect(res.status).toBe(201);
    expect(res.body.invitation).toBeDefined();
    expect(res.body.invitation.token).toBeDefined();
    expect(res.body.invitation.is_open_invite).toBe(false);
    inviteToken = res.body.invitation.token;
  });

  test('wrong user cannot accept targeted invite → 403 INVITE_EMAIL_MISMATCH', async () => {
    const res = await apiRequest('POST', `/api/homes/invitations/token/${inviteToken}/accept`, wrongUser.token);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INVITE_EMAIL_MISMATCH');
  });

  test('correct user accepts → verified status with member booleans', async () => {
    const res = await apiRequest('POST', `/api/homes/invitations/token/${inviteToken}/accept`, invitee.token);

    expect(res.status).toBe(200);
    expect(res.body.occupancy).toBeDefined();
    expect(res.body.occupancy.verification_status).toBe('verified');
    expect(res.body.occupancy.role_base).toBe('member');

    // member template
    expect(res.body.occupancy.can_manage_home).toBe(false);
    expect(res.body.occupancy.can_manage_access).toBe(false);
    expect(res.body.occupancy.can_manage_finance).toBe(false);
    expect(res.body.occupancy.can_manage_tasks).toBe(true);
    expect(res.body.occupancy.can_view_sensitive).toBe(true);
  });
});


// ============================================================
// SCENARIO D — Postcard on claimed home (challenge window)
// ============================================================
describe('Scenario D: Postcard verification with challenge window', () => {
  let owner, claimant, homeId;

  beforeAll(async () => {
    owner = await createTestUser({ name: 'Owner D', username: `owner_d_${ts}` });
    claimant = await createTestUser({ name: 'Claimant D', username: `claimant_d_${ts}` });

    // Create home as owner and verify the owner
    const homeRes = await apiRequest('POST', '/api/homes', owner.token, homeBody('OwnerD', {
      is_owner: true,
    }));
    homeId = homeRes.body.home.id;

    // Upgrade owner to verified so they count as an authority
    await admin
      .from('HomeOccupancy')
      .update({
        verification_status: 'verified',
        role_base: 'owner',
        can_manage_home: true,
        can_manage_access: true,
        can_manage_finance: true,
        can_manage_tasks: true,
        can_view_sensitive: true,
      })
      .eq('home_id', homeId)
      .eq('user_id', owner.userId);

    // Also update the owner's last_sign_in_at to be recent so they count as active
    await admin.auth.admin.updateUserById(owner.userId, {
      user_metadata: { last_active: new Date().toISOString() },
    });
    await admin
      .from('User')
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq('id', owner.userId);
  });

  test('claimant submits residency claim → pending_approval (has authorities)', async () => {
    const res = await apiRequest('POST', `/api/homes/${homeId}/claim`, claimant.token, {
      claimed_role: 'member',
    });

    expect(res.status).toBe(201);
    // PATH 3: home has active authorities → normal approval
    expect(res.body.claim).toBeDefined();
  });

  test('claimant requests postcard', async () => {
    const res = await apiRequest('POST', `/api/homes/${homeId}/request-postcard`, claimant.token);
    expect(res.status).toBe(201);
  });

  test('claimant enters correct code → provisional with challenge window', async () => {
    // Get the code from DB
    const { data: postcard } = await admin
      .from('HomePostcardCode')
      .select('id, code')
      .eq('home_id', homeId)
      .eq('user_id', claimant.userId)
      .eq('status', 'pending')
      .single();

    const res = await apiRequest('POST', `/api/homes/${homeId}/verify-postcard`, claimant.token, {
      code: postcard.code,
    });

    expect(res.status).toBe(200);
    // HAS authorities → provisional with challenge window
    expect(res.body.verification_status).toBe('provisional');
    expect(res.body.challenge_window_ends_at).toBeDefined();
  });

  test('occupancy is provisional with challenge window set', async () => {
    const { data: occ } = await admin
      .from('HomeOccupancy')
      .select('*')
      .eq('home_id', homeId)
      .eq('user_id', claimant.userId)
      .eq('is_active', true)
      .single();

    expect(occ.verification_status).toBe('provisional');
    expect(occ.challenge_window_started_at).toBeDefined();
    expect(occ.challenge_window_ends_at).toBeDefined();

    // Provisional → all booleans false
    expect(occ.can_manage_home).toBe(false);
    expect(occ.can_manage_access).toBe(false);
    expect(occ.can_manage_finance).toBe(false);
    expect(occ.can_manage_tasks).toBe(false);
    expect(occ.can_view_sensitive).toBe(false);
  });

  test('home security_state transitions during challenge', async () => {
    // The home should still be in a valid state (normal or claim_window).
    // The verify-postcard route does not transition to claim_window;
    // that is handled by the challenge-member or claim review routes.
    const { data: home } = await admin
      .from('Home')
      .select('security_state')
      .eq('id', homeId)
      .single();

    expect(['normal', 'claim_window']).toContain(home.security_state);
  });
});


// ============================================================
// SCENARIO E — Token invite bypass prevention
// ============================================================
describe('Scenario E: Token invite bypass prevention', () => {
  let owner, userA, userB, homeId, inviteToken;

  beforeAll(async () => {
    owner = await createTestUser({ name: 'Owner E', username: `owner_e_${ts}` });
    userA = await createTestUser({ name: 'User A', username: `user_a_${ts}` });
    userB = await createTestUser({ name: 'User B', username: `user_b_${ts}` });

    // Create home and upgrade owner to verified
    const homeRes = await apiRequest('POST', '/api/homes', owner.token, homeBody('OwnerE', {
      is_owner: true,
    }));
    homeId = homeRes.body.home.id;

    await admin
      .from('HomeOccupancy')
      .update({
        can_manage_access: true,
        verification_status: 'verified',
        role_base: 'owner',
      })
      .eq('home_id', homeId)
      .eq('user_id', owner.userId);

    // Create targeted invite for user A's email
    const inviteRes = await apiRequest('POST', `/api/homes/${homeId}/invite`, owner.token, {
      email: userA.userRow.email,
      relationship: 'member',
    });
    inviteToken = inviteRes.body.invitation.token;
  });

  test('user B tries to accept user A invite → 403 INVITE_EMAIL_MISMATCH', async () => {
    const res = await apiRequest('POST', `/api/homes/invitations/token/${inviteToken}/accept`, userB.token);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INVITE_EMAIL_MISMATCH');
    expect(res.body.hint).toBeDefined(); // masked email hint
  });

  test('user A accepts → success with verified occupancy', async () => {
    const res = await apiRequest('POST', `/api/homes/invitations/token/${inviteToken}/accept`, userA.token);

    expect(res.status).toBe(200);
    expect(res.body.occupancy).toBeDefined();
    expect(res.body.occupancy.verification_status).toBe('verified');
    expect(res.body.occupancy.role_base).toBe('member');
  });

  test('invite is now accepted (not reusable)', async () => {
    const { data: invite } = await admin
      .from('HomeInvite')
      .select('status')
      .eq('token', inviteToken)
      .single();

    expect(invite.status).toBe('accepted');
  });
});


// ============================================================
// SCENARIO F — Move-out flow
// ============================================================
describe('Scenario F: Move-out flow', () => {
  let owner, member, homeId;

  beforeAll(async () => {
    owner = await createTestUser({ name: 'Owner F', username: `owner_f_${ts}` });
    member = await createTestUser({ name: 'Member F', username: `member_f_${ts}` });

    // Create home
    const homeRes = await apiRequest('POST', '/api/homes', owner.token, homeBody('OwnerF', {
      is_owner: true,
    }));
    homeId = homeRes.body.home.id;

    // Upgrade owner to verified
    await admin
      .from('HomeOccupancy')
      .update({
        can_manage_access: true,
        verification_status: 'verified',
        role_base: 'owner',
      })
      .eq('home_id', homeId)
      .eq('user_id', owner.userId);

    // Add member via invite
    const inviteRes = await apiRequest('POST', `/api/homes/${homeId}/invite`, owner.token, {
      email: member.userRow.email,
      relationship: 'member',
    });
    const token = inviteRes.body.invitation.token;
    await apiRequest('POST', `/api/homes/invitations/token/${token}/accept`, member.token);
  });

  test('member has active occupancy before move-out', async () => {
    const { data: occ } = await admin
      .from('HomeOccupancy')
      .select('is_active, verification_status')
      .eq('home_id', homeId)
      .eq('user_id', member.userId)
      .single();

    expect(occ.is_active).toBe(true);
    expect(occ.verification_status).toBe('verified');
  });

  test('POST /:id/move-out deactivates occupancy', async () => {
    const res = await apiRequest('POST', `/api/homes/${homeId}/move-out`, member.token);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('removed');
  });

  test('occupancy is deactivated with moved_out status', async () => {
    const { data: occ } = await admin
      .from('HomeOccupancy')
      .select('is_active, verification_status, end_at')
      .eq('home_id', homeId)
      .eq('user_id', member.userId)
      .single();

    expect(occ.is_active).toBe(false);
    expect(occ.verification_status).toBe('moved_out');
    expect(occ.end_at).toBeDefined();
  });

  test('notifications sent to remaining members', async () => {
    // Check that a notification was created for the owner
    const { data: notifications } = await admin
      .from('Notification')
      .select('type, body')
      .eq('user_id', owner.userId)
      .eq('type', 'member_moved_out');

    // At least one member_moved_out notification should exist
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    const movedOutNotif = notifications.find(n => n.body.includes('moved out'));
    expect(movedOutNotif).toBeDefined();
  });
});

// ============================================================
// SCENARIO F2 — Move-out after occupancy already deactivated (stale row)
// ============================================================
describe('Scenario F2: Move-out reconciles stale inactive occupancy', () => {
  let owner, member, homeId;

  beforeAll(async () => {
    owner = await createTestUser({ name: 'Owner F2', username: `owner_f2_${ts}` });
    member = await createTestUser({ name: 'Member F2', username: `member_f2_${ts}` });

    const homeRes = await apiRequest('POST', '/api/homes', owner.token, homeBody('OwnerF2', {
      is_owner: true,
    }));
    homeId = homeRes.body.home.id;

    await admin
      .from('HomeOccupancy')
      .update({
        can_manage_access: true,
        verification_status: 'verified',
        role_base: 'owner',
      })
      .eq('home_id', homeId)
      .eq('user_id', owner.userId);

    const inviteRes = await apiRequest('POST', `/api/homes/${homeId}/invite`, owner.token, {
      email: member.userRow.email,
      relationship: 'member',
    });
    const token = inviteRes.body.invitation.token;
    await apiRequest('POST', `/api/homes/invitations/token/${token}/accept`, member.token);

    // Simulate detach-style stale row: inactive but verification_status not yet moved_out
    // (production may use suspended_challenged; any non–moved_out value exercises the same branch)
    await admin
      .from('HomeOccupancy')
      .update({
        is_active: false,
        end_at: new Date().toISOString(),
        verification_status: 'provisional',
        updated_at: new Date().toISOString(),
      })
      .eq('home_id', homeId)
      .eq('user_id', member.userId);
  });

  test('POST /:id/move-out succeeds and normalizes occupancy to moved_out', async () => {
    const res = await apiRequest('POST', `/api/homes/${homeId}/move-out`, member.token);

    expect(res.status).toBe(200);
    expect(res.body.reconciled_stale_occupancy).toBe(true);
    expect(res.body.message).toContain('removed');

    const { data: occ } = await admin
      .from('HomeOccupancy')
      .select('verification_status, is_active')
      .eq('home_id', homeId)
      .eq('user_id', member.userId)
      .single();

    expect(occ.is_active).toBe(false);
    expect(occ.verification_status).toBe('moved_out');
  });
});


// ============================================================
// SCENARIO G — Duplicate occupancy prevention
// ============================================================
describe('Scenario G: Duplicate occupancy prevention (upsert)', () => {
  let renter, homeId;

  beforeAll(async () => {
    renter = await createTestUser({ name: 'Renter G', username: `renter_g_${ts}` });

    // Create home as renter (creates occupancy with provisional_bootstrap)
    const homeRes = await apiRequest('POST', '/api/homes', renter.token, homeBody('RenterG', {
      is_owner: false,
      role: 'renter',
    }));
    homeId = homeRes.body.home.id;
  });

  test('renter has exactly one occupancy after creation', async () => {
    const { data: occs } = await admin
      .from('HomeOccupancy')
      .select('id')
      .eq('home_id', homeId)
      .eq('user_id', renter.userId);

    expect(occs.length).toBe(1);
  });

  test('submit claim (self-bootstrap) → still exactly one occupancy', async () => {
    const res = await apiRequest('POST', `/api/homes/${homeId}/claim`, renter.token, {
      claimed_role: 'lease_resident',
    });

    expect(res.status).toBe(201);

    // applyOccupancyTemplate uses upsert with onConflict: 'home_id,user_id'
    // so we should still have exactly ONE occupancy row
    const { data: occs } = await admin
      .from('HomeOccupancy')
      .select('id')
      .eq('home_id', homeId)
      .eq('user_id', renter.userId);

    expect(occs.length).toBe(1);
  });

  test('request and verify postcard → still exactly one occupancy', async () => {
    // Request postcard
    await apiRequest('POST', `/api/homes/${homeId}/request-postcard`, renter.token);

    // Get the code
    const { data: postcard } = await admin
      .from('HomePostcardCode')
      .select('code')
      .eq('home_id', homeId)
      .eq('user_id', renter.userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Verify
    await apiRequest('POST', `/api/homes/${homeId}/verify-postcard`, renter.token, {
      code: postcard.code,
    });

    // Should STILL have exactly one occupancy row
    const { data: occs } = await admin
      .from('HomeOccupancy')
      .select('id, verification_status')
      .eq('home_id', homeId)
      .eq('user_id', renter.userId);

    expect(occs.length).toBe(1);
    expect(occs[0].verification_status).toBe('verified');
  });
});
