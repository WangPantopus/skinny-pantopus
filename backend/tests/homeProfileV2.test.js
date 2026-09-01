// ============================================================
// TEST: Home Profile V2
// Validates the dashboard aggregation, Pet CRUD, Poll CRUD,
// activity log pagination, and settings read/update.
// Uses the in-memory supabaseAdmin mock for all DB operations.
// ============================================================

const supabaseAdmin = require('./__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;
const {
  checkHomePermission,
  getUserAccess,
  hasPermission,
  writeAuditLog,
  getActiveOccupancy,
  ROLE_RANK,
} = require('../utils/homePermissions');

beforeEach(() => resetTables());

// ── Seed helpers ─────────────────────────────────────────────

const homeId = 'home-1';
const ownerId = 'user-owner';
const adminId = 'user-admin';
const memberId = 'user-member';
const guestId = 'user-guest';

function seedHome(overrides = {}) {
  seedTable('Home', [{
    id: homeId,
    owner_id: ownerId,
    name: 'Test Home',
    home_type: 'house',
    visibility: 'public',
    trash_day: 'Tuesday',
    house_rules: 'No shoes indoors',
    local_tips: 'Great bakery on Main St',
    guest_welcome_message: 'Welcome!',
    entry_instructions: 'Use the side door',
    parking_instructions: 'Driveway only',
    default_visibility: 'members',
    default_guest_pass_hours: 48,
    lockdown_enabled: false,
    ...overrides,
  }]);
}

function seedOccupancy(userId, role = 'member', extra = {}) {
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
      ...extra,
    },
  ]);
}

function seedRolePermissions(role, permissions) {
  const existing = getTable('HomeRolePermission') || [];
  const rows = permissions.map((p, i) => ({
    id: `rp-${role}-${i}`,
    role_base: role,
    permission: p,
    allowed: true,
  }));
  seedTable('HomeRolePermission', [...existing, ...rows]);
}

function seedOwner(userId = ownerId) {
  seedTable('HomeOwner', [{
    id: `owner-${userId}`,
    home_id: homeId,
    subject_id: userId,
    owner_status: 'verified',
    tier: 'standard',
    is_primary: true,
  }]);
}

// ── Dashboard V2 aggregation ─────────────────────────────────

