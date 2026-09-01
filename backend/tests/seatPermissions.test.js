// ============================================================
// TEST: Seat Permission Engine (Identity Firewall)
// Validates seat-based permission resolution: owner all-access,
// role defaults, seat-level overrides, user-level overrides,
// seat lookup, multi-business resolution, and audit logging.
// ============================================================

// moduleNameMapper in jest.config.js already redirects
// ../config/supabaseAdmin → tests/__mocks__/supabaseAdmin.js
// ../utils/logger         → tests/__mocks__/logger.js

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const {
  getSeatForUser,
  hasSeatPermission,
  getSeatAccess,
  getAllSeatsForUser,
  getBusinessSeats,
  getBusinessIdsWithSeatPermissions,
  getSeatHoldersWithPermissions,
  getRoleRank,
  writeSeatAuditLog,
  BUSINESS_ROLE_RANK,
  ALL_PERMS,
} = require('../utils/seatPermissions');

beforeEach(() => resetTables());

// ── Constants ────────────────────────────────────────────────

const BIZ_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000010';
const USER_ID_2 = '00000000-0000-0000-0000-000000000020';
const SEAT_ID = '00000000-0000-0000-0000-000000000100';
const SEAT_ID_2 = '00000000-0000-0000-0000-000000000200';
const SEAT_ID_OWNER = '00000000-0000-0000-0000-000000000300';

/**
 * The mock doesn't support nested selects (e.g. `seat:seat_id (...)`).
 * We embed the nested `seat` object directly in SeatBinding rows so that
 * getSeatForUser receives the shape it expects from the mock's raw return.
 */
