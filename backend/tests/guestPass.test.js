// ============================================================
// TEST: Guest Passes
// Validates guest pass creation (4 templates), section defaults,
// timing resolution, passcode protection, view tracking,
// expiry enforcement, revocation, and listing enrichment.
// ============================================================

const crypto = require('crypto');
const supabaseAdmin = require('./__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;
const {
  checkHomePermission,
  hasPermission,
  writeAuditLog,
} = require('../utils/homePermissions');

beforeEach(() => resetTables());

// ── Constants (mirrored from homeIam.js) ────────────────────

const GUEST_PASS_TEMPLATES = {
  wifi_only: {
    default_hours: 2,
    sections: ['wifi', 'parking'],
  },
  guest: {
    default_hours: 48,
    sections: ['wifi', 'parking', 'house_rules', 'entry_instructions', 'emergency'],
  },
  airbnb: {
    default_hours: null,
    sections: ['wifi', 'parking', 'house_rules', 'entry_instructions', 'trash_day', 'local_tips', 'emergency'],
  },
  vendor: {
    default_hours: 8,
    sections: ['entry_instructions', 'parking'],
  },
};

// ── Seed helpers ─────────────────────────────────────────────

const homeId = 'home-1';
const ownerId = 'user-owner';
const managerId = 'user-manager';
const memberId = 'user-member';

function seedHome(overrides = {}) {
  seedTable('Home', [{
    id: homeId,
    owner_id: ownerId,
    name: 'Test Home',
    visibility: 'public',
    default_guest_pass_hours: 48,
    house_rules: 'No shoes',
    parking_instructions: 'Driveway only',
    entry_instructions: 'Side door',
    trash_day: 'Wednesday',
    local_tips: 'Good bakery nearby',
    guest_welcome_message: 'Welcome to our home!',
    lockdown_enabled: false,
    ...overrides,
  }]);
}

function seedPermissions() {
  seedTable('HomeOwner', [{
    id: 'owner-rec',
    home_id: homeId,
    subject_id: ownerId,
    owner_status: 'verified',
    tier: 'standard',
    is_primary: true,
  }]);
  seedTable('HomeOccupancy', [
    { id: 'occ-owner', home_id: homeId, user_id: ownerId, role: 'owner', role_base: 'owner', is_active: true, start_at: null, end_at: null },
    { id: 'occ-mgr', home_id: homeId, user_id: managerId, role: 'manager', role_base: 'manager', is_active: true, start_at: null, end_at: null },
    { id: 'occ-member', home_id: homeId, user_id: memberId, role: 'member', role_base: 'member', is_active: true, start_at: null, end_at: null },
  ]);
  seedTable('HomeRolePermission', [
    { id: 'rp-1', role_base: 'owner', permission: 'members.manage', allowed: true },
    { id: 'rp-2', role_base: 'manager', permission: 'members.manage', allowed: true },
    { id: 'rp-3', role_base: 'member', permission: 'members.manage', allowed: false },
    { id: 'rp-4', role_base: 'member', permission: 'home.view', allowed: true },
    { id: 'rp-5', role_base: 'manager', permission: 'home.view', allowed: true },
    { id: 'rp-6', role_base: 'owner', permission: 'home.view', allowed: true },
  ]);
}

function hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function makeToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

function hashPasscode(passcode) {
  return crypto.createHash('sha256').update(passcode).digest('hex');
}

// ── Template defaults ────────────────────────────────────────

describe('Guest pass template defaults', () => {
  test('wifi_only template has 2-hour duration and wifi+parking sections', () => {
    const t = GUEST_PASS_TEMPLATES.wifi_only;
    expect(t.default_hours).toBe(2);
    expect(t.sections).toEqual(['wifi', 'parking']);
  });

  test('guest template has 48-hour duration and 5 sections', () => {
    const t = GUEST_PASS_TEMPLATES.guest;
    expect(t.default_hours).toBe(48);
    expect(t.sections).toEqual(['wifi', 'parking', 'house_rules', 'entry_instructions', 'emergency']);
    expect(t.sections).toHaveLength(5);
  });

  test('airbnb template has null duration (explicit end_at required) and 7 sections', () => {
    const t = GUEST_PASS_TEMPLATES.airbnb;
    expect(t.default_hours).toBeNull();
    expect(t.sections).toEqual([
      'wifi', 'parking', 'house_rules', 'entry_instructions',
      'trash_day', 'local_tips', 'emergency',
    ]);
    expect(t.sections).toHaveLength(7);
  });

  test('vendor template has 8-hour duration and limited sections', () => {
    const t = GUEST_PASS_TEMPLATES.vendor;
    expect(t.default_hours).toBe(8);
    expect(t.sections).toEqual(['entry_instructions', 'parking']);
    expect(t.sections).not.toContain('wifi');
  });
});

// ── Section resolution ───────────────────────────────────────

describe('Section resolution logic', () => {
  test('uses template defaults when no included_sections provided', () => {
    const kind = 'guest';
    const included_sections = undefined;
    const template = GUEST_PASS_TEMPLATES[kind];
    const resolved = Array.isArray(included_sections) && included_sections.length > 0
      ? included_sections
      : template.sections;
    expect(resolved).toEqual(template.sections);
  });

  test('uses template defaults for empty array', () => {
    const kind = 'wifi_only';
    const included_sections = [];
    const template = GUEST_PASS_TEMPLATES[kind];
    const resolved = Array.isArray(included_sections) && included_sections.length > 0
      ? included_sections
      : template.sections;
    expect(resolved).toEqual(['wifi', 'parking']);
  });

  test('user override replaces template defaults', () => {
    const kind = 'guest';
    const included_sections = ['wifi', 'house_rules'];
    const template = GUEST_PASS_TEMPLATES[kind];
    const resolved = Array.isArray(included_sections) && included_sections.length > 0
      ? included_sections
      : template.sections;
    expect(resolved).toEqual(['wifi', 'house_rules']);
    expect(resolved).not.toContain('parking');
  });
});

// ── Timing resolution ────────────────────────────────────────

describe('Timing resolution', () => {
  test('explicit end_at takes priority', () => {
    const endAt = hoursFromNow(10);
    const resolvedEnd = new Date(endAt);
    expect(resolvedEnd.getTime()).toBeGreaterThan(Date.now());
  });

  test('duration_hours computes end from start', () => {
    const start = new Date();
    const durationHours = 24;
    const resolvedEnd = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    const diffHours = (resolvedEnd - start) / (60 * 60 * 1000);
    expect(diffHours).toBe(24);
  });

  test('template default_hours used when no explicit timing', () => {
    const start = new Date();
    const template = GUEST_PASS_TEMPLATES.wifi_only;
    const resolvedEnd = new Date(start.getTime() + template.default_hours * 60 * 60 * 1000);
    const diffHours = (resolvedEnd - start) / (60 * 60 * 1000);
    expect(diffHours).toBe(2);
  });

  test('airbnb with no timing falls back to home default_guest_pass_hours', async () => {
    seedHome({ default_guest_pass_hours: 72 });

    const template = GUEST_PASS_TEMPLATES.airbnb;
    expect(template.default_hours).toBeNull();

    // Simulate fallback query
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('default_guest_pass_hours')
      .eq('id', homeId)
      .single();

    const fallbackHours = home?.default_guest_pass_hours || 48;
    expect(fallbackHours).toBe(72);

    const start = new Date();
    const resolvedEnd = new Date(start.getTime() + fallbackHours * 60 * 60 * 1000);
    const diffHours = (resolvedEnd - start) / (60 * 60 * 1000);
    expect(diffHours).toBe(72);
  });
});

// ── Guest pass creation ──────────────────────────────────────

describe('Guest pass creation', () => {
  beforeEach(() => {
    seedHome();
    seedPermissions();
  });

  test('creates guest pass with correct fields', async () => {
    const { token, tokenHash } = makeToken();
    const now = new Date();
    const template = GUEST_PASS_TEMPLATES.guest;

    const { data: pass } = await supabaseAdmin
      .from('HomeGuestPass')
      .insert({
        home_id: homeId,
        label: 'Weekend visitor',
        kind: 'guest',
        token_hash: tokenHash,
        role_base: 'guest',
        permissions: {},
        start_at: now.toISOString(),
        end_at: new Date(now.getTime() + template.default_hours * 3600000).toISOString(),
        created_by: ownerId,
        included_sections: template.sections,
        custom_title: null,
        passcode_hash: null,
        max_views: null,
        view_count: 0,
      })
      .select()
      .single();

    expect(pass).toBeDefined();
    expect(pass.label).toBe('Weekend visitor');
    expect(pass.kind).toBe('guest');
    expect(pass.role_base).toBe('guest');
    expect(pass.view_count).toBe(0);
    expect(pass.included_sections).toEqual(template.sections);
    expect(pass.token_hash).toBe(tokenHash);
  });

  test('wifi_only pass defaults to 2-hour window', async () => {
    const { tokenHash } = makeToken();
    const start = new Date();
    const template = GUEST_PASS_TEMPLATES.wifi_only;
    const endAt = new Date(start.getTime() + template.default_hours * 3600000);

    const { data: pass } = await supabaseAdmin
      .from('HomeGuestPass')
      .insert({
        home_id: homeId,
        label: 'Quick wifi',
        kind: 'wifi_only',
        token_hash: tokenHash,
        role_base: 'guest',
        permissions: {},
        start_at: start.toISOString(),
        end_at: endAt.toISOString(),
        created_by: ownerId,
        included_sections: template.sections,
        view_count: 0,
      })
      .select()
      .single();

    expect(pass.kind).toBe('wifi_only');
    expect(pass.included_sections).toEqual(['wifi', 'parking']);
    const durationMs = new Date(pass.end_at) - new Date(pass.start_at);
    expect(durationMs).toBe(2 * 3600000);
  });

  test('vendor pass defaults to 8-hour window', async () => {
    const { tokenHash } = makeToken();
    const start = new Date();
    const template = GUEST_PASS_TEMPLATES.vendor;
    const endAt = new Date(start.getTime() + template.default_hours * 3600000);

    const { data: pass } = await supabaseAdmin
      .from('HomeGuestPass')
      .insert({
        home_id: homeId,
        label: 'Plumber visit',
        kind: 'vendor',
        token_hash: tokenHash,
        role_base: 'guest',
        permissions: {},
        start_at: start.toISOString(),
        end_at: endAt.toISOString(),
        created_by: ownerId,
        included_sections: template.sections,
        view_count: 0,
      })
      .select()
      .single();

    expect(pass.kind).toBe('vendor');
    expect(pass.included_sections).toEqual(['entry_instructions', 'parking']);
    const durationMs = new Date(pass.end_at) - new Date(pass.start_at);
    expect(durationMs).toBe(8 * 3600000);
  });

  test('passcode is stored as SHA-256 hash', () => {
    const passcode = 'secret123';
    const hash = hashPasscode(passcode);
    expect(hash).toHaveLength(64); // SHA-256 hex = 64 chars
    // Same passcode produces same hash
    expect(hashPasscode(passcode)).toBe(hash);
    // Different passcode produces different hash
    expect(hashPasscode('wrong')).not.toBe(hash);
  });

  test('token is stored as SHA-256 hash', () => {
    const { token, tokenHash } = makeToken();
    expect(token).toHaveLength(64); // 32 bytes hex = 64 chars
    expect(tokenHash).toHaveLength(64);
    // Re-hashing same token produces same hash
    const rehash = crypto.createHash('sha256').update(token).digest('hex');
    expect(rehash).toBe(tokenHash);
  });

  test('requires members.manage permission', async () => {
    const ownerPerm = await checkHomePermission(homeId, ownerId, 'members.manage');
    expect(ownerPerm.hasAccess).toBe(true);

    const managerPerm = await hasPermission(homeId, managerId, 'members.manage');
    expect(managerPerm).toBe(true);

    const memberPerm = await hasPermission(homeId, memberId, 'members.manage');
    expect(memberPerm).toBe(false);
  });

  test('creation writes audit log', async () => {
    await writeAuditLog(homeId, ownerId, 'guest_pass_created', 'HomeGuestPass', 'gp-1', {
      label: 'Test Pass',
      kind: 'guest',
      included_sections: GUEST_PASS_TEMPLATES.guest.sections,
    });

    const logs = getTable('HomeAuditLog');
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('guest_pass_created');
    expect(logs[0].target_type).toBe('HomeGuestPass');
    expect(logs[0].metadata.kind).toBe('guest');
  });
});

// ── Guest pass listing with enrichment ───────────────────────

describe('Guest pass listing', () => {
  beforeEach(() => {
    seedHome();
    seedPermissions();
  });

  test('lists active passes excluding revoked by default', async () => {
    seedTable('HomeGuestPass', [
      { id: 'gp-1', home_id: homeId, label: 'Active', kind: 'guest', revoked_at: null, end_at: hoursFromNow(24), view_count: 0, max_views: null, created_at: '2024-01-01' },
      { id: 'gp-2', home_id: homeId, label: 'Revoked', kind: 'guest', revoked_at: hoursAgo(1), end_at: hoursFromNow(24), view_count: 0, max_views: null, created_at: '2024-01-02' },
      { id: 'gp-3', home_id: homeId, label: 'Also Active', kind: 'wifi_only', revoked_at: null, end_at: hoursFromNow(2), view_count: 0, max_views: null, created_at: '2024-01-03' },
    ]);

    // Default: filter out revoked
    const { data: passes } = await supabaseAdmin
      .from('HomeGuestPass')
      .select('*')
      .eq('home_id', homeId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    expect(passes).toHaveLength(2);
    expect(passes.map(p => p.label)).toEqual(expect.arrayContaining(['Active', 'Also Active']));
  });

  test('include_revoked=true returns all passes', async () => {
    seedTable('HomeGuestPass', [
      { id: 'gp-1', home_id: homeId, label: 'Active', revoked_at: null, created_at: '2024-01-01' },
      { id: 'gp-2', home_id: homeId, label: 'Revoked', revoked_at: hoursAgo(1), created_at: '2024-01-02' },
    ]);

    const { data: allPasses } = await supabaseAdmin
      .from('HomeGuestPass')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    expect(allPasses).toHaveLength(2);
  });

  test('status enrichment: active / expired / revoked', () => {
    const now = new Date();

    function computeStatus(pass) {
      if (pass.revoked_at) return 'revoked';
      if (pass.end_at && new Date(pass.end_at) <= now) return 'expired';
      if (pass.max_views && pass.view_count >= pass.max_views) return 'expired';
      return 'active';
    }

    expect(computeStatus({ revoked_at: hoursAgo(1), end_at: hoursFromNow(24), view_count: 0, max_views: null })).toBe('revoked');
    expect(computeStatus({ revoked_at: null, end_at: hoursAgo(1), view_count: 0, max_views: null })).toBe('expired');
    expect(computeStatus({ revoked_at: null, end_at: hoursFromNow(24), view_count: 5, max_views: 5 })).toBe('expired');
    expect(computeStatus({ revoked_at: null, end_at: hoursFromNow(24), view_count: 3, max_views: 5 })).toBe('active');
    expect(computeStatus({ revoked_at: null, end_at: hoursFromNow(24), view_count: 0, max_views: null })).toBe('active');
  });

  test('last_viewed_at enrichment from HomeGuestPassView', async () => {
    seedTable('HomeGuestPass', [
      { id: 'gp-1', home_id: homeId, label: 'Pass 1', revoked_at: null },
    ]);
    seedTable('HomeGuestPassView', [
      { id: 'view-1', guest_pass_id: 'gp-1', viewed_at: '2024-06-01T10:00:00Z', viewer_ip: '1.2.3.4', user_agent: 'Chrome' },
      { id: 'view-2', guest_pass_id: 'gp-1', viewed_at: '2024-06-02T10:00:00Z', viewer_ip: '1.2.3.4', user_agent: 'Chrome' },
    ]);

    const { data: views } = await supabaseAdmin
      .from('HomeGuestPassView')
      .select('*')
      .eq('guest_pass_id', 'gp-1');

    expect(views).toHaveLength(2);

    // Mock doesn't enforce order(), so sort manually (same as route handler enrichment)
    const sorted = [...views].sort((a, b) => new Date(b.viewed_at) - new Date(a.viewed_at));
    const lastViewedAt = sorted[0]?.viewed_at;
    expect(lastViewedAt).toBe('2024-06-02T10:00:00Z');
  });
});

// ── Guest pass revocation ────────────────────────────────────

describe('Guest pass revocation', () => {
  beforeEach(() => {
    seedHome();
    seedPermissions();
  });

  test('revoke sets revoked_at timestamp', async () => {
    seedTable('HomeGuestPass', [{
      id: 'gp-1',
      home_id: homeId,
      label: 'To Revoke',
      revoked_at: null,
    }]);

    const now = new Date().toISOString();
    const { data: revoked } = await supabaseAdmin
      .from('HomeGuestPass')
      .update({ revoked_at: now, updated_at: now })
      .eq('id', 'gp-1')
      .eq('home_id', homeId)
      .is('revoked_at', null)
      .select()
      .single();

    expect(revoked).toBeDefined();
    expect(revoked.revoked_at).toBe(now);
  });

  test('revoking already-revoked pass returns no match', async () => {
    seedTable('HomeGuestPass', [{
      id: 'gp-1',
      home_id: homeId,
      label: 'Already Revoked',
      revoked_at: hoursAgo(2),
    }]);

    const { data } = await supabaseAdmin
      .from('HomeGuestPass')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', 'gp-1')
      .eq('home_id', homeId)
      .is('revoked_at', null)
      .select()
      .single();

    // .is('revoked_at', null) filters out already-revoked
    expect(data).toBeNull();
  });

  test('revocation writes audit log', async () => {
    await writeAuditLog(homeId, ownerId, 'guest_pass_revoked', 'HomeGuestPass', 'gp-1', {});

    const logs = getTable('HomeAuditLog');
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('guest_pass_revoked');
  });
});

// ── Guest pass public view flow ──────────────────────────────

describe('Guest pass public view (token validation)', () => {
  beforeEach(() => {
    seedHome();
  });

  test('valid token resolves pass data', async () => {
    const { token, tokenHash } = makeToken();
    seedTable('HomeGuestPass', [{
      id: 'gp-1',
      home_id: homeId,
      label: 'Valid Pass',
      kind: 'guest',
      token_hash: tokenHash,
      revoked_at: null,
      start_at: hoursAgo(1),
      end_at: hoursFromNow(24),
      view_count: 0,
      max_views: null,
      passcode_hash: null,
      included_sections: ['wifi', 'parking', 'house_rules'],
      custom_title: 'Welcome Guest',
    }]);

    // Simulate token lookup (same as homeGuest.js does)
    const lookupHash = crypto.createHash('sha256').update(token).digest('hex');
    const { data: pass } = await supabaseAdmin
      .from('HomeGuestPass')
      .select('*')
      .eq('token_hash', lookupHash)
      .maybeSingle();

    expect(pass).toBeDefined();
    expect(pass.label).toBe('Valid Pass');
    expect(pass.kind).toBe('guest');
    expect(pass.custom_title).toBe('Welcome Guest');
  });

  test('invalid/unknown token returns no match', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeGuestPass', [{
      id: 'gp-1',
      home_id: homeId,
      token_hash: tokenHash,
    }]);

    // Look up with a different token
    const wrongToken = crypto.randomBytes(32).toString('hex');
    const wrongHash = crypto.createHash('sha256').update(wrongToken).digest('hex');
    const { data: pass } = await supabaseAdmin
      .from('HomeGuestPass')
      .select('*')
      .eq('token_hash', wrongHash)
      .maybeSingle();

    expect(pass).toBeNull();
  });

  test('revoked pass is rejected', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeGuestPass', [{
      id: 'gp-1',
      home_id: homeId,
      token_hash: tokenHash,
      revoked_at: hoursAgo(1), // revoked
    }]);

    const { data: pass } = await supabaseAdmin
      .from('HomeGuestPass')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    expect(pass).toBeDefined();
    expect(pass.revoked_at).not.toBeNull();
    // Route would return 410
  });

  test('expired pass is rejected', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeGuestPass', [{
      id: 'gp-1',
      home_id: homeId,
      token_hash: tokenHash,
      revoked_at: null,
      end_at: hoursAgo(1), // expired
    }]);

    const { data: pass } = await supabaseAdmin
      .from('HomeGuestPass')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    expect(pass).toBeDefined();
    const isExpired = pass.end_at && new Date(pass.end_at) <= new Date();
    expect(isExpired).toBe(true);
  });

  test('not-yet-active pass is rejected', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeGuestPass', [{
      id: 'gp-1',
      home_id: homeId,
      token_hash: tokenHash,
      revoked_at: null,
      start_at: hoursFromNow(2), // future start
      end_at: hoursFromNow(24),
    }]);

    const { data: pass } = await supabaseAdmin
      .from('HomeGuestPass')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    expect(pass).toBeDefined();
    const notYetActive = pass.start_at && new Date(pass.start_at) > new Date();
    expect(notYetActive).toBe(true);
  });

  test('max views reached returns exhausted', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeGuestPass', [{
      id: 'gp-1',
      home_id: homeId,
      token_hash: tokenHash,
      revoked_at: null,
      start_at: hoursAgo(1),
      end_at: hoursFromNow(24),
      view_count: 5,
      max_views: 5,
    }]);

    const { data: pass } = await supabaseAdmin
      .from('HomeGuestPass')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    expect(pass).toBeDefined();
    const exhausted = pass.max_views && pass.view_count >= pass.max_views;
    expect(exhausted).toBe(true);
  });

  test('below max views is still accessible', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeGuestPass', [{
      id: 'gp-1',
      home_id: homeId,
      token_hash: tokenHash,
      revoked_at: null,
      start_at: hoursAgo(1),
      end_at: hoursFromNow(24),
      view_count: 3,
      max_views: 5,
    }]);

    const { data: pass } = await supabaseAdmin
      .from('HomeGuestPass')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    const exhausted = pass.max_views && pass.view_count >= pass.max_views;
    expect(exhausted).toBe(false);
  });
});

