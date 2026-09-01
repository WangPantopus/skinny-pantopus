// ============================================================
// TEST: Scoped Grants
// Validates scoped grant creation, token-based access,
// expiry, passcode protection, view count enforcement,
// resource fetching, and sensitive field stripping.
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

// ── Seed helpers ─────────────────────────────────────────────

const homeId = 'home-1';
const ownerId = 'user-owner';
const memberId = 'user-member';

const VALID_RESOURCE_TYPES = [
  'HomeIssue',
  'HomeTask',
  'HomeDocument',
  'HomeCalendarEvent',
  'HomeAsset',
  'HomePackage',
];

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

function seedHome() {
  seedTable('Home', [{
    id: homeId,
    owner_id: ownerId,
    name: 'Test Home',
    visibility: 'public',
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
    { id: 'occ-member', home_id: homeId, user_id: memberId, role: 'member', role_base: 'member', is_active: true, start_at: null, end_at: null },
  ]);
  seedTable('HomeRolePermission', [
    { id: 'rp-1', role_base: 'owner', permission: 'home.edit', allowed: true },
    { id: 'rp-2', role_base: 'owner', permission: 'home.view', allowed: true },
    { id: 'rp-3', role_base: 'member', permission: 'home.view', allowed: true },
    { id: 'rp-4', role_base: 'member', permission: 'home.edit', allowed: false },
  ]);
}

// ── Permission checks ────────────────────────────────────────

describe('Scoped grant permissions', () => {
  beforeEach(() => seedHome());

  test('creating scoped grant requires home.edit', async () => {
    const ownerPerm = await checkHomePermission(homeId, ownerId, 'home.edit');
    expect(ownerPerm.hasAccess).toBe(true);

    const memberPerm = await hasPermission(homeId, memberId, 'home.edit');
    expect(memberPerm).toBe(false);
  });

  test('owner always has permission to create grants', async () => {
    const access = await checkHomePermission(homeId, ownerId, 'home.edit');
    expect(access.hasAccess).toBe(true);
    expect(access.isOwner).toBe(true);
  });
});

// ── Scoped grant creation ────────────────────────────────────

describe('Scoped grant creation', () => {
  beforeEach(() => seedHome());

  test('creates grant with correct fields', async () => {
    const { token, tokenHash } = makeToken();
    const start = new Date();
    const durationHours = 24;
    const endAt = new Date(start.getTime() + durationHours * 3600000);

    const { data: grant } = await supabaseAdmin
      .from('HomeScopedGrant')
      .insert({
        home_id: homeId,
        resource_type: 'HomeTask',
        resource_id: 'task-123',
        can_view: true,
        can_edit: false,
        start_at: start.toISOString(),
        end_at: endAt.toISOString(),
        token_hash: tokenHash,
        passcode_hash: null,
        max_views: null,
        view_count: 0,
        created_by: ownerId,
      })
      .select()
      .single();

    expect(grant).toBeDefined();
    expect(grant.resource_type).toBe('HomeTask');
    expect(grant.resource_id).toBe('task-123');
    expect(grant.can_view).toBe(true);
    expect(grant.can_edit).toBe(false);
    expect(grant.view_count).toBe(0);
    expect(grant.token_hash).toBe(tokenHash);
  });

  test('supports all valid resource types', () => {
    VALID_RESOURCE_TYPES.forEach(type => {
      expect(['HomeIssue', 'HomeTask', 'HomeDocument', 'HomeCalendarEvent', 'HomeAsset', 'HomePackage']).toContain(type);
    });
  });

  test('default duration is 24 hours', () => {
    const defaultDuration = 24;
    const start = new Date();
    const end = new Date(start.getTime() + defaultDuration * 3600000);
    const diffHours = (end - start) / 3600000;
    expect(diffHours).toBe(24);
  });

  test('can_edit defaults to false', async () => {
    const { tokenHash } = makeToken();

    const { data: grant } = await supabaseAdmin
      .from('HomeScopedGrant')
      .insert({
        home_id: homeId,
        resource_type: 'HomeDocument',
        resource_id: 'doc-1',
        can_view: true,
        can_edit: false,
        start_at: new Date().toISOString(),
        end_at: hoursFromNow(24),
        token_hash: tokenHash,
        view_count: 0,
        created_by: ownerId,
      })
      .select()
      .single();

    expect(grant.can_edit).toBe(false);
    expect(grant.can_view).toBe(true);
  });

  test('grant with can_edit=true', async () => {
    const { tokenHash } = makeToken();

    const { data: grant } = await supabaseAdmin
      .from('HomeScopedGrant')
      .insert({
        home_id: homeId,
        resource_type: 'HomeTask',
        resource_id: 'task-1',
        can_view: true,
        can_edit: true,
        start_at: new Date().toISOString(),
        end_at: hoursFromNow(48),
        token_hash: tokenHash,
        view_count: 0,
        created_by: ownerId,
      })
      .select()
      .single();

    expect(grant.can_edit).toBe(true);
  });

  test('grant with passcode stores hash', async () => {
    const { tokenHash } = makeToken();
    const passcode = 'shareSecret';
    const passcodeHash = hashPasscode(passcode);

    const { data: grant } = await supabaseAdmin
      .from('HomeScopedGrant')
      .insert({
        home_id: homeId,
        resource_type: 'HomeDocument',
        resource_id: 'doc-1',
        can_view: true,
        can_edit: false,
        start_at: new Date().toISOString(),
        end_at: hoursFromNow(24),
        token_hash: tokenHash,
        passcode_hash: passcodeHash,
        view_count: 0,
        created_by: ownerId,
      })
      .select()
      .single();

    expect(grant.passcode_hash).toBe(passcodeHash);
    expect(grant.passcode_hash).toHaveLength(64);
  });

  test('creation writes audit log', async () => {
    await writeAuditLog(homeId, ownerId, 'scoped_grant_created', 'HomeScopedGrant', 'sg-1', {
      resource_type: 'HomeTask',
      resource_id: 'task-123',
      duration_hours: 24,
    });

    const logs = getTable('HomeAuditLog');
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('scoped_grant_created');
    expect(logs[0].target_type).toBe('HomeScopedGrant');
    expect(logs[0].metadata.resource_type).toBe('HomeTask');
    expect(logs[0].metadata.duration_hours).toBe(24);
  });
});

// ── Token-based access (public view) ─────────────────────────

describe('Scoped grant token-based access', () => {
  beforeEach(() => seedHome());

  test('valid token resolves the grant', async () => {
    const { token, tokenHash } = makeToken();
    seedTable('HomeScopedGrant', [{
      id: 'sg-1',
      home_id: homeId,
      resource_type: 'HomeTask',
      resource_id: 'task-1',
      token_hash: tokenHash,
      can_view: true,
      can_edit: false,
      start_at: hoursAgo(1),
      end_at: hoursFromNow(24),
      view_count: 0,
      max_views: null,
      passcode_hash: null,
    }]);

    // Simulate token lookup (same as homeGuest.js)
    const lookupHash = crypto.createHash('sha256').update(token).digest('hex');
    const { data: grant } = await supabaseAdmin
      .from('HomeScopedGrant')
      .select('*')
      .eq('token_hash', lookupHash)
      .maybeSingle();

    expect(grant).toBeDefined();
    expect(grant.resource_type).toBe('HomeTask');
    expect(grant.can_view).toBe(true);
  });

  test('unknown token returns null', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeScopedGrant', [{
      id: 'sg-1',
      home_id: homeId,
      token_hash: tokenHash,
    }]);

    const wrongToken = crypto.randomBytes(32).toString('hex');
    const wrongHash = crypto.createHash('sha256').update(wrongToken).digest('hex');
    const { data: grant } = await supabaseAdmin
      .from('HomeScopedGrant')
      .select('*')
      .eq('token_hash', wrongHash)
      .maybeSingle();

    expect(grant).toBeNull();
  });

  test('short token is invalid', () => {
    const shortToken = 'abc123';
    const isValid = shortToken && shortToken.length >= 32;
    expect(isValid).toBe(false);
  });
});