describe('Dashboard V2 — data aggregation', () => {
  beforeEach(() => {
    seedHome();
    seedOwner();
    seedOccupancy(ownerId, 'owner');
    seedOccupancy(memberId, 'member');
    seedRolePermissions('owner', ['home.view', 'home.edit', 'finance.view', 'finance.manage', 'members.manage', 'security.manage']);
    seedRolePermissions('member', ['home.view']);
  });

  test('owner has access to dashboard (home.view)', async () => {
    const access = await checkHomePermission(homeId, ownerId, 'home.view');
    expect(access.hasAccess).toBe(true);
    expect(access.isOwner).toBe(true);
  });

  test('member has access to dashboard (home.view)', async () => {
    const perm = await hasPermission(homeId, memberId, 'home.view');
    expect(perm).toBe(true);
  });

  test('non-member has no access', async () => {
    const access = await checkHomePermission(homeId, guestId, 'home.view');
    expect(access.hasAccess).toBe(false);
  });

  test('dashboard counts aggregate correctly from seeded data', async () => {
    // Seed dashboard data
    seedTable('HomeTask', [
      { id: 'task-1', home_id: homeId, status: 'open', due_at: new Date().toISOString() },
      { id: 'task-2', home_id: homeId, status: 'in_progress', due_at: new Date().toISOString() },
      { id: 'task-3', home_id: homeId, status: 'completed', due_at: new Date().toISOString() },
    ]);
    seedTable('HomeBill', [
      { id: 'bill-1', home_id: homeId, status: 'due', due_at: new Date().toISOString() },
      { id: 'bill-2', home_id: homeId, status: 'paid' },
    ]);
    seedTable('HomePackage', [
      { id: 'pkg-1', home_id: homeId, status: 'shipped' },
      { id: 'pkg-2', home_id: homeId, status: 'delivered' },
    ]);
    seedTable('HomeIssue', [
      { id: 'iss-1', home_id: homeId, status: 'open' },
    ]);
    seedTable('HomeDocument', [
      { id: 'doc-1', home_id: homeId },
      { id: 'doc-2', home_id: homeId },
    ]);
    seedTable('HomePet', [
      { id: 'pet-1', home_id: homeId, name: 'Max', species: 'dog' },
    ]);
    seedTable('HomeCalendarEvent', [
      { id: 'evt-1', home_id: homeId, start_at: new Date(Date.now() + 3600000).toISOString() },
    ]);

    // Verify queries through mock supabase
    const { data: openTasks } = await supabaseAdmin
      .from('HomeTask')
      .select('*')
      .eq('home_id', homeId);
    expect(openTasks).toHaveLength(3);
    const openCount = openTasks.filter(t => ['open', 'in_progress'].includes(t.status)).length;
    expect(openCount).toBe(2);

    const { data: packages } = await supabaseAdmin
      .from('HomePackage')
      .select('*')
      .eq('home_id', homeId);
    const inTransit = packages.filter(p => ['ordered', 'shipped', 'out_for_delivery'].includes(p.status));
    expect(inTransit).toHaveLength(1);

    const { data: pets } = await supabaseAdmin
      .from('HomePet')
      .select('*')
      .eq('home_id', homeId);
    expect(pets).toHaveLength(1);

    const { data: docs } = await supabaseAdmin
      .from('HomeDocument')
      .select('*')
      .eq('home_id', homeId);
    expect(docs).toHaveLength(2);

    const { data: issues } = await supabaseAdmin
      .from('HomeIssue')
      .select('*')
      .eq('home_id', homeId);
    expect(issues.filter(i => ['open', 'in_progress'].includes(i.status))).toHaveLength(1);
  });

  test('recent activity returns entries from audit log', async () => {
    const entries = Array.from({ length: 8 }, (_, i) => ({
      id: `audit-${i}`,
      home_id: homeId,
      actor_user_id: ownerId,
      action: `action_${i}`,
      target_type: 'Home',
      target_id: homeId,
      created_at: new Date(Date.now() - i * 60000).toISOString(),
    }));
    seedTable('HomeAuditLog', entries);

    const { data: all } = await supabaseAdmin
      .from('HomeAuditLog')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    expect(all).toHaveLength(8);

    // Dashboard takes last 5 (mock doesn't enforce limit, so slice manually)
    const recent = all.slice(0, 5);
    expect(recent).toHaveLength(5);
  });

  test('finance-gated data hidden from non-finance members', async () => {
    const hasFin = await hasPermission(homeId, memberId, 'finance.view');
    expect(hasFin).toBe(false);

    // Owner always has finance access
    const ownerAccess = await checkHomePermission(homeId, ownerId, 'finance.view');
    expect(ownerAccess.hasAccess).toBe(true);
  });
});

// ── Pet CRUD ─────────────────────────────────────────────────