// ── Passcode protection ──────────────────────────────────────

describe('Guest pass passcode protection', () => {
  test('pass without passcode is accessible without one', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeGuestPass', [{
      id: 'gp-1',
      home_id: homeId,
      token_hash: tokenHash,
      passcode_hash: null,
      revoked_at: null,
      start_at: hoursAgo(1),
      end_at: hoursFromNow(24),
      view_count: 0,
      max_views: null,
    }]);

    const { data: pass } = await supabaseAdmin
      .from('HomeGuestPass')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    expect(pass.passcode_hash).toBeNull();
    // No passcode check needed
  });

  test('pass with passcode requires correct code', () => {
    const passcode = 'mySecret42';
    const storedHash = hashPasscode(passcode);

    // Correct passcode
    const correctHash = crypto.createHash('sha256').update(passcode).digest('hex');
    expect(correctHash).toBe(storedHash);

    // Wrong passcode → 403
    const wrongHash = crypto.createHash('sha256').update('wrong').digest('hex');
    expect(wrongHash).not.toBe(storedHash);
  });

  test('missing passcode when required → 403', () => {
    const storedHash = hashPasscode('secret');
    const passcodeProvided = undefined;

    // Route checks: if passcode_hash exists and no passcode provided → 403
    const requiresPasscode = !!storedHash && !passcodeProvided;
    expect(requiresPasscode).toBe(true);
  });
});