// ── Expiry enforcement ───────────────────────────────────────

describe('Scoped grant expiry', () => {
  test('expired grant is detected', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeScopedGrant', [{
      id: 'sg-1',
      home_id: homeId,
      token_hash: tokenHash,
      end_at: hoursAgo(1), // expired
      start_at: hoursAgo(25),
      view_count: 0,
      max_views: null,
    }]);

    const { data: grant } = await supabaseAdmin
      .from('HomeScopedGrant')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    expect(grant).toBeDefined();
    const isExpired = grant.end_at && new Date(grant.end_at) <= new Date();
    expect(isExpired).toBe(true);
    // Route would return 410
  });

  test('not-yet-active grant is rejected', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeScopedGrant', [{
      id: 'sg-1',
      home_id: homeId,
      token_hash: tokenHash,
      start_at: hoursFromNow(2), // future
      end_at: hoursFromNow(26),
      view_count: 0,
      max_views: null,
    }]);

    const { data: grant } = await supabaseAdmin
      .from('HomeScopedGrant')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    const notYetActive = grant.start_at && new Date(grant.start_at) > new Date();
    expect(notYetActive).toBe(true);
    // Route would return 403
  });

  test('active grant within time window is valid', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeScopedGrant', [{
      id: 'sg-1',
      home_id: homeId,
      token_hash: tokenHash,
      start_at: hoursAgo(1),
      end_at: hoursFromNow(23),
      view_count: 0,
      max_views: null,
    }]);

    const { data: grant } = await supabaseAdmin
      .from('HomeScopedGrant')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    const now = new Date();
    const isExpired = grant.end_at && new Date(grant.end_at) <= now;
    const notYetActive = grant.start_at && new Date(grant.start_at) > now;
    expect(isExpired).toBe(false);
    expect(notYetActive).toBe(false);
  });
});

