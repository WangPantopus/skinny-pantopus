/**
 * Integration test helpers.
 *
 * Provides utilities for seeding test data, cleaning up, and making
 * authenticated requests against the running Express app.
 */
const { createServerSupabaseClient } = require('../../config/supabaseClient');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    'Integration tests require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.\n' +
    'Start Supabase local: npx supabase start\n' +
    'Then export the keys from the output.'
  );
}

/** Admin client (bypasses RLS) for seeding/cleanup */
const admin = createServerSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/** Anon client (respects RLS) for testing auth flows */
const anon = createServerSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Track created entities for cleanup
const cleanupQueue = [];

/**
 * Create a test user via Supabase Auth and insert a User row.
 * Returns { authUser, userRow, token }.
 */
async function createTestUser(overrides = {}) {
  const email = overrides.email || `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`;
  const password = 'Test1234!';

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr) throw new Error(`Failed to create auth user: ${authErr.message}`);

  const userId = authData.user.id;

  const userRow = {
    id: userId,
    email,
    username: overrides.username || `testuser_${Date.now()}`,
    name: overrides.name || 'Test User',
    first_name: overrides.first_name || 'Test',
    last_name: overrides.last_name || 'User',
    account_type: overrides.account_type || 'personal',
    role: overrides.role || 'user',
    ...overrides,
  };
  delete userRow.password; // don't insert password into User table

  const { error: insertErr } = await admin.from('User').insert(userRow);
  if (insertErr) throw new Error(`Failed to insert User row: ${insertErr.message}`);

  // Sign in to get a token
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`Failed to sign in test user: ${signInErr.message}`);

  cleanupQueue.push({ table: 'User', id: userId, authId: userId });

  return {
    authUser: authData.user,
    userRow,
    token: signIn.session.access_token,
    userId,
  };
}

/**
 * Seed a row into any table. Returns the inserted row.
 */
async function seedRow(table, data) {
  const { data: row, error } = await admin.from(table).insert(data).select().single();
  if (error) throw new Error(`Failed to seed ${table}: ${error.message}`);
  cleanupQueue.push({ table, id: row.id });
  return row;
}

/**
 * Seed multiple rows into a table.
 */
async function seedRows(table, rows) {
  const { data, error } = await admin.from(table).insert(rows).select();
  if (error) throw new Error(`Failed to seed ${table}: ${error.message}`);
  for (const row of data) cleanupQueue.push({ table, id: row.id });
  return data;
}

/**
 * Clean up all test data in reverse order.
 */
async function cleanup() {
  // Process in reverse to respect FK constraints
  const items = cleanupQueue.splice(0).reverse();

  for (const item of items) {
    try {
      if (item.authId) {
        await admin.auth.admin.deleteUser(item.authId);
      }
      await admin.from(item.table).delete().eq('id', item.id);
    } catch {
      // Best-effort cleanup; don't fail the test
    }
  }
}

/**
 * Make an authenticated HTTP request to the backend.
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g. '/api/gigs')
 * @param {string} token - Bearer token
 * @param {object} body - Request body (for POST/PATCH/PUT)
 */
async function apiRequest(method, path, token, body = null) {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';
  const url = `${baseUrl}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const opts = { method, headers };
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  const json = await res.json().catch(() => null);

  return { status: res.status, body: json, ok: res.ok };
}

module.exports = {
  admin,
  anon,
  createTestUser,
  seedRow,
  seedRows,
  cleanup,
  apiRequest,
};
