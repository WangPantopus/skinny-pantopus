/**
 * Lifecycle regression tests (audit 2026-08-22).
 *
 * These cover the "who still has access after they leave" class of findings,
 * which had no coverage at all before.
 */

const { resetTables, getTable, seedTable } = require('../__mocks__/supabaseAdmin');

jest.mock('../../utils/homePermissions', () => {
  const actual = jest.requireActual('../../utils/homePermissions');
  return { ...actual, writeAuditLog: jest.fn().mockResolvedValue(undefined) };
});

const occupancyAttachService = require('../../services/occupancyAttachService');

beforeEach(() => resetTables());

function seedHomeWithOwner(ownerId = 'user-owner') {
  seedTable('Home', [{ id: 'home-1', owner_id: ownerId, name: 'Test Home' }]);
  seedTable('HomeOccupancy', [{
    id: 'occ-1',
    home_id: 'home-1',
    user_id: ownerId,
    is_active: true,
    role: 'owner',
    role_base: 'owner',
    verification_status: 'verified',
  }]);
}

describe('LIF-01 — moving out revokes legacy ownership', () => {
  test('detach clears Home.owner_id when the departing user is the owner', async () => {
    seedHomeWithOwner('user-owner');

    const res = await occupancyAttachService.detach({
      homeId: 'home-1',
      userId: 'user-owner',
      reason: 'move_out',
      actorId: 'user-owner',
    });

    expect(res.success).toBe(true);

    const home = getTable('Home').find((h) => h.id === 'home-1');
    // Left set, checkHomePermission's isLegacyOwner branch would keep granting
    // this user full control of a home they no longer live in.
    expect(home.owner_id).toBeNull();
  });

  test('detach leaves owner_id alone when someone else moves out', async () => {
    seedHomeWithOwner('user-owner');
    seedTable('HomeOccupancy', [
      ...getTable('HomeOccupancy'),
      {
        id: 'occ-2',
        home_id: 'home-1',
        user_id: 'user-roommate',
        is_active: true,
        role: 'member',
        role_base: 'member',
        verification_status: 'verified',
      },
    ]);

    const res = await occupancyAttachService.detach({
      homeId: 'home-1',
      userId: 'user-roommate',
      reason: 'move_out',
      actorId: 'user-roommate',
    });

    expect(res.success).toBe(true);
    const home = getTable('Home').find((h) => h.id === 'home-1');
    expect(home.owner_id).toBe('user-owner');
  });

  test('the occupancy is deactivated, not deleted, so residency history survives', async () => {
    seedHomeWithOwner('user-owner');

    await occupancyAttachService.detach({
      homeId: 'home-1',
      userId: 'user-owner',
      reason: 'move_out',
      actorId: 'user-owner',
    });

    const occ = getTable('HomeOccupancy').find((o) => o.id === 'occ-1');
    expect(occ).toBeDefined();
    expect(occ.is_active).toBe(false);
    expect(occ.verification_status).toBe('moved_out');
    expect(occ.end_at).toBeTruthy();
  });
});

describe('CRIT-03 — household mail access has exactly one definition', () => {
  const fs = require('fs');
  const path = require('path');
  const routesDir = path.join(__dirname, '../../routes');

  test('no route file defines its own getAccessibleHomeIds', () => {
    // Four copies filtered is_active; the fifth (mailbox.js) did not, so a
    // moved-out roommate kept reading the household's physical mail there.
    const offenders = fs.readdirSync(routesDir)
      .filter((f) => f.endsWith('.js'))
      .filter((f) => {
        const src = fs.readFileSync(path.join(routesDir, f), 'utf8');
        return /(?:async\s+function|const)\s+getAccessibleHomeIds\s*(?:\(|=)/.test(src);
      });

    expect(offenders).toEqual([]);
  });

  test('the shared helper requires an active, trusted occupancy', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../utils/homeMailAccess.js'), 'utf8',
    );
    expect(src).toContain("eq('is_active', true)");
    expect(src).toContain("in('verification_status'");
    // and must not re-admit the legacy owner_id leg
    expect(src).not.toContain("eq('owner_id'");
  });

  test('the per-item gate on mailbox.js uses the shared helper', () => {
    // The list path was consolidated but canAccessMail kept its own query,
    // which matched any HomeOccupancy row for the home — no is_active filter
    // and no verification_status filter — on eight per-item routes.
    const src = fs.readFileSync(path.join(routesDir, 'mailbox.js'), 'utf8');
    const gate = src.slice(src.indexOf('const canAccessMail'));
    expect(gate.slice(0, 600)).toContain('getAccessibleHomeIds');
  });
});

describe('CRIT-03 — the shared helper fails closed', () => {
  const { getAccessibleHomeIds } = require('../../utils/homeMailAccess');

  test('returns nothing for a user with only an inactive occupancy', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-x',
      home_id: 'home-9',
      user_id: 'moved-out',
      is_active: false,
      verification_status: 'moved_out',
    }]);
    await expect(getAccessibleHomeIds('moved-out')).resolves.toEqual([]);
  });

  test('returns the home for an active, verified occupant', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-y',
      home_id: 'home-9',
      user_id: 'resident',
      is_active: true,
      verification_status: 'verified',
    }]);
    await expect(getAccessibleHomeIds('resident')).resolves.toEqual(['home-9']);
  });

  test('returns the home for the creator, whose status is provisional_bootstrap', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-z',
      home_id: 'home-9',
      user_id: 'creator',
      is_active: true,
      verification_status: 'provisional_bootstrap',
    }]);
    await expect(getAccessibleHomeIds('creator')).resolves.toEqual(['home-9']);
  });

  // applyOccupancyTemplate writes is_active: true for pending rows, and
  // POST /api/homes/:id/claim creates one for any authenticated caller on any
  // home id. Filtering on is_active alone therefore handed an unapproved
  // stranger the household's scanned envelopes and sender identities.
  test.each([
    ['pending_approval'],
    ['pending_postcard'],
    ['pending_doc'],
    ['unverified'],
  ])('returns nothing for an active but %s occupancy', async (status) => {
    seedTable('HomeOccupancy', [{
      id: `occ-${status}`,
      home_id: 'home-9',
      user_id: 'claimant',
      is_active: true,
      verification_status: status,
    }]);
    await expect(getAccessibleHomeIds('claimant')).resolves.toEqual([]);
  });

  test('returns nothing for a missing user id', async () => {
    await expect(getAccessibleHomeIds(null)).resolves.toEqual([]);
  });
});
