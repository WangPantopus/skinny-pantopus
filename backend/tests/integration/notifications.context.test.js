/**
 * P2.3 — notification firewall: GET /api/notifications and
 * /api/notifications/unread-count must respect the firewall context
 * filter and never return cross-context rows.
 *
 * Acceptance per unified-IA §6.1:
 *   1. /unread-count returns { count, total, byContext: {personal, audience, platform} }.
 *   2. ?context=audience returns only audience-context rows.
 *   3. ?context=all returns every row.
 *   4. ?context=invalid is rejected with 400.
 *
 * Mocks supabaseAdmin via the shared in-memory mock; verifyToken via the
 * x-test-user-id header convention used by the audience-profile e2e test.
 */

// verifyToken is auto-mocked by jest.config.js's moduleNameMapper —
// honors the x-test-user-id header out of the box.
jest.mock('../../middleware/rateLimiter', () => {
  const noop = (_req, _res, next) => next();
  return new Proxy({}, { get: () => noop });
});

const express = require('express');
const request = require('supertest');

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable } = supabaseAdmin;

const notificationsRouter = require('../../routes/notifications');

const USER_ID = '11111111-1111-4111-8111-111111111111';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationsRouter);
  return app;
}

function asUser(req) {
  return req.set('x-test-user-id', USER_ID);
}

function seedThreeContexts() {
  seedTable('Notification', [
    {
      id: 'n-personal',
      user_id: USER_ID,
      type: 'gig_bid_received',
      title: 'A bid arrived',
      body: 'Personal-zone notification',
      is_read: false,
      context: 'personal',
      context_type: 'personal',
      created_at: '2026-05-08T10:00:00Z',
    },
    {
      id: 'n-audience',
      user_id: USER_ID,
      type: 'persona_dm_received_creator',
      title: 'New DM from a fan',
      body: 'Audience-zone notification',
      is_read: false,
      context: 'audience',
      context_type: 'personal',
      created_at: '2026-05-08T11:00:00Z',
    },
    {
      id: 'n-platform',
      user_id: USER_ID,
      type: 'subscription_renewed',
      title: 'Subscription renewed',
      body: 'Platform-zone notification',
      is_read: false,
      context: 'platform',
      context_type: 'personal',
      created_at: '2026-05-08T12:00:00Z',
    },
  ]);
}

describe('P2.3 — notifications context firewall', () => {
  let app;
  beforeAll(() => { app = buildApp(); });
  beforeEach(() => { resetTables(); seedThreeContexts(); });

  test('GET /unread-count returns total + byContext breakdown', async () => {
    const res = await asUser(request(app).get('/api/notifications/unread-count'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        total: 3,
        byContext: { personal: 1, audience: 1, platform: 1 },
      }),
    );
    // Legacy field is still exposed so non-migrated callers keep working.
    expect(res.body.count).toBe(3);
  });

  test('GET /?context=audience returns only the audience-context row', async () => {
    const res = await asUser(request(app).get('/api/notifications?context=audience'));
    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].id).toBe('n-audience');
    expect(res.body.notifications[0].context).toBe('audience');
    // The row count for the bell badge must match the filter — never the
    // global total.
    expect(res.body.unreadCount).toBe(1);
  });

  test('GET /?context=personal returns only the personal-context row', async () => {
    const res = await asUser(request(app).get('/api/notifications?context=personal'));
    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].id).toBe('n-personal');
    expect(res.body.notifications[0].context).toBe('personal');
    expect(res.body.unreadCount).toBe(1);
  });

  test('GET /?context=all returns every row', async () => {
    const res = await asUser(request(app).get('/api/notifications?context=all'));
    expect(res.status).toBe(200);
    const ids = res.body.notifications.map((n) => n.id).sort();
    expect(ids).toEqual(['n-audience', 'n-personal', 'n-platform']);
    expect(res.body.unreadCount).toBe(3);
  });

  test('GET /?context=invalid is rejected with 400', async () => {
    const res = await asUser(request(app).get('/api/notifications?context=bogus'));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid context/i);
  });

  test('legacy ?firewall= alias still works', async () => {
    const res = await asUser(request(app).get('/api/notifications?firewall=audience'));
    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].context).toBe('audience');
  });

  test('POST /read-all scopes by one firewall context', async () => {
    const res = await asUser(request(app)
      .post('/api/notifications/read-all')
      .send({ context: 'audience' }));
    expect(res.status).toBe(200);

    const all = await asUser(request(app).get('/api/notifications?context=all'));
    const byId = Object.fromEntries(all.body.notifications.map((n) => [n.id, n]));
    expect(byId['n-audience'].is_read).toBe(true);
    expect(byId['n-personal'].is_read).toBe(false);
    expect(byId['n-platform'].is_read).toBe(false);
  });

  test('POST /read-all scopes by multiple firewall contexts', async () => {
    const res = await asUser(request(app)
      .post('/api/notifications/read-all')
      .send({ contexts: ['personal', 'platform'] }));
    expect(res.status).toBe(200);

    const all = await asUser(request(app).get('/api/notifications?context=all'));
    const byId = Object.fromEntries(all.body.notifications.map((n) => [n.id, n]));
    expect(byId['n-personal'].is_read).toBe(true);
    expect(byId['n-platform'].is_read).toBe(true);
    expect(byId['n-audience'].is_read).toBe(false);
  });
});