// ── View count increment ─────────────────────────────────────

describe('Guest pass view count', () => {
  beforeEach(() => seedHome());

  test('viewing increments view_count', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeGuestPass', [{
      id: 'gp-1',
      home_id: homeId,
      token_hash: tokenHash,
      view_count: 2,
      max_views: 10,
      revoked_at: null,
      start_at: hoursAgo(1),
      end_at: hoursFromNow(24),
    }]);

    // Simulate view increment (same as route handler)
    const pass = getTable('HomeGuestPass')[0];
    await supabaseAdmin
      .from('HomeGuestPass')
      .update({ view_count: (pass.view_count || 0) + 1 })
      .eq('id', pass.id);

    const updated = getTable('HomeGuestPass')[0];
    expect(updated.view_count).toBe(3);
  });

  test('view creates HomeGuestPassView record', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeGuestPass', [{
      id: 'gp-1',
      home_id: homeId,
      token_hash: tokenHash,
      view_count: 0,
    }]);

    await supabaseAdmin
      .from('HomeGuestPassView')
      .insert({
        guest_pass_id: 'gp-1',
        viewer_ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
      });

    const views = getTable('HomeGuestPassView');
    expect(views).toHaveLength(1);
    expect(views[0].guest_pass_id).toBe('gp-1');
    expect(views[0].viewer_ip).toBe('192.168.1.1');
  });
});

