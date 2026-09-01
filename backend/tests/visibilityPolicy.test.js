// ============================================================
// TEST: Visibility Policy
// Validates the two-graph visibility system: residency (Home)
// and trust (Connections / Relationships).
// ============================================================

const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');
const {
  getRelationshipStatus,
  isConnected,
  isBlocked,
  isHomeMember,
  shareHome,
  canViewContent,
  getProfileVisibility,
  canMessageUser,
} = require('../utils/visibilityPolicy');

beforeEach(() => resetTables());

// ── getRelationshipStatus ───────────────────────────────────
describe('getRelationshipStatus', () => {
  test('returns "none" when no relationship', async () => {
    seedTable('Relationship', []);
    expect(await getRelationshipStatus('a', 'b')).toBe('none');
  });

  test('returns "connected" for accepted', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'accepted',
    }]);
    expect(await getRelationshipStatus('a', 'b')).toBe('connected');
  });

  test('returns "pending_sent" from requester perspective', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'pending',
    }]);
    expect(await getRelationshipStatus('a', 'b')).toBe('pending_sent');
  });

  test('returns "pending_received" from addressee perspective', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'pending',
    }]);
    expect(await getRelationshipStatus('b', 'a')).toBe('pending_received');
  });

  test('returns "blocked" for blocked status', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'blocked', blocked_by: 'a',
    }]);
    expect(await getRelationshipStatus('a', 'b')).toBe('blocked');
  });

  test('returns "none" for self', async () => {
    expect(await getRelationshipStatus('a', 'a')).toBe('none');
  });
});

// ── isConnected / isBlocked (derived) ───────────────────────
describe('isConnected', () => {
  test('returns true for accepted relationship', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'accepted',
    }]);
    expect(await isConnected('a', 'b')).toBe(true);
  });

  test('returns false for pending', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'pending',
    }]);
    expect(await isConnected('a', 'b')).toBe(false);
  });
});

describe('isBlocked', () => {
  test('returns true for blocked relationship', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'blocked', blocked_by: 'a',
    }]);
    expect(await isBlocked('a', 'b')).toBe(true);
  });
});

// ── isHomeMember ────────────────────────────────────────────
describe('isHomeMember', () => {
  test('returns true for active occupancy with null end_at', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-1', user_id: 'u1', home_id: 'h1', is_active: true, end_at: null,
    }]);
    expect(await isHomeMember('u1', 'h1')).toBe(true);
  });

  test('returns false for inactive occupancy', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-1', user_id: 'u1', home_id: 'h1', is_active: false, end_at: null,
    }]);
    expect(await isHomeMember('u1', 'h1')).toBe(false);
  });

  test('returns false for null inputs', async () => {
    expect(await isHomeMember(null, 'h1')).toBe(false);
    expect(await isHomeMember('u1', null)).toBe(false);
  });
});

// ── shareHome ───────────────────────────────────────────────
describe('shareHome', () => {
  test('returns true when two users share an active home', async () => {
    seedTable('HomeOccupancy', [
      { id: 'occ-1', user_id: 'a', home_id: 'h1', is_active: true, end_at: null },
      { id: 'occ-2', user_id: 'b', home_id: 'h1', is_active: true, end_at: null },
    ]);
    expect(await shareHome('a', 'b')).toBe(true);
  });

  test('returns false when users are in different homes', async () => {
    seedTable('HomeOccupancy', [
      { id: 'occ-1', user_id: 'a', home_id: 'h1', is_active: true, end_at: null },
      { id: 'occ-2', user_id: 'b', home_id: 'h2', is_active: true, end_at: null },
    ]);
    expect(await shareHome('a', 'b')).toBe(false);
  });

  test('returns false for self', async () => {
    expect(await shareHome('a', 'a')).toBe(false);
  });
});