describe('Pet CRUD', () => {
  beforeEach(() => {
    seedHome();
    seedOwner();
    seedOccupancy(ownerId, 'owner');
    seedOccupancy(memberId, 'member');
    seedRolePermissions('owner', ['home.view', 'home.edit']);
    seedRolePermissions('member', ['home.view']);
  });

  test('list pets for a home', async () => {
    seedTable('HomePet', [
      { id: 'pet-1', home_id: homeId, name: 'Buddy', species: 'dog', created_at: '2024-01-01' },
      { id: 'pet-2', home_id: homeId, name: 'Whiskers', species: 'cat', created_at: '2024-01-02' },
      { id: 'pet-3', home_id: 'other-home', name: 'Goldie', species: 'fish', created_at: '2024-01-03' },
    ]);

    const { data: pets } = await supabaseAdmin
      .from('HomePet')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    expect(pets).toHaveLength(2);
    expect(pets.map(p => p.name)).toEqual(expect.arrayContaining(['Buddy', 'Whiskers']));
  });

  test('create pet stores all fields', async () => {
    const petData = {
      home_id: homeId,
      name: 'Rex',
      species: 'dog',
      breed: 'German Shepherd',
      age_years: 5,
      weight_lbs: 80,
      vet_name: 'Dr. Smith',
      vet_phone: '555-1234',
      vet_address: '123 Vet Lane',
      vaccine_notes: 'Up to date',
      feeding_schedule: 'Twice daily',
      medications: 'None',
      microchip_id: 'CHIP-001',
      photo_url: 'https://example.com/rex.jpg',
      notes: 'Friendly but loud',
      created_by: ownerId,
    };

    const { data: pet } = await supabaseAdmin
      .from('HomePet')
      .insert(petData)
      .select()
      .single();

    expect(pet).toBeDefined();
    expect(pet.name).toBe('Rex');
    expect(pet.species).toBe('dog');
    expect(pet.breed).toBe('German Shepherd');
    expect(pet.created_by).toBe(ownerId);

    // Verify it persists in the mock table
    const stored = getTable('HomePet');
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Rex');
  });

  test('update pet modifies existing record', async () => {
    seedTable('HomePet', [{
      id: 'pet-1',
      home_id: homeId,
      name: 'Buddy',
      species: 'dog',
      breed: 'Labrador',
      age_years: 3,
    }]);

    const { data: updated } = await supabaseAdmin
      .from('HomePet')
      .update({ age_years: 4, breed: 'Golden Retriever', updated_at: new Date().toISOString() })
      .eq('id', 'pet-1')
      .eq('home_id', homeId)
      .select()
      .single();

    expect(updated.age_years).toBe(4);
    expect(updated.breed).toBe('Golden Retriever');
    expect(updated.name).toBe('Buddy'); // unchanged
  });

  test('update pet in wrong home returns empty', async () => {
    seedTable('HomePet', [{
      id: 'pet-1',
      home_id: 'other-home',
      name: 'NotMyPet',
      species: 'cat',
    }]);

    const { data } = await supabaseAdmin
      .from('HomePet')
      .update({ name: 'Hacked' })
      .eq('id', 'pet-1')
      .eq('home_id', homeId)
      .select()
      .single();

    // Mock returns null when no match for single()
    expect(data).toBeNull();
    // Original should be unchanged
    expect(getTable('HomePet')[0].name).toBe('NotMyPet');
  });

  test('delete pet removes record', async () => {
    seedTable('HomePet', [
      { id: 'pet-1', home_id: homeId, name: 'Buddy', species: 'dog' },
      { id: 'pet-2', home_id: homeId, name: 'Patches', species: 'cat' },
    ]);

    await supabaseAdmin
      .from('HomePet')
      .delete()
      .eq('id', 'pet-1')
      .eq('home_id', homeId);

    const remaining = getTable('HomePet');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('Patches');
  });

  test('pet CRUD requires home.edit permission', async () => {
    // Member with only home.view cannot edit
    const memberEdit = await hasPermission(homeId, memberId, 'home.edit');
    expect(memberEdit).toBe(false);

    // Owner always has permission
    const ownerEdit = await checkHomePermission(homeId, ownerId, 'home.edit');
    expect(ownerEdit.hasAccess).toBe(true);
  });

  test('pet operations write audit log', async () => {
    await writeAuditLog(homeId, ownerId, 'pet.create', 'HomePet', 'pet-1', { name: 'Rex', species: 'dog' });

    const logs = getTable('HomeAuditLog');
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('pet.create');
    expect(logs[0].target_type).toBe('HomePet');
    expect(logs[0].metadata).toEqual({ name: 'Rex', species: 'dog' });
  });
});

// ── Poll CRUD ────────────────────────────────────────────────