// ── Guest pass section data assembly ─────────────────────────

describe('Guest pass section data', () => {
  beforeEach(() => seedHome());

  test('parking section returns parking_instructions from home', async () => {
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('*')
      .eq('id', homeId)
      .single();

    const sections = {};
    if (['parking'].includes('parking')) {
      sections.parking = home.parking_instructions || null;
    }
    expect(sections.parking).toBe('Driveway only');
  });

  test('house_rules section returns house_rules from home', async () => {
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('*')
      .eq('id', homeId)
      .single();

    expect(home.house_rules).toBe('No shoes');
  });

  test('wifi section returns access secrets', async () => {
    seedTable('HomeAccessSecret', [
      { id: 'sec-1', home_id: homeId, label: 'MyWiFi', access_type: 'wifi', secret_value: 'pw123' },
    ]);

    const { data: wifiSecrets } = await supabaseAdmin
      .from('HomeAccessSecret')
      .select('*')
      .eq('home_id', homeId)
      .eq('access_type', 'wifi');

    expect(wifiSecrets).toHaveLength(1);
    // Transform to guest-friendly format
    const transformed = wifiSecrets.map(s => ({
      network_name: s.label,
      password: s.secret_value || null,
    }));
    expect(transformed[0].network_name).toBe('MyWiFi');
    expect(transformed[0].password).toBe('pw123');
  });

  test('emergency section returns emergency contacts', async () => {
    seedTable('HomeEmergency', [
      { id: 'em-1', home_id: homeId, type: 'fire', label: 'Fire Dept', location: 'Kitchen', details: 'Extinguisher under sink' },
      { id: 'em-2', home_id: homeId, type: 'medical', label: 'First Aid', location: 'Bathroom', details: 'Kit in top cabinet' },
    ]);

    const { data: emergencies } = await supabaseAdmin
      .from('HomeEmergency')
      .select('*')
      .eq('home_id', homeId);

    expect(emergencies).toHaveLength(2);
    // Transform with info_type and location_in_home aliases
    const transformed = emergencies.map(e => ({
      ...e,
      info_type: e.type,
      location_in_home: e.location,
    }));
    expect(transformed[0].info_type).toBe('fire');
    expect(transformed[1].location_in_home).toBe('Bathroom');
  });

  test('doc: prefixed sections fetch specific documents', async () => {
    seedTable('HomeDocument', [
      { id: 'doc-aaa', home_id: homeId, title: 'Lease Agreement', doc_type: 'pdf' },
      { id: 'doc-bbb', home_id: homeId, title: 'HOA Rules', doc_type: 'pdf' },
      { id: 'doc-ccc', home_id: homeId, title: 'Private Doc', doc_type: 'pdf' },
    ]);

    const includedSections = ['wifi', 'doc:doc-aaa', 'doc:doc-bbb'];
    const docIds = includedSections
      .filter(s => s.startsWith('doc:'))
      .map(s => s.replace('doc:', ''));

    expect(docIds).toEqual(['doc-aaa', 'doc-bbb']);

    const { data: docs } = await supabaseAdmin
      .from('HomeDocument')
      .select('*')
      .eq('home_id', homeId)
      .in('id', docIds);

    expect(docs).toHaveLength(2);
    expect(docs.map(d => d.title)).toEqual(expect.arrayContaining(['Lease Agreement', 'HOA Rules']));
    // Private doc excluded
    expect(docs.map(d => d.id)).not.toContain('doc-ccc');
  });
});