// ── canViewContent ──────────────────────────────────────────
describe('canViewContent', () => {
  test('owner can always see own content', async () => {
    const post = { user_id: 'a', visibility: 'private' };
    expect(await canViewContent('a', post)).toBe(true);
  });

  test('public content visible to anyone (not blocked)', async () => {
    seedTable('Relationship', []);
    const post = { user_id: 'a', visibility: 'public' };
    expect(await canViewContent('b', post)).toBe(true);
  });

  test('public content hidden from blocked users', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'blocked', blocked_by: 'a',
    }]);
    const post = { user_id: 'a', visibility: 'public' };
    expect(await canViewContent('b', post)).toBe(false);
  });

  test('legacy "followers" visibility visible to connections', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'accepted',
    }]);
    seedTable('HomeOccupancy', []);
    const post = { user_id: 'a', visibility: 'followers' };
    expect(await canViewContent('b', post)).toBe(true);
  });

  test('legacy "followers" visibility hidden from non-connections', async () => {
    seedTable('Relationship', []);
    seedTable('HomeOccupancy', []);
    const post = { user_id: 'a', visibility: 'followers' };
    expect(await canViewContent('b', post)).toBe(false);
  });

  test('connections content visible to connections', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'accepted',
    }]);
    seedTable('HomeOccupancy', []);
    const post = { user_id: 'a', visibility: 'connections' };
    expect(await canViewContent('b', post)).toBe(true);
  });

  test('connections content hidden from non-connections', async () => {
    seedTable('Relationship', []);
    seedTable('HomeOccupancy', []);
    const post = { user_id: 'a', visibility: 'connections' };
    expect(await canViewContent('b', post)).toBe(false);
  });

  test('private content hidden from everyone', async () => {
    const post = { user_id: 'a', visibility: 'private' };
    expect(await canViewContent('b', post)).toBe(false);
  });

  test('home content visible only to home members', async () => {
    seedTable('HomeOccupancy', [
      { id: 'occ-1', user_id: 'b', home_id: 'h1', is_active: true, end_at: null },
    ]);
    const post = { user_id: 'a', visibility: 'home', home_id: 'h1' };
    expect(await canViewContent('b', post)).toBe(true);
  });

  test('home content without home_id returns false', async () => {
    const post = { user_id: 'a', visibility: 'home', home_id: null };
    expect(await canViewContent('b', post)).toBe(false);
  });
});

// ── getProfileVisibility ────────────────────────────────────
describe('getProfileVisibility', () => {
  test('self = full', async () => {
    expect(await getProfileVisibility('a', 'a')).toBe('full');
  });

  test('blocked = blocked', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'blocked', blocked_by: 'a',
    }]);
    seedTable('HomeOccupancy', []);
    expect(await getProfileVisibility('b', 'a')).toBe('blocked');
  });

  test('housemate = full', async () => {
    seedTable('Relationship', []);
    seedTable('HomeOccupancy', [
      { id: 'occ-1', user_id: 'a', home_id: 'h1', is_active: true, end_at: null },
      { id: 'occ-2', user_id: 'b', home_id: 'h1', is_active: true, end_at: null },
    ]);
    expect(await getProfileVisibility('a', 'b')).toBe('full');
  });

  test('connection = connected', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'accepted',
    }]);
    seedTable('HomeOccupancy', []);
    expect(await getProfileVisibility('a', 'b')).toBe('connected');
  });

  test('stranger = public', async () => {
    seedTable('Relationship', []);
    seedTable('HomeOccupancy', []);
    expect(await getProfileVisibility('a', 'b')).toBe('public');
  });
});

// ── canMessageUser ──────────────────────────────────────────
describe('canMessageUser', () => {
  test('connections can message', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'accepted',
    }]);
    seedTable('HomeOccupancy', []);
    expect(await canMessageUser('a', 'b')).toBe(true);
  });

  test('housemates can message', async () => {
    seedTable('Relationship', []);
    seedTable('HomeOccupancy', [
      { id: 'occ-1', user_id: 'a', home_id: 'h1', is_active: true, end_at: null },
      { id: 'occ-2', user_id: 'b', home_id: 'h1', is_active: true, end_at: null },
    ]);
    expect(await canMessageUser('a', 'b')).toBe(true);
  });

  test('blocked users cannot message', async () => {
    seedTable('Relationship', [{
      id: 'r-1', requester_id: 'a', addressee_id: 'b', status: 'blocked', blocked_by: 'a',
    }]);
    seedTable('HomeOccupancy', []);
    expect(await canMessageUser('a', 'b')).toBe(false);
  });

  test('strangers cannot message', async () => {
    seedTable('Relationship', []);
    seedTable('HomeOccupancy', []);
    expect(await canMessageUser('a', 'b')).toBe(false);
  });

  test('cannot message self', async () => {
    expect(await canMessageUser('a', 'a')).toBe(false);
  });

  test('null IDs return false', async () => {
    expect(await canMessageUser(null, 'b')).toBe(false);
    expect(await canMessageUser('a', null)).toBe(false);
  });
});