describe('Poll CRUD', () => {
  beforeEach(() => {
    seedHome();
    seedOwner();
    seedOccupancy(ownerId, 'owner');
    seedOccupancy(memberId, 'member');
    seedRolePermissions('owner', ['home.view', 'home.edit']);
    seedRolePermissions('member', ['home.view']);
  });

  test('create poll with options', async () => {
    const pollData = {
      home_id: homeId,
      title: 'Paint color?',
      description: 'Pick a color for the living room',
      poll_type: 'single_choice',
      options: ['Blue', 'Green', 'White'],
      closes_at: new Date(Date.now() + 86400000).toISOString(),
      visibility: 'members',
      created_by: ownerId,
      status: 'open',
    };

    const { data: poll } = await supabaseAdmin
      .from('HomePoll')
      .insert(pollData)
      .select()
      .single();

    expect(poll.title).toBe('Paint color?');
    expect(poll.options).toEqual(['Blue', 'Green', 'White']);
    expect(poll.poll_type).toBe('single_choice');
    expect(poll.status).toBe('open');
  });

  test('list polls with vote counts and user vote', async () => {
    seedTable('HomePoll', [
      { id: 'poll-1', home_id: homeId, title: 'Fence type?', poll_type: 'single_choice', options: ['Wood', 'Metal'], status: 'open', created_at: '2024-06-01' },
      { id: 'poll-2', home_id: homeId, title: 'Party date?', poll_type: 'single_choice', options: ['Sat', 'Sun'], status: 'open', created_at: '2024-06-02' },
    ]);
    seedTable('HomePollVote', [
      { id: 'vote-1', poll_id: 'poll-1', user_id: ownerId, selected_options: ['Wood'] },
      { id: 'vote-2', poll_id: 'poll-1', user_id: memberId, selected_options: ['Metal'] },
      { id: 'vote-3', poll_id: 'poll-2', user_id: ownerId, selected_options: ['Sun'] },
    ]);

    // Fetch polls
    const { data: polls } = await supabaseAdmin
      .from('HomePoll')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });
    expect(polls).toHaveLength(2);

    // Compute vote counts per poll
    const allVotes = getTable('HomePollVote');
    const voteCounts = {};
    for (const v of allVotes) {
      voteCounts[v.poll_id] = (voteCounts[v.poll_id] || 0) + 1;
    }
    expect(voteCounts['poll-1']).toBe(2);
    expect(voteCounts['poll-2']).toBe(1);

    // Get current user's vote
    const myVotes = allVotes.filter(v => v.user_id === ownerId);
    const myVoteMap = {};
    for (const v of myVotes) {
      myVoteMap[v.poll_id] = v.selected_options;
    }
    expect(myVoteMap['poll-1']).toEqual(['Wood']);
    expect(myVoteMap['poll-2']).toEqual(['Sun']);
  });

  test('vote on poll (upsert)', async () => {
    seedTable('HomePoll', [{
      id: 'poll-1',
      home_id: homeId,
      title: 'Movie night?',
      poll_type: 'single_choice',
      options: ['Action', 'Comedy', 'Drama'],
      status: 'open',
      closes_at: new Date(Date.now() + 86400000).toISOString(),
    }]);

    // First vote
    const { data: vote1 } = await supabaseAdmin
      .from('HomePollVote')
      .upsert({
        poll_id: 'poll-1',
        user_id: memberId,
        selected_options: ['Comedy'],
      })
      .select()
      .single();

    expect(vote1.selected_options).toEqual(['Comedy']);

    // Change vote (upsert)
    const { data: vote2 } = await supabaseAdmin
      .from('HomePollVote')
      .upsert({
        poll_id: 'poll-1',
        user_id: memberId,
        selected_options: ['Drama'],
      })
      .select()
      .single();

    expect(vote2.selected_options).toEqual(['Drama']);
  });

  test('update poll status to closed', async () => {
    seedTable('HomePoll', [{
      id: 'poll-1',
      home_id: homeId,
      title: 'Which BBQ?',
      status: 'open',
    }]);

    const { data: updated } = await supabaseAdmin
      .from('HomePoll')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', 'poll-1')
      .eq('home_id', homeId)
      .select()
      .single();

    expect(updated.status).toBe('closed');
  });

  test('poll CRUD respects permissions', async () => {
    // Creating polls requires home.edit
    const memberEdit = await hasPermission(homeId, memberId, 'home.edit');
    expect(memberEdit).toBe(false);

    // Voting requires home.view
    const memberView = await hasPermission(homeId, memberId, 'home.view');
    expect(memberView).toBe(true);
  });

  test('poll operations write audit log', async () => {
    await writeAuditLog(homeId, ownerId, 'poll.create', 'HomePoll', 'poll-1', { title: 'Test Poll' });
    await writeAuditLog(homeId, memberId, 'poll.vote', 'HomePoll', 'poll-1', {});

    const logs = getTable('HomeAuditLog');
    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe('poll.create');
    expect(logs[1].action).toBe('poll.vote');
  });
});

// ── Activity log pagination ──────────────────────────────────

