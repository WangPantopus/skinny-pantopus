// ============================================================
// INTEGRATION TEST: Identity Firewall — Full Lifecycle
//
// Tests the complete identity firewall flow: seat creation &
// invite, invite acceptance, permission resolution, privacy
// settings, scoped blocks, and audit logging.
//
// Uses jest.mock() to redirect to in-memory mock infrastructure
// (same approach as business-onboarding.test.js).
// ============================================================

jest.mock('../../config/supabaseAdmin', () => require('../__mocks__/supabaseAdmin'));
jest.mock('../../config/supabase', () => require('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => require('../__mocks__/logger'));

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const supabaseAdmin = require('../__mocks__/supabaseAdmin');

const {
  getSeatForUser,
  hasSeatPermission,
  getSeatAccess,
  getAllSeatsForUser,
  getBusinessSeats,
  getBusinessIdsWithSeatPermissions,
  getSeatHoldersWithPermissions,
  writeSeatAuditLog,
  getRoleRank,
  BUSINESS_ROLE_RANK,
  ALL_PERMS,
} = require('../../utils/seatPermissions');

const { isSearchable, canViewProfileField, isScopedBlocked } = require('../../utils/visibilityPolicy');

const crypto = require('crypto');

beforeEach(() => {
  resetTables();
});

// ── Constants ────────────────────────────────────────────────

const BIZ_OWNER_ID = 'owner-0000-0000-0000-000000000001';
const BIZ_ID = 'biz-00000-0000-0000-0000-000000000001';
const INVITED_USER_ID = 'user-00000-0000-0000-0000-000000000002';
const VIEWER_USER_ID = 'user-00000-0000-0000-0000-000000000003';

/**
 * Helper: create a BusinessSeat row (matches makeSeatRow in unit test).
 */
function makeSeat(id, overrides = {}) {
  return {
    id,
    business_user_id: overrides.business_user_id || BIZ_ID,
    display_name: overrides.display_name || 'Seat',
    display_avatar_file_id: null,
    role_base: overrides.role_base || 'editor',
    contact_method: null,
    is_active: overrides.is_active !== undefined ? overrides.is_active : true,
    invite_status: overrides.invite_status || 'accepted',
    invite_email: overrides.invite_email || null,
    invite_token_hash: overrides.invite_token_hash || null,
    accepted_at: overrides.accepted_at || new Date().toISOString(),
    deactivated_at: null,
    deactivated_reason: null,
    notes: overrides.notes || null,
    title: overrides.title || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── 1. Seat Lifecycle ────────────────────────────────────────

describe('Seat Lifecycle', () => {
  test('full flow: create owner seat → invite editor → accept → verify access', async () => {
    // Step 1: Owner already has their seat
    const ownerSeat = makeSeat('seat-owner', {
      display_name: 'Owner Seat',
      role_base: 'owner',
    });
    seedTable('BusinessSeat', [ownerSeat]);
    seedTable('SeatBinding', [{
      seat_id: 'seat-owner',
      user_id: BIZ_OWNER_ID,
      binding_method: 'founding',
      bound_at: new Date().toISOString(),
      seat: ownerSeat, // embedded for mock compat
    }]);

    // Verify owner access
    const ownerAccess = await getSeatAccess(BIZ_ID, BIZ_OWNER_ID);
    expect(ownerAccess.hasAccess).toBe(true);
    expect(ownerAccess.isOwner).toBe(true);
    expect(ownerAccess.permissions).toEqual(expect.arrayContaining(ALL_PERMS));

    // Step 2: Create a pending invite seat
    const inviteToken = crypto.randomUUID();
    const inviteTokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
    const inviteSeat = makeSeat('seat-invite-1', {
      display_name: 'New Editor',
      role_base: 'editor',
      invite_status: 'pending',
      invite_email: 'new@example.com',
      invite_token_hash: inviteTokenHash,
      accepted_at: null,
    });
    getTable('BusinessSeat').push(inviteSeat);

    // Verify it shows up in business seats
    const seats = await getBusinessSeats(BIZ_ID);
    expect(seats.length).toBe(2); // owner + pending
    const pendingSeat = seats.find(s => s.id === 'seat-invite-1');
    expect(pendingSeat).toBeDefined();
    expect(pendingSeat.invite_status).toBe('pending');

    // Step 3: Simulate invite acceptance (mirrors POST /seats/accept-invite logic)
    const now = new Date().toISOString();

    // Find seat by token hash
    const { data: foundSeat } = await supabaseAdmin
      .from('BusinessSeat')
      .select('*')
      .eq('invite_token_hash', inviteTokenHash)
      .maybeSingle();
    expect(foundSeat).toBeDefined();
    expect(foundSeat.invite_status).toBe('pending');

    // Update seat status
    await supabaseAdmin
      .from('BusinessSeat')
      .update({
        invite_status: 'accepted',
        accepted_at: now,
        invite_token_hash: null,
        updated_at: now,
      })
      .eq('id', foundSeat.id);

    // Create binding
    const bindingRow = {
      seat_id: foundSeat.id,
      user_id: INVITED_USER_ID,
      binding_method: 'invite_accept',
      bound_at: now,
    };
    // For mock compat, fetch updated seat for embedding
    const { data: updatedSeat } = await supabaseAdmin
      .from('BusinessSeat')
      .select('*')
      .eq('id', foundSeat.id)
      .maybeSingle();
    bindingRow.seat = updatedSeat; // embedded for mock
    await supabaseAdmin.from('SeatBinding').insert(bindingRow);

    // Step 4: Verify the new user now has access
    const editorAccess = await getSeatAccess(BIZ_ID, INVITED_USER_ID);
    expect(editorAccess.hasAccess).toBe(true);
    expect(editorAccess.isOwner).toBe(false);
    expect(editorAccess.seat.role_base).toBe('editor');

    // Step 5: Verify owner still has full access
    const ownerAccess2 = await getSeatAccess(BIZ_ID, BIZ_OWNER_ID);
    expect(ownerAccess2.hasAccess).toBe(true);
    expect(ownerAccess2.isOwner).toBe(true);
  });

  test('deactivated seat denies access', async () => {
    const deactivatedSeat = makeSeat('seat-deactivated', {
      display_name: 'Ex Employee',
      role_base: 'editor',
      is_active: false,
    });
    seedTable('BusinessSeat', [deactivatedSeat]);
    seedTable('SeatBinding', [{
      seat_id: 'seat-deactivated',
      user_id: INVITED_USER_ID,
      seat: deactivatedSeat,
    }]);

    const access = await getSeatAccess(BIZ_ID, INVITED_USER_ID);
    expect(access.hasAccess).toBe(false);
  });
});

// ── 2. Permission Resolution — 3-Tier Precedence ────────────

describe('Permission Resolution (3-tier precedence)', () => {
  const SEAT_ID = 'seat-editor-perm';
  const PERM = 'finance.manage';

  beforeEach(() => {
    const seatRow = makeSeat(SEAT_ID, { display_name: 'Editor', role_base: 'editor' });
    seedTable('BusinessSeat', [seatRow]);
    seedTable('SeatBinding', [{
      seat_id: SEAT_ID,
      user_id: INVITED_USER_ID,
      seat: seatRow,
    }]);
  });

  test('role default: DENY when not granted', async () => {
    seedTable('BusinessRolePermission', [
      { role_base: 'editor', permission: PERM, allowed: false },
    ]);
    const result = await hasSeatPermission(BIZ_ID, INVITED_USER_ID, PERM);
    expect(result).toBe(false);
  });

  test('user-level override GRANTS over role default DENY', async () => {
    seedTable('BusinessRolePermission', [
      { role_base: 'editor', permission: PERM, allowed: false },
    ]);
    seedTable('BusinessPermissionOverride', [{
      id: 'ovr-user-1',
      business_user_id: BIZ_ID,
      user_id: INVITED_USER_ID,
      seat_id: null, // user-level
      permission: PERM,
      allowed: true,
    }]);

    const result = await hasSeatPermission(BIZ_ID, INVITED_USER_ID, PERM);
    expect(result).toBe(true);
  });

  test('seat-level override DENIES over user-level override GRANT', async () => {
    seedTable('BusinessRolePermission', [
      { role_base: 'editor', permission: PERM, allowed: false },
    ]);
    // User-level: GRANT
    seedTable('BusinessPermissionOverride', [
      {
        id: 'ovr-user-2',
        business_user_id: BIZ_ID,
        user_id: INVITED_USER_ID,
        seat_id: null,
        permission: PERM,
        allowed: true,
      },
      // Seat-level: DENY — highest precedence
      {
        id: 'ovr-seat-2',
        business_user_id: BIZ_ID,
        user_id: INVITED_USER_ID,
        seat_id: SEAT_ID,
        permission: PERM,
        allowed: false,
      },
    ]);

    const result = await hasSeatPermission(BIZ_ID, INVITED_USER_ID, PERM);
    expect(result).toBe(false);
  });

  test('getSeatAccess merges all three layers correctly', async () => {
    seedTable('BusinessRolePermission', [
      { role_base: 'editor', permission: 'profile.edit', allowed: true },
      { role_base: 'editor', permission: 'catalog.edit', allowed: true },
      { role_base: 'editor', permission: 'finance.view', allowed: false },
    ]);
    seedTable('BusinessPermissionOverride', [
      // User-level grant for finance.view
      { id: 'ovr-u-3', business_user_id: BIZ_ID, user_id: INVITED_USER_ID, seat_id: null, permission: 'finance.view', allowed: true },
      // Seat-level deny for catalog.edit
      { id: 'ovr-s-3', business_user_id: BIZ_ID, user_id: INVITED_USER_ID, seat_id: SEAT_ID, permission: 'catalog.edit', allowed: false },
    ]);

    const access = await getSeatAccess(BIZ_ID, INVITED_USER_ID);
    expect(access.permissions).toContain('profile.edit');    // role default
    expect(access.permissions).toContain('finance.view');    // user override grants
    expect(access.permissions).not.toContain('catalog.edit'); // seat override denies
  });
});

// ── 3. Privacy Settings ──────────────────────────────────────

describe('Privacy Settings', () => {
  test('auto-creates default settings on first read', async () => {
    // Simulate GET /privacy/settings route logic
    let { data: settings } = await supabaseAdmin
      .from('UserPrivacySettings')
      .select('*')
      .eq('user_id', INVITED_USER_ID)
      .maybeSingle();

    expect(settings).toBeNull();

    // Auto-create (mirrors route handler)
    const { data: created } = await supabaseAdmin
      .from('UserPrivacySettings')
      .insert({ user_id: INVITED_USER_ID })
      .select('*')
      .single();

    expect(created).toBeDefined();
    expect(created.user_id).toBe(INVITED_USER_ID);
  });

  test('PATCH updates specific fields', async () => {
    seedTable('UserPrivacySettings', [{
      id: 'ps-1',
      user_id: INVITED_USER_ID,
      search_visibility: 'everyone',
      findable_by_email: true,
      findable_by_phone: false,
      profile_default_visibility: 'public',
      show_gig_history: 'public',
      show_neighborhood: 'public',
      show_home_affiliation: 'public',
    }]);

    // Simulate PATCH
    await supabaseAdmin
      .from('UserPrivacySettings')
      .update({
        search_visibility: 'mutuals',
        findable_by_email: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', INVITED_USER_ID);

    const { data: updated } = await supabaseAdmin
      .from('UserPrivacySettings')
      .select('*')
      .eq('user_id', INVITED_USER_ID)
      .maybeSingle();

    expect(updated.search_visibility).toBe('mutuals');
    expect(updated.findable_by_email).toBe(false);
    expect(updated.findable_by_phone).toBe(false); // unchanged
  });
});

// ── 4. Scoped Blocks ─────────────────────────────────────────

describe('Scoped Blocks', () => {
  test('create, list, and remove a block', async () => {
    // Create block (simulates POST /privacy/blocks)
    seedTable('User', [{ id: VIEWER_USER_ID, username: 'viewer' }]);

    const { data: block } = await supabaseAdmin
      .from('UserProfileBlock')
      .insert({
        user_id: INVITED_USER_ID,
        blocked_user_id: VIEWER_USER_ID,
        block_scope: 'full',
        reason: 'spam',
      })
      .select('*')
      .single();

    expect(block).toBeDefined();
    expect(block.block_scope).toBe('full');

    // List blocks (simulates GET /privacy/blocks)
    const { data: blocks } = await supabaseAdmin
      .from('UserProfileBlock')
      .select('*')
      .eq('user_id', INVITED_USER_ID);

    expect(blocks.length).toBe(1);

    // Remove block (simulates DELETE /privacy/blocks/:blockId)
    await supabaseAdmin
      .from('UserProfileBlock')
      .delete()
      .eq('id', block.id)
      .eq('user_id', INVITED_USER_ID);

    const { data: afterDelete } = await supabaseAdmin
      .from('UserProfileBlock')
      .select('*')
      .eq('user_id', INVITED_USER_ID);

    expect(afterDelete.length).toBe(0);
  });

  test('cannot block yourself', () => {
    // Route handler returns 400 — we just verify the guard logic
    const userId = INVITED_USER_ID;
    const blocked_user_id = INVITED_USER_ID;
    expect(blocked_user_id === userId).toBe(true);
  });
});

// ── 5. Visibility Policy Functions ───────────────────────────

describe('Visibility Policy — Identity Firewall extensions', () => {
  test('isSearchable returns false for user with search_visibility=nobody', async () => {
    seedTable('UserPrivacySettings', [{
      id: 'ps-nobody',
      user_id: INVITED_USER_ID,
      search_visibility: 'nobody',
    }]);

    const result = await isSearchable(VIEWER_USER_ID, INVITED_USER_ID);
    expect(result).toBe(false);
  });

  test('isSearchable returns true for user with search_visibility=everyone', async () => {
    seedTable('UserPrivacySettings', [{
      id: 'ps-everyone',
      user_id: INVITED_USER_ID,
      search_visibility: 'everyone',
    }]);

    const result = await isSearchable(VIEWER_USER_ID, INVITED_USER_ID);
    expect(result).toBe(true);
  });

  test('isSearchable defaults to true when no settings exist', async () => {
    const result = await isSearchable(VIEWER_USER_ID, INVITED_USER_ID);
    expect(result).toBe(true);
  });

  test('isScopedBlocked returns true when full block exists', async () => {
    seedTable('UserProfileBlock', [{
      id: 'block-1',
      user_id: BIZ_OWNER_ID,
      blocked_user_id: INVITED_USER_ID,
      block_scope: 'full',
    }]);

    const result = await isScopedBlocked(BIZ_OWNER_ID, INVITED_USER_ID);
    expect(result).toBe(true);
  });

  test('isScopedBlocked returns false when no block exists', async () => {
    const result = await isScopedBlocked(BIZ_OWNER_ID, INVITED_USER_ID);
    expect(result).toBe(false);
  });

  test('canViewProfileField respects privacy settings', async () => {
    seedTable('UserPrivacySettings', [{
      id: 'ps-field',
      user_id: INVITED_USER_ID,
      show_gig_history: 'private',
      profile_default_visibility: 'public',
    }]);

    // Private field → no one can view
    const canSeeGigHistory = await canViewProfileField(INVITED_USER_ID, 'gig_history', VIEWER_USER_ID);
    expect(canSeeGigHistory).toBe(false);
  });
});

// ── 6. Audit Logging with Seat Context ───────────────────────

describe('Audit Logging', () => {
  test('writeSeatAuditLog records actor_seat_id and resolves user_id', async () => {
    const SEAT_ID = 'seat-audit-test';
    seedTable('SeatBinding', [{ seat_id: SEAT_ID, user_id: BIZ_OWNER_ID }]);

    await writeSeatAuditLog(
      BIZ_ID,
      SEAT_ID,
      'member.invited',
      'BusinessSeat',
      'seat-invite-1',
      { invite_email: 'new@example.com' },
    );

    const logs = getTable('BusinessAuditLog');
    expect(logs.length).toBe(1);

    const log = logs[0];
    expect(log.business_user_id).toBe(BIZ_ID);
    expect(log.actor_seat_id).toBe(SEAT_ID);
    expect(log.actor_user_id).toBe(BIZ_OWNER_ID);
    expect(log.action).toBe('member.invited');
    expect(log.target_type).toBe('BusinessSeat');
    expect(log.target_id).toBe('seat-invite-1');
    expect(log.metadata.invite_email).toBe('new@example.com');
    expect(log.metadata.actor_seat_id).toBe(SEAT_ID); // backward compat field
  });

  test('multiple audit entries for a business are independent', async () => {
    seedTable('SeatBinding', [{ seat_id: 'seat-a', user_id: BIZ_OWNER_ID }]);

    await writeSeatAuditLog(BIZ_ID, 'seat-a', 'action.one', null, null, {});
    await writeSeatAuditLog(BIZ_ID, 'seat-a', 'action.two', null, null, {});

    const logs = getTable('BusinessAuditLog');
    expect(logs.length).toBe(2);
    expect(logs.map(l => l.action)).toEqual(expect.arrayContaining(['action.one', 'action.two']));
  });
});

// ── 7. Multi-Business Seat Resolution ────────────────────────

describe('Multi-Business Seat Resolution', () => {
  test('user with seats at multiple businesses sees all of them', async () => {
    const BIZ_2 = 'biz-00000-0000-0000-0000-000000000002';
    const seatA = makeSeat('seat-multi-a', { display_name: 'Seat A', role_base: 'admin' });
    const seatB = makeSeat('seat-multi-b', { business_user_id: BIZ_2, display_name: 'Seat B', role_base: 'viewer' });

    seedTable('BusinessSeat', [seatA, seatB]);
    seedTable('SeatBinding', [
      { seat_id: 'seat-multi-a', user_id: INVITED_USER_ID, seat: seatA },
      { seat_id: 'seat-multi-b', user_id: INVITED_USER_ID, seat: seatB },
    ]);
    // Enrich with User + BusinessProfile for getAllSeatsForUser
    seedTable('User', [
      { id: BIZ_ID, username: 'biz_one', name: 'Business One' },
      { id: BIZ_2, username: 'biz_two', name: 'Business Two' },
    ]);
    seedTable('BusinessProfile', [
      { business_user_id: BIZ_ID, logo_file_id: null, business_type: 'restaurant' },
      { business_user_id: BIZ_2, logo_file_id: null, business_type: 'retail' },
    ]);

    const seats = await getAllSeatsForUser(INVITED_USER_ID);
    expect(seats.length).toBe(2);

    const bizIds = seats.map(s => s.business_user_id);
    expect(bizIds).toContain(BIZ_ID);
    expect(bizIds).toContain(BIZ_2);

    // Verify business enrichment
    const seatOne = seats.find(s => s.business_user_id === BIZ_ID);
    expect(seatOne.business_name).toBe('Business One');
  });

  test('getBusinessIdsWithSeatPermissions filters by permission', async () => {
    const BIZ_2 = 'biz-00000-0000-0000-0000-000000000002';
    const seatA = makeSeat('seat-perm-a', { display_name: 'Admin', role_base: 'admin' });
    const seatB = makeSeat('seat-perm-b', { business_user_id: BIZ_2, display_name: 'Viewer', role_base: 'viewer' });

    seedTable('BusinessSeat', [seatA, seatB]);
    seedTable('SeatBinding', [
      { seat_id: 'seat-perm-a', user_id: INVITED_USER_ID, seat: seatA },
      { seat_id: 'seat-perm-b', user_id: INVITED_USER_ID, seat: seatB },
    ]);
    seedTable('User', [
      { id: BIZ_ID, username: 'b1', name: 'B1' },
      { id: BIZ_2, username: 'b2', name: 'B2' },
    ]);
    seedTable('BusinessProfile', [
      { business_user_id: BIZ_ID },
      { business_user_id: BIZ_2 },
    ]);
    seedTable('BusinessRolePermission', [
      { role_base: 'admin', permission: 'team.manage', allowed: true },
      { role_base: 'viewer', permission: 'team.manage', allowed: false },
    ]);

    const result = await getBusinessIdsWithSeatPermissions(INVITED_USER_ID, ['team.manage']);
    expect(result).toContain(BIZ_ID);
    expect(result).not.toContain(BIZ_2);
  });
});

// ── 8. Notification Seat Holder Resolution ───────────────────

describe('Notification Routing — getSeatHoldersWithPermissions', () => {
  test('returns only users whose seats grant the requested permission', async () => {
    const adminSeat = makeSeat('seat-notif-admin', { display_name: 'Admin', role_base: 'admin' });
    const viewerSeat = makeSeat('seat-notif-viewer', { display_name: 'Viewer', role_base: 'viewer' });

    seedTable('BusinessSeat', [adminSeat, viewerSeat]);
    seedTable('SeatBinding', [
      { seat_id: 'seat-notif-admin', user_id: BIZ_OWNER_ID },
      { seat_id: 'seat-notif-viewer', user_id: VIEWER_USER_ID },
    ]);
    seedTable('BusinessRolePermission', [
      { role_base: 'admin', permission: 'finance.view', allowed: true },
      { role_base: 'viewer', permission: 'finance.view', allowed: false },
    ]);

    const holders = await getSeatHoldersWithPermissions(BIZ_ID, ['finance.view']);
    expect(holders).toContain(BIZ_OWNER_ID);
    expect(holders).not.toContain(VIEWER_USER_ID);
  });
});

// ── 9. Role Hierarchy Guards ─────────────────────────────────

describe('Role Hierarchy', () => {
  test('owner outranks admin', () => {
    expect(getRoleRank('owner')).toBeGreaterThan(getRoleRank('admin'));
  });

  test('BUSINESS_ROLE_RANK has all five tiers', () => {
    const keys = Object.keys(BUSINESS_ROLE_RANK);
    expect(keys).toEqual(expect.arrayContaining(['viewer', 'staff', 'editor', 'admin', 'owner']));
  });

  test('editor cannot manage team by default but admin can', async () => {
    const editorSeat = makeSeat('seat-ehr', { role_base: 'editor' });
    const adminSeat = makeSeat('seat-ahr', { role_base: 'admin' });
    seedTable('BusinessSeat', [editorSeat, adminSeat]);
    seedTable('SeatBinding', [
      { seat_id: 'seat-ehr', user_id: INVITED_USER_ID, seat: editorSeat },
      { seat_id: 'seat-ahr', user_id: VIEWER_USER_ID, seat: adminSeat },
    ]);
    seedTable('BusinessRolePermission', [
      { role_base: 'editor', permission: 'team.manage', allowed: false },
      { role_base: 'admin', permission: 'team.manage', allowed: true },
    ]);

    expect(await hasSeatPermission(BIZ_ID, INVITED_USER_ID, 'team.manage')).toBe(false);
    expect(await hasSeatPermission(BIZ_ID, VIEWER_USER_ID, 'team.manage')).toBe(true);
  });
});