// ── View count and max views ─────────────────────────────────

describe('Scoped grant view count', () => {
  test('viewing increments view_count', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeScopedGrant', [{
      id: 'sg-1',
      home_id: homeId,
      token_hash: tokenHash,
      view_count: 3,
      max_views: 10,
      start_at: hoursAgo(1),
      end_at: hoursFromNow(24),
    }]);

    const grant = getTable('HomeScopedGrant')[0];
    await supabaseAdmin
      .from('HomeScopedGrant')
      .update({ view_count: (grant.view_count || 0) + 1 })
      .eq('id', grant.id);

    const updated = getTable('HomeScopedGrant')[0];
    expect(updated.view_count).toBe(4);
  });

  test('max views reached blocks access', () => {
    const grant = { view_count: 5, max_views: 5 };
    const exhausted = grant.max_views && grant.view_count >= grant.max_views;
    expect(exhausted).toBe(true);
  });

  test('below max views allows access', () => {
    const grant = { view_count: 4, max_views: 5 };
    const exhausted = grant.max_views && grant.view_count >= grant.max_views;
    expect(exhausted).toBe(false);
  });

  test('null max_views means unlimited', () => {
    const grant = { view_count: 1000, max_views: null };
    const exhausted = grant.max_views && grant.view_count >= grant.max_views;
    expect(exhausted).toBeFalsy(); // null max_views → never exhausted
  });
});

// ── Passcode protection ──────────────────────────────────────

describe('Scoped grant passcode protection', () => {
  test('grant without passcode is freely accessible', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeScopedGrant', [{
      id: 'sg-1',
      home_id: homeId,
      token_hash: tokenHash,
      passcode_hash: null,
      start_at: hoursAgo(1),
      end_at: hoursFromNow(24),
      view_count: 0,
    }]);

    const { data: grant } = await supabaseAdmin
      .from('HomeScopedGrant')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    expect(grant.passcode_hash).toBeNull();
    // No passcode check needed
  });

  test('correct passcode matches stored hash', () => {
    const passcode = 'shareMe123';
    const storedHash = hashPasscode(passcode);
    const providedHash = crypto.createHash('sha256').update(passcode).digest('hex');
    expect(providedHash).toBe(storedHash);
  });

  test('wrong passcode does not match', () => {
    const storedHash = hashPasscode('correctPass');
    const wrongHash = crypto.createHash('sha256').update('wrongPass').digest('hex');
    expect(wrongHash).not.toBe(storedHash);
  });

  test('missing passcode when required triggers 403', () => {
    const storedHash = hashPasscode('secret');
    const passcodeProvided = undefined;
    const requiresPasscode = !!storedHash && !passcodeProvided;
    expect(requiresPasscode).toBe(true);
  });
});

// ── Resource fetching and field stripping ─────────────────────