function makeSeatRow(id, overrides = {}) {
  return {
    id,
    business_user_id: overrides.business_user_id || BIZ_ID,
    display_name: overrides.display_name || 'Seat',
    display_avatar_file_id: null,
    role_base: overrides.role_base || 'editor',
    contact_method: null,
    is_active: overrides.is_active !== undefined ? overrides.is_active : true,
    invite_status: overrides.invite_status || 'accepted',
    accepted_at: new Date().toISOString(),
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function seedOwnerSeat() {
  const seatRow = makeSeatRow(SEAT_ID_OWNER, { display_name: 'Boss', role_base: 'owner' });
  seedTable('BusinessSeat', [seatRow]);
  seedTable('SeatBinding', [{
    seat_id: SEAT_ID_OWNER,
    user_id: USER_ID,
    bound_at: new Date().toISOString(),
    seat: seatRow, // embedded for nested-select mock compat
  }]);
}

function seedEditorSeat() {
  const seatRow = makeSeatRow(SEAT_ID, { display_name: 'Editor Seat', role_base: 'editor' });
  seedTable('BusinessSeat', [seatRow]);
  seedTable('SeatBinding', [{
    seat_id: SEAT_ID,
    user_id: USER_ID,
    bound_at: new Date().toISOString(),
    seat: seatRow,
  }]);
}

// ── getRoleRank ──────────────────────────────────────────────

describe('getRoleRank', () => {
  test('ranks are in correct order', () => {
    expect(getRoleRank('viewer')).toBeLessThan(getRoleRank('staff'));
    expect(getRoleRank('staff')).toBeLessThan(getRoleRank('editor'));
    expect(getRoleRank('editor')).toBeLessThan(getRoleRank('admin'));
    expect(getRoleRank('admin')).toBeLessThan(getRoleRank('owner'));
  });

  test('unknown role returns 0', () => {
    expect(getRoleRank('banana')).toBe(0);
  });

  test('owner returns highest rank', () => {
    expect(getRoleRank('owner')).toBe(50);
  });
});

// ── ALL_PERMS ────────────────────────────────────────────────

describe('ALL_PERMS', () => {
  test('contains expected permissions', () => {
    expect(ALL_PERMS).toContain('team.manage');
    expect(ALL_PERMS).toContain('profile.edit');
    expect(ALL_PERMS).toContain('gigs.post');
    expect(ALL_PERMS.length).toBeGreaterThan(10);
  });
});

// ── getSeatForUser ───────────────────────────────────────────

describe('getSeatForUser', () => {
  test('returns seat for a bound user', async () => {
    seedEditorSeat();
    const seat = await getSeatForUser(BIZ_ID, USER_ID);
    expect(seat).toBeDefined();
    expect(seat.id).toBe(SEAT_ID);
    expect(seat.role_base).toBe('editor');
    expect(seat.display_name).toBe('Editor Seat');
  });

  test('returns null for unknown user', async () => {
    seedEditorSeat();
    const seat = await getSeatForUser(BIZ_ID, USER_ID_2);
    expect(seat).toBeNull();
  });

  test('returns null for inactive seat', async () => {
    const seatRow = makeSeatRow(SEAT_ID, { display_name: 'Deactivated', is_active: false });
    seedTable('BusinessSeat', [seatRow]);
    seedTable('SeatBinding', [{ seat_id: SEAT_ID, user_id: USER_ID, seat: seatRow }]);

    const seat = await getSeatForUser(BIZ_ID, USER_ID);
    expect(seat).toBeNull();
  });
});

// ── hasSeatPermission ────────────────────────────────────────

describe('hasSeatPermission', () => {
  test('owner has all permissions', async () => {
    seedOwnerSeat();
    const result = await hasSeatPermission(BIZ_ID, USER_ID, 'team.manage');
    expect(result).toBe(true);
  });

  test('returns false for user without seat', async () => {
    const result = await hasSeatPermission(BIZ_ID, USER_ID, 'team.manage');
    expect(result).toBe(false);
  });

  test('uses role default when no override exists', async () => {
    seedEditorSeat();
    seedTable('BusinessRolePermission', [
      { role_base: 'editor', permission: 'post.create', allowed: true },
      { role_base: 'editor', permission: 'team.manage', allowed: false },
    ]);

    expect(await hasSeatPermission(BIZ_ID, USER_ID, 'post.create')).toBe(true);
    expect(await hasSeatPermission(BIZ_ID, USER_ID, 'team.manage')).toBe(false);
  });

  test('seat-level override takes precedence over role default', async () => {
    seedEditorSeat();
    seedTable('BusinessRolePermission', [
      { role_base: 'editor', permission: 'team.manage', allowed: false },
    ]);
    seedTable('BusinessPermissionOverride', [{
      id: '11111111-1111-1111-1111-111111111111',
      business_user_id: BIZ_ID,
      seat_id: SEAT_ID,
      user_id: USER_ID,
      permission: 'team.manage',
      allowed: true,
    }]);

    const result = await hasSeatPermission(BIZ_ID, USER_ID, 'team.manage');
    expect(result).toBe(true);
  });

  test('user-level override used as fallback when no seat override', async () => {
    seedEditorSeat();
    seedTable('BusinessRolePermission', [
      { role_base: 'editor', permission: 'team.manage', allowed: false },
    ]);
    // Legacy user-level override (seat_id is null)
    seedTable('BusinessPermissionOverride', [{
      id: '22222222-2222-2222-2222-222222222222',
      business_user_id: BIZ_ID,
      seat_id: null,
      user_id: USER_ID,
      permission: 'team.manage',
      allowed: true,
    }]);

    const result = await hasSeatPermission(BIZ_ID, USER_ID, 'team.manage');
    expect(result).toBe(true);
  });
});

// ── getSeatAccess ────────────────────────────────────────────

describe('getSeatAccess', () => {
  test('owner gets all permissions', async () => {
    seedOwnerSeat();
    const access = await getSeatAccess(BIZ_ID, USER_ID);
    expect(access.hasAccess).toBe(true);
    expect(access.isOwner).toBe(true);
    expect(access.permissions).toEqual(expect.arrayContaining(['team.manage', 'profile.edit']));
    expect(access.seat).toBeDefined();
  });

  test('returns no access for missing user', async () => {
    const access = await getSeatAccess(BIZ_ID, USER_ID);
    expect(access.hasAccess).toBe(false);
    expect(access.seat).toBeNull();
    expect(access.permissions).toEqual([]);
  });

  test('merges role defaults + overrides', async () => {
    seedEditorSeat();
    seedTable('BusinessRolePermission', [
      { role_base: 'editor', permission: 'post.create', allowed: true },
      { role_base: 'editor', permission: 'post.delete', allowed: true },
    ]);
    // Override: grant team.manage, deny post.delete
    seedTable('BusinessPermissionOverride', [
      { id: '33333333-0000-0000-0000-000000000001', business_user_id: BIZ_ID, seat_id: SEAT_ID, user_id: USER_ID, permission: 'team.manage', allowed: true },
      { id: '33333333-0000-0000-0000-000000000002', business_user_id: BIZ_ID, seat_id: SEAT_ID, user_id: USER_ID, permission: 'post.delete', allowed: false },
    ]);

    const access = await getSeatAccess(BIZ_ID, USER_ID);
    expect(access.hasAccess).toBe(true);
    expect(access.isOwner).toBe(false);
    expect(access.permissions).toContain('post.create');
    expect(access.permissions).toContain('team.manage');
    expect(access.permissions).not.toContain('post.delete');
  });
});

// ── getAllSeatsForUser ────────────────────────────────────────

describe('getAllSeatsForUser', () => {
  test('returns all seats across businesses', async () => {
    const BIZ_2 = '00000000-0000-0000-0000-000000000002';
    const seatA = makeSeatRow(SEAT_ID, { display_name: 'Seat A', role_base: 'editor' });
    const seatB = makeSeatRow(SEAT_ID_2, { business_user_id: BIZ_2, display_name: 'Seat B', role_base: 'viewer' });
    seedTable('SeatBinding', [
      { seat_id: SEAT_ID, user_id: USER_ID, bound_at: new Date().toISOString(), seat: seatA },
      { seat_id: SEAT_ID_2, user_id: USER_ID, bound_at: new Date().toISOString(), seat: seatB },
    ]);
    seedTable('BusinessSeat', [seatA, seatB]);

    const seats = await getAllSeatsForUser(USER_ID);
    expect(seats.length).toBe(2);
  });

  test('returns empty for user with no seats', async () => {
    const seats = await getAllSeatsForUser(USER_ID);
    expect(seats).toEqual([]);
  });
});

// ── getBusinessSeats ─────────────────────────────────────────

describe('getBusinessSeats', () => {
  test('returns only active seats for a business', async () => {
    seedTable('BusinessSeat', [
      makeSeatRow(SEAT_ID, { display_name: 'Active', role_base: 'editor' }),
      makeSeatRow(SEAT_ID_2, { display_name: 'Inactive', role_base: 'viewer', is_active: false }),
    ]);

    const seats = await getBusinessSeats(BIZ_ID);
    expect(seats.length).toBe(1);
    expect(seats[0].display_name).toBe('Active');
  });
});

// ── writeSeatAuditLog ────────────────────────────────────────

describe('writeSeatAuditLog', () => {
  test('writes audit entry with actor_seat_id', async () => {
    seedTable('SeatBinding', [{ seat_id: SEAT_ID, user_id: USER_ID }]);

    await writeSeatAuditLog(BIZ_ID, SEAT_ID, 'test_action', 'seat', SEAT_ID_2, { extra: 'data' });

    const { getTable } = require('./__mocks__/supabaseAdmin');
    const logs = getTable('BusinessAuditLog');
    expect(logs.length).toBe(1);
    expect(logs[0].actor_seat_id).toBe(SEAT_ID);
    expect(logs[0].actor_user_id).toBe(USER_ID);
    expect(logs[0].action).toBe('test_action');
    expect(logs[0].metadata.extra).toBe('data');
    expect(logs[0].metadata.actor_seat_id).toBe(SEAT_ID);
  });

  test('handles missing binding gracefully', async () => {
    // No binding seeded — actorUserId will be the fallback UUID
    await writeSeatAuditLog(BIZ_ID, SEAT_ID, 'orphan_action', null, null, {});

    const { getTable } = require('./__mocks__/supabaseAdmin');
    const logs = getTable('BusinessAuditLog');
    expect(logs.length).toBe(1);
    expect(logs[0].actor_user_id).toBe('00000000-0000-0000-0000-000000000000');
  });
});

// ── getBusinessIdsWithSeatPermissions ────────────────────────

describe('getBusinessIdsWithSeatPermissions', () => {
  test('returns biz IDs where user has the requested permission', async () => {
    const BIZ_2 = '00000000-0000-0000-0000-000000000002';
    const seatA = makeSeatRow(SEAT_ID, { display_name: 'A', role_base: 'editor' });
    const seatB = makeSeatRow(SEAT_ID_2, { business_user_id: BIZ_2, display_name: 'B', role_base: 'viewer' });
    seedTable('SeatBinding', [
      { seat_id: SEAT_ID, user_id: USER_ID, bound_at: new Date().toISOString(), seat: seatA },
      { seat_id: SEAT_ID_2, user_id: USER_ID, bound_at: new Date().toISOString(), seat: seatB },
    ]);
    seedTable('BusinessSeat', [seatA, seatB]);
    seedTable('BusinessRolePermission', [
      { role_base: 'editor', permission: 'post.create', allowed: true },
      { role_base: 'viewer', permission: 'post.create', allowed: false },
    ]);

    const result = await getBusinessIdsWithSeatPermissions(USER_ID, ['post.create']);
    expect(result).toContain(BIZ_ID);
    expect(result).not.toContain(BIZ_2);
  });

  test('owner always included', async () => {
    const seatOwner = makeSeatRow(SEAT_ID_OWNER, { display_name: 'Owner', role_base: 'owner' });
    seedTable('SeatBinding', [{ seat_id: SEAT_ID_OWNER, user_id: USER_ID, seat: seatOwner }]);
    seedTable('BusinessSeat', [seatOwner]);

    const result = await getBusinessIdsWithSeatPermissions(USER_ID, ['team.manage']);
    expect(result).toContain(BIZ_ID);
  });
});

// ── getSeatHoldersWithPermissions ────────────────────────────

describe('getSeatHoldersWithPermissions', () => {
  test('returns user IDs of seat holders with the permission', async () => {
    const seatEditor = makeSeatRow(SEAT_ID, { display_name: 'Editor', role_base: 'editor' });
    const seatViewer = makeSeatRow(SEAT_ID_2, { display_name: 'Viewer', role_base: 'viewer' });
    seedTable('BusinessSeat', [seatEditor, seatViewer]);
    seedTable('SeatBinding', [
      { seat_id: SEAT_ID, user_id: USER_ID, seat: seatEditor },
      { seat_id: SEAT_ID_2, user_id: USER_ID_2, seat: seatViewer },
    ]);
    seedTable('BusinessRolePermission', [
      { role_base: 'editor', permission: 'team.manage', allowed: true },
      { role_base: 'viewer', permission: 'team.manage', allowed: false },
    ]);

    const result = await getSeatHoldersWithPermissions(BIZ_ID, ['team.manage']);
    expect(result).toContain(USER_ID);
    expect(result).not.toContain(USER_ID_2);
  });

  test('excludes specified user ID', async () => {
    const seatOwner = makeSeatRow(SEAT_ID_OWNER, { display_name: 'Owner', role_base: 'owner' });
    seedTable('BusinessSeat', [seatOwner]);
    seedTable('SeatBinding', [{ seat_id: SEAT_ID_OWNER, user_id: USER_ID, seat: seatOwner }]);

    const result = await getSeatHoldersWithPermissions(BIZ_ID, ['team.manage'], USER_ID);
    expect(result).not.toContain(USER_ID);
  });
});
