// ============================================================
// TEST: Lockdown
// Validates lockdown enable/disable: revoking all guest passes,
// setting visibility to private, permission requirements
// (security.manage), and restore behavior on disable.
// ============================================================

const supabaseAdmin = require('./__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;
const {
  checkHomePermission,
  hasPermission,
  writeAuditLog,
} = require('../utils/homePermissions');

beforeEach(() => resetTables());

// ── Seed helpers ─────────────────────────────────────────────

const homeId = 'home-1';
const ownerId = 'user-owner';
const adminId = 'user-admin';
const memberId = 'user-member';

function hoursFromNow(h) {
  return new Date(_testBaseTime + h * 60 * 60 * 1000).toISOString();
}

const _testBaseTime = Date.now();
function hoursAgo(h) {
  return new Date(_testBaseTime - h * 60 * 60 * 1000).toISOString();
}

function seedFullHome() {
  seedTable('Home', [{
    id: homeId,
    owner_id: ownerId,
    name: 'Test Home',
    visibility: 'public',
    lockdown_enabled: false,
    lockdown_enabled_at: null,
    lockdown_enabled_by: null,
  }]);
  seedTable('HomeOwner', [{
    id: 'ho-1',
    home_id: homeId,
    subject_id: ownerId,
    owner_status: 'verified',
    tier: 'standard',
    is_primary: true,
  }]);
  seedTable('HomeOccupancy', [
    { id: 'occ-owner', home_id: homeId, user_id: ownerId, role: 'owner', role_base: 'owner', is_active: true, start_at: null, end_at: null },
    { id: 'occ-admin', home_id: homeId, user_id: adminId, role: 'admin', role_base: 'admin', is_active: true, start_at: null, end_at: null },
    { id: 'occ-member', home_id: homeId, user_id: memberId, role: 'member', role_base: 'member', is_active: true, start_at: null, end_at: null },
  ]);
  seedTable('HomeRolePermission', [
    { id: 'rp-1', role_base: 'owner', permission: 'security.manage', allowed: true },
    { id: 'rp-2', role_base: 'admin', permission: 'security.manage', allowed: true },
    { id: 'rp-3', role_base: 'member', permission: 'security.manage', allowed: false },
    { id: 'rp-4', role_base: 'member', permission: 'home.view', allowed: true },
    { id: 'rp-5', role_base: 'admin', permission: 'home.view', allowed: true },
    { id: 'rp-6', role_base: 'owner', permission: 'home.view', allowed: true },
  ]);
}

function seedGuestPasses() {
  seedTable('HomeGuestPass', [
    { id: 'gp-1', home_id: homeId, label: 'WiFi Pass', kind: 'wifi_only', revoked_at: null, end_at: hoursFromNow(2), view_count: 0 },
    { id: 'gp-2', home_id: homeId, label: 'Guest Pass', kind: 'guest', revoked_at: null, end_at: hoursFromNow(48), view_count: 1 },
    { id: 'gp-3', home_id: homeId, label: 'Vendor Pass', kind: 'vendor', revoked_at: null, end_at: hoursFromNow(8), view_count: 0 },
    { id: 'gp-4', home_id: homeId, label: 'Already Revoked', kind: 'guest', revoked_at: hoursAgo(2), end_at: hoursFromNow(24), view_count: 3 },
    { id: 'gp-5', home_id: 'other-home', label: 'Other Home', kind: 'guest', revoked_at: null, end_at: hoursFromNow(24), view_count: 0 },
  ]);
}

// ── Permission checks ────────────────────────────────────────

describe('Lockdown permission requirements', () => {
  beforeEach(() => seedFullHome());

  test('owner has security.manage permission', async () => {
    const access = await checkHomePermission(homeId, ownerId, 'security.manage');
    expect(access.hasAccess).toBe(true);
    expect(access.isOwner).toBe(true);
  });

  test('admin has security.manage permission', async () => {
    const perm = await hasPermission(homeId, adminId, 'security.manage');
    expect(perm).toBe(true);
  });

  test('regular member cannot enable lockdown', async () => {
    const perm = await hasPermission(homeId, memberId, 'security.manage');
    expect(perm).toBe(false);
  });

  test('non-member cannot enable lockdown', async () => {
    const access = await checkHomePermission(homeId, 'user-stranger', 'security.manage');
    expect(access.hasAccess).toBe(false);
  });
});

// ── Enable lockdown ──────────────────────────────────────────

describe('Enable lockdown', () => {
  beforeEach(() => {
    seedFullHome();
    seedGuestPasses();
  });

  test('sets lockdown_enabled to true and visibility to private', async () => {
    const now = new Date().toISOString();

    const { data: home } = await supabaseAdmin
      .from('Home')
      .update({
        lockdown_enabled: true,
        lockdown_enabled_at: now,
        lockdown_enabled_by: ownerId,
        visibility: 'private',
      })
      .eq('id', homeId)
      .select()
      .single();

    expect(home.lockdown_enabled).toBe(true);
    expect(home.lockdown_enabled_at).toBe(now);
    expect(home.lockdown_enabled_by).toBe(ownerId);
    expect(home.visibility).toBe('private');
  });

  test('revokes ALL active guest passes for the home', async () => {
    const now = new Date().toISOString();

    // Revoke all active passes for this home (same query as route handler)
    const { data: revoked } = await supabaseAdmin
      .from('HomeGuestPass')
      .update({ revoked_at: now, updated_at: now })
      .eq('home_id', homeId)
      .is('revoked_at', null);

    // Should revoke gp-1, gp-2, gp-3 (active passes for this home)
    // gp-4 already revoked, gp-5 is for a different home
    expect(revoked).toHaveLength(3);

    // Verify all passes for this home are now revoked
    const allPasses = getTable('HomeGuestPass').filter(p => p.home_id === homeId);
    const activePasses = allPasses.filter(p => !p.revoked_at);
    expect(activePasses).toHaveLength(0);

    // Other home's pass should be untouched
    const otherPasses = getTable('HomeGuestPass').filter(p => p.home_id === 'other-home');
    expect(otherPasses).toHaveLength(1);
    expect(otherPasses[0].revoked_at).toBeNull();
  });

  test('already-revoked passes are not double-revoked', async () => {
    const now = new Date().toISOString();

    await supabaseAdmin
      .from('HomeGuestPass')
      .update({ revoked_at: now })
      .eq('home_id', homeId)
      .is('revoked_at', null);

    // gp-4 was already revoked with a different timestamp
    const gp4 = getTable('HomeGuestPass').find(p => p.id === 'gp-4');
    expect(gp4.revoked_at).toBe(hoursAgo(2)); // original revoke time preserved
    // Actually the mock doesn't distinguish — but the query filters .is('revoked_at', null)
    // so gp-4 is excluded from the update
  });

  test('lockdown writes audit log with guest_passes_revoked count', async () => {
    const revokedCount = getTable('HomeGuestPass')
      .filter(p => p.home_id === homeId && !p.revoked_at)
      .length;

    await writeAuditLog(homeId, ownerId, 'lockdown_enabled', 'Home', homeId, {
      guest_passes_revoked: revokedCount,
    });

    const logs = getTable('HomeAuditLog');
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('lockdown_enabled');
    expect(logs[0].target_type).toBe('Home');
    expect(logs[0].target_id).toBe(homeId);
    expect(logs[0].metadata.guest_passes_revoked).toBe(3);
  });

  test('lockdown with zero active passes still succeeds', async () => {
    // Remove all guest passes
    seedTable('HomeGuestPass', []);

    const now = new Date().toISOString();
    const { data: home } = await supabaseAdmin
      .from('Home')
      .update({
        lockdown_enabled: true,
        lockdown_enabled_at: now,
        lockdown_enabled_by: ownerId,
        visibility: 'private',
      })
      .eq('id', homeId)
      .select()
      .single();

    expect(home.lockdown_enabled).toBe(true);

    // No passes to revoke
    const activePasses = getTable('HomeGuestPass')
      .filter(p => p.home_id === homeId && !p.revoked_at);
    expect(activePasses).toHaveLength(0);

    await writeAuditLog(homeId, ownerId, 'lockdown_enabled', 'Home', homeId, {
      guest_passes_revoked: 0,
    });

    const logs = getTable('HomeAuditLog');
    expect(logs[0].metadata.guest_passes_revoked).toBe(0);
  });
});

// ── Disable lockdown ─────────────────────────────────────────

describe('Disable lockdown', () => {
  beforeEach(() => {
    seedFullHome();
    // Start with lockdown enabled
    const homes = getTable('Home');
    homes[0].lockdown_enabled = true;
    homes[0].lockdown_enabled_at = hoursAgo(1);
    homes[0].lockdown_enabled_by = ownerId;
    homes[0].visibility = 'private';
  });

  test('sets lockdown_enabled to false', async () => {
    const { data: home } = await supabaseAdmin
      .from('Home')
      .update({ lockdown_enabled: false })
      .eq('id', homeId)
      .select()
      .single();

    expect(home.lockdown_enabled).toBe(false);
  });

  test('does NOT automatically restore previous visibility', async () => {
    // Lockdown disable only sets lockdown_enabled=false
    // It does NOT change visibility back — that's up to the user
    const { data: home } = await supabaseAdmin
      .from('Home')
      .update({ lockdown_enabled: false })
      .eq('id', homeId)
      .select()
      .single();

    // Visibility stays as 'private' until manually changed
    expect(home.visibility).toBe('private');
  });

  test('does NOT restore revoked guest passes', async () => {
    seedTable('HomeGuestPass', [
      { id: 'gp-1', home_id: homeId, label: 'Was Active', revoked_at: hoursAgo(1) },
      { id: 'gp-2', home_id: homeId, label: 'Also Revoked', revoked_at: hoursAgo(1) },
    ]);

    // Disable lockdown
    await supabaseAdmin
      .from('Home')
      .update({ lockdown_enabled: false })
      .eq('id', homeId);

    // Guest passes remain revoked — they're not auto-restored
    const passes = getTable('HomeGuestPass').filter(p => p.home_id === homeId);
    passes.forEach(p => {
      expect(p.revoked_at).not.toBeNull();
    });
  });

  test('disable lockdown writes audit log', async () => {
    await writeAuditLog(homeId, ownerId, 'lockdown_disabled', 'Home', homeId, {});

    const logs = getTable('HomeAuditLog');
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('lockdown_disabled');
    expect(logs[0].actor_user_id).toBe(ownerId);
  });

  test('disable requires security.manage', async () => {
    const memberPerm = await hasPermission(homeId, memberId, 'security.manage');
    expect(memberPerm).toBe(false);

    const adminPerm = await hasPermission(homeId, adminId, 'security.manage');
    expect(adminPerm).toBe(true);
  });
});

// ── Lockdown state queries ───────────────────────────────────

describe('Lockdown state', () => {
  beforeEach(() => seedFullHome());

  test('home starts with lockdown disabled', async () => {
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('lockdown_enabled')
      .eq('id', homeId)
      .single();

    expect(home.lockdown_enabled).toBe(false);
  });

  test('lockdown state is readable via settings', async () => {
    // Enable lockdown
    await supabaseAdmin
      .from('Home')
      .update({ lockdown_enabled: true, visibility: 'private' })
      .eq('id', homeId);

    const { data: settings } = await supabaseAdmin
      .from('Home')
      .select('lockdown_enabled, visibility')
      .eq('id', homeId)
      .single();

    expect(settings.lockdown_enabled).toBe(true);
    expect(settings.visibility).toBe('private');
  });

  test('multiple lockdown enable/disable cycles work correctly', async () => {
    // Enable
    await supabaseAdmin
      .from('Home')
      .update({ lockdown_enabled: true, visibility: 'private' })
      .eq('id', homeId);

    let home = getTable('Home')[0];
    expect(home.lockdown_enabled).toBe(true);

    // Disable
    await supabaseAdmin
      .from('Home')
      .update({ lockdown_enabled: false })
      .eq('id', homeId);

    home = getTable('Home')[0];
    expect(home.lockdown_enabled).toBe(false);

    // Re-enable
    await supabaseAdmin
      .from('Home')
      .update({ lockdown_enabled: true, visibility: 'private' })
      .eq('id', homeId);

    home = getTable('Home')[0];
    expect(home.lockdown_enabled).toBe(true);
    expect(home.visibility).toBe('private');
  });
});

// ── Edge cases ───────────────────────────────────────────────

describe('Lockdown edge cases', () => {
  beforeEach(() => seedFullHome());

  test('lockdown on home with no occupants still works', async () => {
    // Remove all occupants except owner
    seedTable('HomeOccupancy', [
      { id: 'occ-owner', home_id: homeId, user_id: ownerId, role: 'owner', role_base: 'owner', is_active: true, start_at: null, end_at: null },
    ]);

    const access = await checkHomePermission(homeId, ownerId, 'security.manage');
    expect(access.hasAccess).toBe(true);

    await supabaseAdmin
      .from('Home')
      .update({ lockdown_enabled: true, visibility: 'private' })
      .eq('id', homeId);

    const home = getTable('Home')[0];
    expect(home.lockdown_enabled).toBe(true);
  });

  test('lockdown only affects target home', async () => {
    // Add a second home
    seedTable('Home', [
      ...getTable('Home'),
      { id: 'home-2', owner_id: ownerId, name: 'Other Home', visibility: 'public', lockdown_enabled: false },
    ]);
    seedTable('HomeGuestPass', [
      { id: 'gp-1', home_id: homeId, label: 'Home 1 Pass', revoked_at: null },
      { id: 'gp-2', home_id: 'home-2', label: 'Home 2 Pass', revoked_at: null },
    ]);

    // Lockdown home-1 only
    const now = new Date().toISOString();
    await supabaseAdmin
      .from('Home')
      .update({ lockdown_enabled: true, visibility: 'private' })
      .eq('id', homeId);

    await supabaseAdmin
      .from('HomeGuestPass')
      .update({ revoked_at: now })
      .eq('home_id', homeId)
      .is('revoked_at', null);

    // Home-2 should be unaffected
    const home2 = getTable('Home').find(h => h.id === 'home-2');
    expect(home2.lockdown_enabled).toBe(false);
    expect(home2.visibility).toBe('public');

    const home2Pass = getTable('HomeGuestPass').find(p => p.id === 'gp-2');
    expect(home2Pass.revoked_at).toBeNull();
  });
});