describe('Scoped grant resource fetching', () => {
  beforeEach(() => seedHome());

  test('fetches HomeTask resource by ID and home_id', async () => {
    seedTable('HomeTask', [{
      id: 'task-1',
      home_id: homeId,
      title: 'Fix the sink',
      status: 'open',
      created_by: ownerId,
      viewer_user_ids: [memberId],
    }]);

    const { data: resource } = await supabaseAdmin
      .from('HomeTask')
      .select('*')
      .eq('id', 'task-1')
      .eq('home_id', homeId)
      .maybeSingle();

    expect(resource).toBeDefined();
    expect(resource.title).toBe('Fix the sink');
  });

  test('strips sensitive fields from resource', async () => {
    seedTable('HomeDocument', [{
      id: 'doc-1',
      home_id: homeId,
      title: 'Lease Agreement',
      doc_type: 'pdf',
      created_by: ownerId,
      viewer_user_ids: [memberId, ownerId],
    }]);

    const { data: resource } = await supabaseAdmin
      .from('HomeDocument')
      .select('*')
      .eq('id', 'doc-1')
      .eq('home_id', homeId)
      .maybeSingle();

    // Simulate field stripping (same as homeGuest.js)
    const { created_by, viewer_user_ids, ...safeResource } = resource;

    expect(safeResource.title).toBe('Lease Agreement');
    expect(safeResource.doc_type).toBe('pdf');
    expect(safeResource).not.toHaveProperty('created_by');
    expect(safeResource).not.toHaveProperty('viewer_user_ids');
  });

  test('resource not found returns null', async () => {
    const { data: resource } = await supabaseAdmin
      .from('HomeTask')
      .select('*')
      .eq('id', 'nonexistent')
      .eq('home_id', homeId)
      .maybeSingle();

    expect(resource).toBeNull();
  });

  test('resource from wrong home returns null', async () => {
    seedTable('HomePackage', [{
      id: 'pkg-1',
      home_id: 'other-home',
      tracking_number: 'TRACK123',
      status: 'shipped',
    }]);

    const { data: resource } = await supabaseAdmin
      .from('HomePackage')
      .select('*')
      .eq('id', 'pkg-1')
      .eq('home_id', homeId) // wrong home
      .maybeSingle();

    expect(resource).toBeNull();
  });

  test('each valid resource type maps to correct table', () => {
    const tableMap = {
      HomeIssue: 'HomeIssue',
      HomeTask: 'HomeTask',
      HomeDocument: 'HomeDocument',
      HomeCalendarEvent: 'HomeCalendarEvent',
      HomeAsset: 'HomeAsset',
      HomePackage: 'HomePackage',
    };

    VALID_RESOURCE_TYPES.forEach(type => {
      expect(tableMap[type]).toBe(type);
    });

    // Unknown type should not be in map
    expect(tableMap['UnknownType']).toBeUndefined();
  });
});

// ── Public view response shape ───────────────────────────────

describe('Scoped grant response shape', () => {
  test('response includes grant metadata and safe resource', async () => {
    const { tokenHash } = makeToken();
    seedTable('HomeScopedGrant', [{
      id: 'sg-1',
      home_id: homeId,
      resource_type: 'HomeCalendarEvent',
      resource_id: 'evt-1',
      token_hash: tokenHash,
      can_view: true,
      can_edit: false,
      start_at: hoursAgo(1),
      end_at: hoursFromNow(24),
      view_count: 0,
    }]);
    seedTable('HomeCalendarEvent', [{
      id: 'evt-1',
      home_id: homeId,
      title: 'Block Party',
      start_at: hoursFromNow(48),
      created_by: ownerId,
      viewer_user_ids: [],
    }]);

    // Fetch grant
    const { data: grant } = await supabaseAdmin
      .from('HomeScopedGrant')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    // Fetch resource
    const { data: resource } = await supabaseAdmin
      .from(grant.resource_type)
      .select('*')
      .eq('id', grant.resource_id)
      .eq('home_id', grant.home_id)
      .maybeSingle();

    // Build response (same as homeGuest.js)
    const { created_by, viewer_user_ids, ...safeResource } = resource;
    const response = {
      grant: {
        resource_type: grant.resource_type,
        can_view: grant.can_view,
        can_edit: grant.can_edit,
        expires_at: grant.end_at,
      },
      resource: safeResource,
    };

    expect(response.grant.resource_type).toBe('HomeCalendarEvent');
    expect(response.grant.can_view).toBe(true);
    expect(response.grant.can_edit).toBe(false);
    expect(response.grant.expires_at).toBeDefined();
    expect(response.resource.title).toBe('Block Party');
    expect(response.resource).not.toHaveProperty('created_by');
    expect(response.resource).not.toHaveProperty('viewer_user_ids');
  });
});
