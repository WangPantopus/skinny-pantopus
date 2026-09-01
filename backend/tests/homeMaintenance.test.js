// ============================================================
// TEST: Home Maintenance (T6.3b / P10)
// Validates CRUD on HomeMaintenanceLog (the T6.3b extension) + authz.
// Mirrors the homeProfileV2.test.js pattern — uses the in-memory
// supabaseAdmin mock, seeds tables, and exercises the same queries
// the route handler issues.
// ============================================================

const supabaseAdmin = require('./__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;
const {
  checkHomePermission,
  hasPermission,
} = require('../utils/homePermissions');

beforeEach(() => resetTables());

const homeId = 'home-1';
const ownerId = 'user-owner';
const memberId = 'user-member';
const outsiderId = 'user-outsider';

function seedHome() {
  seedTable('Home', [{
    id: homeId,
    owner_id: ownerId,
    name: 'Test Home',
    home_type: 'house',
    visibility: 'public',
  }]);
}

function seedOccupancy(userId, role = 'member') {
  const existing = getTable('HomeOccupancy') || [];
  seedTable('HomeOccupancy', [
    ...existing,
    {
      id: `occ-${userId}`,
      home_id: homeId,
      user_id: userId,
      role,
      role_base: role,
      is_active: true,
      start_at: null,
      end_at: null,
    },
  ]);
}

function seedRolePermissions(role, permissions) {
  const existing = getTable('HomeRolePermission') || [];
  const rows = permissions.map((p, i) => ({
    id: `rp-${role}-${i}-${p}`,
    role_base: role,
    permission: p,
    allowed: true,
  }));
  seedTable('HomeRolePermission', [...existing, ...rows]);
}

function seedStandardPermissions() {
  // Owners can edit; members can view only. Mirrors the role matrix
  // seeded in `homeProfileV2.test.js`.
  seedRolePermissions('owner', ['home.view', 'home.edit', 'finance.view', 'finance.manage']);
  seedRolePermissions('member', ['home.view']);
}

// ── List ─────────────────────────────────────────────────────

describe('GET /api/homes/:id/maintenance — list', () => {
  beforeEach(() => {
    seedHome();
    seedOccupancy(ownerId, 'owner');
    seedOccupancy(memberId, 'member');
    seedStandardPermissions();
  });

  test('returns all tasks for the home, scoped by home_id', async () => {
    seedTable('HomeMaintenanceLog', [
      { id: 'm-1', home_id: homeId, task: 'HVAC tune-up', status: 'scheduled', recurrence: 'yearly', due_date: '2026-10-15T08:00:00Z', created_at: '2026-09-01T00:00:00Z' },
      { id: 'm-2', home_id: homeId, task: 'Gutter clean', status: 'scheduled', recurrence: 'yearly', due_date: '2026-10-20T08:00:00Z', created_at: '2026-09-02T00:00:00Z' },
      { id: 'm-3', home_id: 'other-home', task: 'Not mine', status: 'scheduled', recurrence: 'one_time' },
    ]);

    const { data: tasks } = await supabaseAdmin
      .from('HomeMaintenanceLog')
      .select('*')
      .eq('home_id', homeId)
      .order('due_date', { ascending: true });

    expect(tasks).toHaveLength(2);
    expect(tasks.map(t => t.id).sort()).toEqual(['m-1', 'm-2']);
  });

  test('supports status filter', async () => {
    seedTable('HomeMaintenanceLog', [
      { id: 'm-1', home_id: homeId, task: 'Sched', status: 'scheduled', recurrence: 'one_time' },
      { id: 'm-2', home_id: homeId, task: 'In progress', status: 'in_progress', recurrence: 'one_time' },
      { id: 'm-3', home_id: homeId, task: 'Done', status: 'completed', recurrence: 'one_time' },
    ]);

    const { data: completed } = await supabaseAdmin
      .from('HomeMaintenanceLog')
      .select('*')
      .eq('home_id', homeId)
      .eq('status', 'completed');

    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe('m-3');
  });

  test('member-of-home has list access (home.view)', async () => {
    const ownerAccess = await checkHomePermission(homeId, ownerId);
    expect(ownerAccess.hasAccess).toBe(true);
    const memberAccess = await checkHomePermission(homeId, memberId);
    expect(memberAccess.hasAccess).toBe(true);
  });

  test('non-member is denied list access', async () => {
    const outsiderAccess = await checkHomePermission(homeId, outsiderId);
    expect(outsiderAccess.hasAccess).toBe(false);
  });
});

// ── Create ──────────────────────────────────────────────────

describe('POST /api/homes/:id/maintenance — create', () => {
  beforeEach(() => {
    seedHome();
    seedOccupancy(ownerId, 'owner');
    seedOccupancy(memberId, 'member');
    seedStandardPermissions();
  });

  test('inserts a task with all fields and stamps created_by', async () => {
    const payload = {
      home_id: homeId,
      task: 'Chimney sweep + inspection',
      vendor: 'Soot Bros NYC',
      cost: 295,
      recurrence: 'yearly',
      due_date: '2026-11-08T15:00:00Z',
      status: 'scheduled',
      created_by: ownerId,
    };
    const { data: created } = await supabaseAdmin
      .from('HomeMaintenanceLog')
      .insert(payload)
      .select()
      .single();

    expect(created.task).toBe('Chimney sweep + inspection');
    expect(created.vendor).toBe('Soot Bros NYC');
    expect(Number(created.cost)).toBe(295);
    expect(created.recurrence).toBe('yearly');
    expect(created.status).toBe('scheduled');
    expect(created.created_by).toBe(ownerId);

    const stored = getTable('HomeMaintenanceLog');
    expect(stored).toHaveLength(1);
    expect(stored[0].task).toBe('Chimney sweep + inspection');
  });

  test('owner has home.edit; member does not', async () => {
    expect(await hasPermission(homeId, ownerId, 'home.edit')).toBe(true);
    expect(await hasPermission(homeId, memberId, 'home.edit')).toBe(false);
  });

  test('outsider is denied create (no access)', async () => {
    const access = await checkHomePermission(homeId, outsiderId, 'home.edit');
    expect(access.hasAccess).toBe(false);
  });

  test('DIY (no vendor) task is valid', async () => {
    const payload = {
      home_id: homeId,
      task: 'Smoke & CO alarm test',
      vendor: null,
      cost: 0,
      recurrence: 'quarterly',
      status: 'scheduled',
      created_by: memberId,
    };
    const { data: created } = await supabaseAdmin
      .from('HomeMaintenanceLog')
      .insert(payload)
      .select()
      .single();

    expect(created.vendor).toBeNull();
    expect(created.recurrence).toBe('quarterly');
  });
});

// ── Update ──────────────────────────────────────────────────

describe('PUT /api/homes/:id/maintenance/:taskId — update', () => {
  beforeEach(() => {
    seedHome();
    seedOccupancy(ownerId, 'owner');
    seedOccupancy(memberId, 'member');
    seedStandardPermissions();
    seedTable('HomeMaintenanceLog', [{
      id: 'm-1',
      home_id: homeId,
      task: 'HVAC tune-up',
      vendor: 'Riverside HVAC',
      cost: 185,
      recurrence: 'yearly',
      status: 'scheduled',
      due_date: '2026-10-15T08:00:00Z',
      created_at: '2026-09-01T00:00:00Z',
      created_by: ownerId,
    }]);
  });

  test('updates a single field and bumps updated_at', async () => {
    const newUpdatedAt = '2026-10-12T00:00:00Z';
    const { data: updated } = await supabaseAdmin
      .from('HomeMaintenanceLog')
      .update({ status: 'in_progress', updated_at: newUpdatedAt })
      .eq('id', 'm-1')
      .eq('home_id', homeId)
      .select()
      .single();

    expect(updated.status).toBe('in_progress');
    expect(updated.updated_at).toBe(newUpdatedAt);
    expect(updated.task).toBe('HVAC tune-up'); // unchanged
  });

  test('marking completed stamps performed_at + performed_by', async () => {
    const completedAt = '2026-10-15T10:30:00Z';
    const { data: updated } = await supabaseAdmin
      .from('HomeMaintenanceLog')
      .update({
        status: 'completed',
        performed_at: completedAt,
        performed_by: ownerId,
        updated_at: completedAt,
      })
      .eq('id', 'm-1')
      .eq('home_id', homeId)
      .select()
      .single();

    expect(updated.status).toBe('completed');
    expect(updated.performed_at).toBe(completedAt);
    expect(updated.performed_by).toBe(ownerId);
  });

  test('update in wrong home returns null', async () => {
    const { data } = await supabaseAdmin
      .from('HomeMaintenanceLog')
      .update({ status: 'completed' })
      .eq('id', 'm-1')
      .eq('home_id', 'other-home')
      .select()
      .single();

    expect(data).toBeNull();
    // Original status unchanged.
    expect(getTable('HomeMaintenanceLog')[0].status).toBe('scheduled');
  });
});

// ── Delete ──────────────────────────────────────────────────

describe('DELETE /api/homes/:id/maintenance/:taskId — delete', () => {
  beforeEach(() => {
    seedHome();
    seedOccupancy(ownerId, 'owner');
    seedStandardPermissions();
    seedTable('HomeMaintenanceLog', [
      { id: 'm-1', home_id: homeId, task: 'HVAC', status: 'scheduled', recurrence: 'yearly' },
      { id: 'm-2', home_id: homeId, task: 'Gutter clean', status: 'scheduled', recurrence: 'yearly' },
    ]);
  });

  test('removes the row when scoped to the right home', async () => {
    await supabaseAdmin
      .from('HomeMaintenanceLog')
      .delete()
      .eq('id', 'm-1')
      .eq('home_id', homeId);

    const remaining = getTable('HomeMaintenanceLog');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('m-2');
  });

  test('delete scoped to wrong home is a no-op', async () => {
    await supabaseAdmin
      .from('HomeMaintenanceLog')
      .delete()
      .eq('id', 'm-1')
      .eq('home_id', 'other-home');

    const remaining = getTable('HomeMaintenanceLog');
    expect(remaining).toHaveLength(2);
  });
});

// ── Authz check ─────────────────────────────────────────────

describe('authz — member-of-home check', () => {
  beforeEach(() => {
    seedHome();
    seedOccupancy(ownerId, 'owner');
    seedOccupancy(memberId, 'member');
    seedStandardPermissions();
  });

  test('owner has read + write', async () => {
    const read = await checkHomePermission(homeId, ownerId);
    const write = await checkHomePermission(homeId, ownerId, 'home.edit');
    expect(read.hasAccess).toBe(true);
    expect(write.hasAccess).toBe(true);
  });

  test('member has read but not write', async () => {
    const read = await checkHomePermission(homeId, memberId);
    const write = await checkHomePermission(homeId, memberId, 'home.edit');
    expect(read.hasAccess).toBe(true);
    expect(write.hasAccess).toBe(false);
  });

  test('outsider has no access at all', async () => {
    const read = await checkHomePermission(homeId, outsiderId);
    const write = await checkHomePermission(homeId, outsiderId, 'home.edit');
    expect(read.hasAccess).toBe(false);
    expect(write.hasAccess).toBe(false);
  });
});