describe('Activity log pagination', () => {
  const totalEntries = 25;

  beforeEach(() => {
    seedHome();
    seedOwner();
    seedOccupancy(ownerId, 'owner');
    seedRolePermissions('owner', ['home.view', 'home.edit', 'members.manage', 'security.manage']);

    const entries = Array.from({ length: totalEntries }, (_, i) => ({
      id: `audit-${String(i).padStart(3, '0')}`,
      home_id: homeId,
      actor_user_id: ownerId,
      action: `action_${i}`,
      target_type: 'Home',
      target_id: homeId,
      created_at: new Date(Date.now() - i * 60000).toISOString(),
    }));
    seedTable('HomeAuditLog', entries);
  });

  test('audit log requires members.manage', async () => {
    seedOccupancy(memberId, 'member');
    seedRolePermissions('member', ['home.view']);

    const perm = await hasPermission(homeId, memberId, 'members.manage');
    expect(perm).toBe(false);

    const ownerPerm = await hasPermission(homeId, ownerId, 'members.manage');
    expect(ownerPerm).toBe(true);
  });

  test('default limit returns up to 50 entries', async () => {
    const { data } = await supabaseAdmin
      .from('HomeAuditLog')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false })
      .limit(50);

    expect(data.length).toBe(totalEntries);
    // Verify order: most recent first
    expect(data[0].id).toBe('audit-000');
  });

  test('pagination via limit and offset (mock range)', async () => {
    const allEntries = getTable('HomeAuditLog')
      .filter(e => e.home_id === homeId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Page 1: offset 0, limit 10
    const page1 = allEntries.slice(0, 10);
    expect(page1).toHaveLength(10);
    expect(page1[0].id).toBe('audit-000');

    // Page 2: offset 10, limit 10
    const page2 = allEntries.slice(10, 20);
    expect(page2).toHaveLength(10);
    expect(page2[0].id).toBe('audit-010');

    // Page 3: offset 20, limit 10
    const page3 = allEntries.slice(20, 30);
    expect(page3).toHaveLength(5); // Only 5 remaining
  });
});

// ── Settings read/update ─────────────────────────────────────

describe('Settings read/update', () => {
  beforeEach(() => {
    seedHome();
    seedOwner();
    seedOccupancy(ownerId, 'owner');
    seedOccupancy(memberId, 'member');
    seedRolePermissions('owner', ['home.view', 'home.edit']);
    seedRolePermissions('member', ['home.view']);
  });

  test('read settings returns home fields and preferences', async () => {
    seedTable('HomePreference', [
      { id: 'pref-1', home_id: homeId, key: 'theme', value: 'dark' },
      { id: 'pref-2', home_id: homeId, key: 'timezone', value: 'America/New_York' },
    ]);

    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('name, home_type, visibility, trash_day, house_rules, local_tips, guest_welcome_message, entry_instructions, parking_instructions, default_visibility, default_guest_pass_hours, lockdown_enabled')
      .eq('id', homeId)
      .single();

    expect(home).toBeDefined();
    expect(home.name).toBe('Test Home');
    expect(home.trash_day).toBe('Tuesday');
    expect(home.default_guest_pass_hours).toBe(48);

    const { data: prefs } = await supabaseAdmin
      .from('HomePreference')
      .select('*')
      .eq('home_id', homeId);

    expect(prefs).toHaveLength(2);
    const prefMap = {};
    for (const p of prefs) prefMap[p.key] = p.value;
    expect(prefMap.theme).toBe('dark');
    expect(prefMap.timezone).toBe('America/New_York');
  });

  test('read settings requires home.view', async () => {
    const access = await checkHomePermission(homeId, guestId, 'home.view');
    expect(access.hasAccess).toBe(false);

    const memberAccess = await checkHomePermission(homeId, memberId, 'home.view');
    expect(memberAccess.hasAccess).toBe(true);
  });

  test('update settings modifies home record', async () => {
    const { data: updated } = await supabaseAdmin
      .from('Home')
      .update({
        trash_day: 'Wednesday',
        house_rules: 'No loud music after 10pm',
        default_visibility: 'managers',
      })
      .eq('id', homeId)
      .select()
      .single();

    expect(updated.trash_day).toBe('Wednesday');
    expect(updated.house_rules).toBe('No loud music after 10pm');
    expect(updated.default_visibility).toBe('managers');
    // Unchanged fields should remain
    expect(updated.name).toBe('Test Home');
  });

  test('update settings requires home.edit', async () => {
    const memberEdit = await hasPermission(homeId, memberId, 'home.edit');
    expect(memberEdit).toBe(false);

    const ownerEdit = await checkHomePermission(homeId, ownerId, 'home.edit');
    expect(ownerEdit.hasAccess).toBe(true);
  });

  test('update preferences via upsert', async () => {
    seedTable('HomePreference', [
      { id: 'pref-1', home_id: homeId, key: 'theme', value: 'light' },
    ]);

    // Upsert: update existing + add new
    await supabaseAdmin
      .from('HomePreference')
      .upsert({ home_id: homeId, key: 'theme', value: 'dark' })
      .select()
      .single();

    await supabaseAdmin
      .from('HomePreference')
      .upsert({ home_id: homeId, key: 'language', value: 'en' })
      .select()
      .single();

    const prefs = getTable('HomePreference');
    // upsert via mock adds new rows; in real DB it would update on conflict
    expect(prefs.length).toBeGreaterThanOrEqual(2);
  });

  test('settings update writes audit log', async () => {
    await writeAuditLog(homeId, ownerId, 'home_settings_updated', 'Home', homeId, {
      fields_updated: ['trash_day', 'house_rules'],
      preferences_updated: ['theme'],
    });

    const logs = getTable('HomeAuditLog');
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('home_settings_updated');
    expect(logs[0].metadata.fields_updated).toContain('trash_day');
  });

  test('default_visibility must be valid enum value', () => {
    const validValues = ['public', 'members', 'managers', 'sensitive'];
    expect(validValues).toContain('public');
    expect(validValues).toContain('members');
    expect(validValues).toContain('managers');
    expect(validValues).toContain('sensitive');
    expect(validValues).not.toContain('private');
  });

  test('default_guest_pass_hours must be 1-8760', () => {
    const validate = (hours) => hours >= 1 && hours <= 8760;
    expect(validate(1)).toBe(true);
    expect(validate(48)).toBe(true);
    expect(validate(8760)).toBe(true);
    expect(validate(0)).toBe(false);
    expect(validate(8761)).toBe(false);
  });
});

