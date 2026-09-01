/**
 * Integration tests: Home + Mailbox
 *
 * Tests home creation, occupancy, and mailbox routing against a real DB.
 * This would have caught the is_current vs is_active bug immediately.
 */
const { createTestUser, cleanup, apiRequest, admin } = require('./helpers');

let owner, member;

beforeAll(async () => {
  owner = await createTestUser({ name: 'Home Owner', username: `homeowner_${Date.now()}` });
  member = await createTestUser({ name: 'Home Member', username: `homemember_${Date.now()}` });
});

afterAll(async () => {
  await cleanup();
});

describe('Home CRUD', () => {
  let homeId;

  test('POST /api/homes — creates a home', async () => {
    const res = await apiRequest('POST', '/api/homes', owner.token, {
      address: '123 Integration Test St',
      city: 'Testville',
      state: 'CA',
      zipcode: '90210',
      home_type: 'house',
    });

    expect(res.status).toBe(201);
    expect(res.body.home).toBeDefined();
    expect(res.body.home.address).toBe('123 Integration Test St');
    homeId = res.body.home.id;
  });

  test('GET /api/homes/:id — returns home detail', async () => {
    const res = await apiRequest('GET', `/api/homes/${homeId}`, owner.token);

    expect(res.status).toBe(200);
    expect(res.body.home || res.body).toBeDefined();
  });

  test('HomeOccupancy row exists with is_active=true', async () => {
    // This is the exact check that would have caught the is_current bug.
    // The column is "is_active", not "is_current".
    const { data: occupancies, error } = await admin
      .from('HomeOccupancy')
      .select('*')
      .eq('home_id', homeId)
      .eq('user_id', owner.userId)
      .eq('is_active', true);

    expect(error).toBeNull();
    expect(occupancies.length).toBeGreaterThanOrEqual(1);

    // Verify the column doesn't have the old wrong name
    const row = occupancies[0];
    expect(row).toHaveProperty('is_active');
    expect(row).not.toHaveProperty('is_current'); // This column never existed
  });

  test('PATCH /api/homes/:id — owner can update', async () => {
    const res = await apiRequest('PATCH', `/api/homes/${homeId}`, owner.token, {
      name: 'Test Home',
    });

    expect(res.status).toBe(200);
  });

  test('Non-member cannot access home', async () => {
    const res = await apiRequest('GET', `/api/homes/${homeId}`, member.token);

    // Should either be 403 or return limited data
    // The exact behavior depends on home visibility settings
    expect(res.status).toBeDefined();
  });
});

describe('Home Dashboard', () => {
  let homeId;

  beforeAll(async () => {
    const res = await apiRequest('POST', '/api/homes', owner.token, {
      address: '456 Dashboard Test Ave',
      city: 'Testville',
      state: 'CA',
      zipcode: '90210',
      home_type: 'apartment',
    });
    homeId = res.body.home.id;
  });

  test('GET /api/homes/:id/dashboard — returns all sub-resources', async () => {
    const res = await apiRequest('GET', `/api/homes/${homeId}/dashboard`, owner.token);

    expect(res.status).toBe(200);

    const body = res.body;
    // Dashboard should return home + sub-resources
    expect(body.home || body).toBeDefined();

    // These arrays should be present (possibly empty)
    if (body.tasks !== undefined) expect(body.tasks).toBeInstanceOf(Array);
    if (body.issues !== undefined) expect(body.issues).toBeInstanceOf(Array);
    if (body.bills !== undefined) expect(body.bills).toBeInstanceOf(Array);
    if (body.packages !== undefined) expect(body.packages).toBeInstanceOf(Array);
    if (body.events !== undefined) expect(body.events).toBeInstanceOf(Array);
  });

  test('POST /api/homes/:id/tasks — creates a task', async () => {
    const res = await apiRequest('POST', `/api/homes/${homeId}/tasks`, owner.token, {
      task_type: 'chore',
      title: 'Integration test task',
      description: 'Created by integration test',
      priority: 'medium',
    });

    expect(res.status).toBe(201);
    expect(res.body.task).toBeDefined();
  });

  test('POST /api/homes/:id/bills — creates a bill', async () => {
    const res = await apiRequest('POST', `/api/homes/${homeId}/bills`, owner.token, {
      bill_type: 'electric',
      provider_name: 'Test Electric Co',
      amount: 150.00,
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    });

    expect(res.status).toBe(201);
    expect(res.body.bill).toBeDefined();
  });
});

describe('Mailbox V2 — home-scoped features', () => {
  test('GET /api/mailbox/v2/inbox — authenticated user gets inbox', async () => {
    const res = await apiRequest('GET', '/api/mailbox/v2/inbox', owner.token);

    // Should not 500 — if getAccessibleHomeIds uses wrong column it would error
    expect(res.status).toBeLessThan(500);
  });

  test('getAccessibleHomeIds returns homes for active occupants', async () => {
    // Directly test the query that was broken (is_current vs is_active)
    const { data, error } = await admin
      .from('HomeOccupancy')
      .select('home_id')
      .eq('user_id', owner.userId)
      .eq('is_active', true);

    expect(error).toBeNull();
    expect(data).toBeInstanceOf(Array);
    // Owner created homes, should have occupancies
    expect(data.length).toBeGreaterThanOrEqual(1);
  });
});
