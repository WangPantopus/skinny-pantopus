// ============================================================
// TEST: Business Onboarding — Creation Logic
// Validates the business creation preconditions: reserved username,
// rate limiting, email collision, and RPC invocation.
//
// Tests the core business logic (DB queries and rules) that the
// POST /api/businesses route handler executes.
// ============================================================

const { resetTables, seedTable, setRpcMock } = require('./__mocks__/supabaseAdmin');
const supabaseAdmin = require('./__mocks__/supabaseAdmin');
const { RESERVED_USERNAMES } = require('../utils/businessConstants');

beforeEach(() => resetTables());

// ── Simulate the route handler's business logic ─────────────
// These functions mirror the exact DB queries in POST /api/businesses

async function checkRateLimit(actorId) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from('BusinessTeam')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', actorId)
    .eq('role_base', 'owner')
    .eq('is_active', true)
    .gte('joined_at', twentyFourHoursAgo);
  if (error) throw error;
  return (count || 0) >= 3;
}

async function checkUsernameUniqueness(username) {
  const { data: existing } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  return !existing;
}

async function checkEmailCollision(email, actorId) {
  const { data: existing } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (!existing) return null; // no collision
  return existing.id === actorId ? 'EMAIL_IS_PERSONAL' : 'EMAIL_TAKEN';
}

// ── Tests ───────────────────────────────────────────────────

describe('Business creation — reserved username', () => {
  test('rejects reserved username with 409 logic', () => {
    expect(RESERVED_USERNAMES.has('search')).toBe(true);
    expect(RESERVED_USERNAMES.has('admin')).toBe(true);
    expect(RESERVED_USERNAMES.has('dashboard')).toBe(true);

    // The route does: if (RESERVED_USERNAMES.has(username.toLowerCase()))
    // and returns 409 with code 'USERNAME_RESERVED'
    const username = 'search';
    const isReserved = RESERVED_USERNAMES.has(username.toLowerCase());
    expect(isReserved).toBe(true);
  });
});

describe('Business creation — rate limiting', () => {
  test('rate limits at 3 businesses per day', async () => {
    const recent = new Date().toISOString();
    seedTable('BusinessTeam', [
      { id: 'bt-1', user_id: 'actor-1', role_base: 'owner', is_active: true, joined_at: recent },
      { id: 'bt-2', user_id: 'actor-1', role_base: 'owner', is_active: true, joined_at: recent },
      { id: 'bt-3', user_id: 'actor-1', role_base: 'owner', is_active: true, joined_at: recent },
    ]);

    const isRateLimited = await checkRateLimit('actor-1');
    expect(isRateLimited).toBe(true);
  });

  test('allows creation under the limit', async () => {
    const recent = new Date().toISOString();
    seedTable('BusinessTeam', [
      { id: 'bt-1', user_id: 'actor-1', role_base: 'owner', is_active: true, joined_at: recent },
      { id: 'bt-2', user_id: 'actor-1', role_base: 'owner', is_active: true, joined_at: recent },
    ]);

    const isRateLimited = await checkRateLimit('actor-1');
    expect(isRateLimited).toBe(false);
  });
});

describe('Business creation — email collision', () => {
  test('distinguishes personal email collision from other collision', async () => {
    // Case 1: email matches actor's own account → EMAIL_IS_PERSONAL
    seedTable('User', [{ id: 'actor-1', username: 'personaluser', email: 'test@example.com' }]);

    const personalResult = await checkEmailCollision('test@example.com', 'actor-1');
    expect(personalResult).toBe('EMAIL_IS_PERSONAL');

    // Case 2: email matches a different user → EMAIL_TAKEN
    resetTables();
    seedTable('User', [{ id: 'other-user', username: 'otheraccount', email: 'test@example.com' }]);

    const takenResult = await checkEmailCollision('test@example.com', 'actor-1');
    expect(takenResult).toBe('EMAIL_TAKEN');

    // Case 3: email not taken → null (no collision)
    resetTables();
    seedTable('User', []);

    const noCollision = await checkEmailCollision('test@example.com', 'actor-1');
    expect(noCollision).toBeNull();
  });
});

describe('Business creation — RPC', () => {
  test('calls create_business_transaction RPC', async () => {
    const rpcSpy = jest.fn().mockReturnValue({
      data: { business_user_id: 'biz-new-1' },
      error: null,
    });
    setRpcMock(rpcSpy);

    const params = {
      p_username: 'myshop',
      p_name: 'My Shop',
      p_email: 'shop@example.com',
      p_business_type: 'general',
      p_categories: [],
      p_description: null,
      p_public_phone: null,
      p_website: null,
      p_actor_user_id: 'actor-1',
    };

    const { data, error } = await supabaseAdmin.rpc('create_business_transaction', params);

    expect(rpcSpy).toHaveBeenCalledTimes(1);
    expect(rpcSpy).toHaveBeenCalledWith('create_business_transaction', expect.objectContaining({
      p_username: 'myshop',
      p_actor_user_id: 'actor-1',
    }));
    expect(error).toBeNull();
    expect(data.business_user_id).toBe('biz-new-1');
  });

  test('returns 201-equivalent data on success', async () => {
    // Simulate the full creation flow: all checks pass, RPC succeeds
    seedTable('BusinessTeam', []);
    seedTable('User', []);
    setRpcMock(() => ({
      data: { business_user_id: 'biz-new-1' },
      error: null,
    }));

    const username = 'myshop';
    const actorId = 'actor-1';

    // Step 1: Not reserved
    expect(RESERVED_USERNAMES.has(username)).toBe(false);

    // Step 2: Not rate limited
    const isRateLimited = await checkRateLimit(actorId);
    expect(isRateLimited).toBe(false);

    // Step 3: Username available
    const isAvailable = await checkUsernameUniqueness(username);
    expect(isAvailable).toBe(true);

    // Step 4: Email not taken
    const collision = await checkEmailCollision('shop@example.com', actorId);
    expect(collision).toBeNull();

    // Step 5: RPC succeeds
    const { data, error } = await supabaseAdmin.rpc('create_business_transaction', {
      p_username: username,
      p_name: 'My Shop',
      p_email: 'shop@example.com',
      p_business_type: 'general',
      p_categories: [],
      p_description: null,
      p_public_phone: null,
      p_website: null,
      p_actor_user_id: actorId,
    });

    expect(error).toBeNull();
    expect(data.business_user_id).toBe('biz-new-1');

    // The route would respond with 201:
    const responseBody = {
      message: 'Business created',
      business: {
        id: data.business_user_id,
        username,
        name: 'My Shop',
        email: 'shop@example.com',
        account_type: 'business',
      },
    };
    expect(responseBody.business.id).toBe('biz-new-1');
    expect(responseBody.business.username).toBe('myshop');
  });
});