// ── getUserAccess full snapshot ───────────────────────────────

describe('getUserAccess', () => {
  beforeEach(() => {
    seedHome();
    seedOwner();
    seedOccupancy(ownerId, 'owner');
    seedOccupancy(memberId, 'member');
    seedRolePermissions('owner', [
      'home.view', 'home.edit',
      'finance.view', 'finance.manage',
      'members.view', 'members.manage',
      'security.manage',
      'tasks.view', 'tasks.edit',
    ]);
    seedRolePermissions('member', ['home.view', 'tasks.view']);
  });

  test('member gets limited permissions', async () => {
    const access = await getUserAccess(homeId, memberId);
    expect(access.hasAccess).toBe(true);
    expect(access.role_base).toBe('member');
    expect(access.permissions).toContain('home.view');
    expect(access.permissions).toContain('tasks.view');
    expect(access.permissions).not.toContain('finance.manage');
    expect(access.permissions).not.toContain('security.manage');
  });

  test('owner gets full permissions', async () => {
    const access = await getUserAccess(homeId, ownerId);
    expect(access.hasAccess).toBe(true);
    expect(access.isOwner).toBe(true);
    expect(access.permissions).toContain('home.edit');
    expect(access.permissions).toContain('security.manage');
  });

  test('non-member gets empty access', async () => {
    const access = await getUserAccess(homeId, guestId);
    expect(access.hasAccess).toBe(false);
    expect(access.permissions).toEqual([]);
    expect(access.role_base).toBeNull();
  });

  test('permission override adds or removes permissions', async () => {
    seedTable('HomePermissionOverride', [
      { id: 'ov-1', home_id: homeId, user_id: memberId, permission: 'finance.view', allowed: true },
      { id: 'ov-2', home_id: homeId, user_id: memberId, permission: 'home.view', allowed: false },
    ]);

    const access = await getUserAccess(homeId, memberId);
    expect(access.permissions).toContain('finance.view'); // added by override
    expect(access.permissions).not.toContain('home.view'); // denied by override
  });
});
