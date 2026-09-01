// ============================================================
// TEST: My Mail Day physical-mail triage — /api/mailbox/v2/mailday/*
// (P3F / A13.16). Uses the in-memory supabaseAdmin mock + stubbed
// verifyToken (req.user.id from x-test-user-id).
// ============================================================

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

const mailDayRoutes = require('../routes/mailDay');

const USER = 'mailday-user-1';
const OTHER = 'mailday-user-2';
const HOME_ID = 'home-md-1';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/mailbox/v2/mailday', mailDayRoutes);
  return app;
}

const todayDate = () => new Date().toISOString().slice(0, 10);
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function seedMembership(userId = USER, homeId = HOME_ID) {
  const existing = getTable('HomeOccupancy') || [];
  seedTable('HomeOccupancy', [
    ...existing,
    { id: `occ-${userId}`, home_id: homeId, user_id: userId, is_active: true, start_at: null, end_at: null },
  ]);
}

async function ingest(app, body = {}) {
  const res = await request(app)
    .post('/api/mailbox/v2/mailday/items')
    .set('x-test-user-id', USER)
    .send({
      kind: 'bill',
      label: 'Con Edison bill',
      sender: 'Con Edison · NY',
      suggested_name: 'Maria Kovács',
      suggested_avatar: 'personal_sky',
      confidence_percent: 94,
      ...body,
    });
  return res;
}

beforeEach(() => resetTables());

describe('GET /today', () => {
  test('empty day projects no items + two setup nudges', async () => {
    const res = await request(buildApp())
      .get('/api/mailbox/v2/mailday/today')
      .set('x-test-user-id', USER);

    expect(res.status).toBe(200);
    expect(res.body.unreviewed).toEqual([]);
    expect(res.body.reviewed).toEqual([]);
    expect(res.body.yesterday_recap).toBeNull();
    expect(res.body.setup_nudges).toHaveLength(2);
    expect(res.body.date_label).toContain('·');
    expect(res.body.streak_days).toBe(0);
  });

  test('backfills today from the unresolved routing queue (reuses /pending source)', async () => {
    seedMembership();
    seedTable('MailRoutingQueue', [{
      id: 'q-1',
      mail_id: 'mail-1',
      home_id: HOME_ID,
      recipient_name_raw: 'Marcus Khan',
      best_match_confidence: 0.71,
      resolved: false,
      // The mock does not perform the `Mail!inner(*)` join — embed the row
      // so the projection logic can be exercised.
      Mail: {
        id: 'mail-1',
        subject: 'Postcard from Lisbon',
        sender_display: 'P. Almeida · Lisbon, PT',
        mail_object_type: 'postcard',
        category: 'community',
      },
    }]);

    const res = await request(buildApp())
      .get('/api/mailbox/v2/mailday/today')
      .set('x-test-user-id', USER);

    expect(res.status).toBe(200);
    expect(res.body.unreviewed).toHaveLength(1);
    expect(res.body.unreviewed[0].kind).toBe('postcard');
    expect(res.body.unreviewed[0].label).toBe('Postcard from Lisbon');
    expect(res.body.unreviewed[0].suggested_name).toBe('Marcus Khan');
    expect(res.body.unreviewed[0].confidence_percent).toBe(71);
    // The materialized item is persisted (idempotent on the next read).
    expect(getTable('MailDayItem')).toHaveLength(1);
  });
});

describe('POST /items (ingest)', () => {
  test('creates an unreviewed item and the day reflects it', async () => {
    const app = buildApp();
    const created = await ingest(app);
    expect(created.status).toBe(201);
    expect(created.body.item.id).toBeTruthy();
    expect(created.body.item.kind).toBe('bill');
    expect(created.body.item.suggested_name).toBe('Maria Kovács');

    const today = await request(app).get('/api/mailbox/v2/mailday/today').set('x-test-user-id', USER);
    expect(today.body.unreviewed).toHaveLength(1);
    expect(today.body.reviewed).toHaveLength(0);
  });

  test('rejects joining a home the user is not a member of', async () => {
    const res = await ingest(buildApp(), { home_id: '11111111-1111-4111-8111-111111111111' });
    expect(res.status).toBe(403);
  });
});

describe('triage actions', () => {
  test('route moves the piece to reviewed/routed with a recipient chip', async () => {
    const app = buildApp();
    const id = (await ingest(app)).body.item.id;

    const res = await request(app)
      .post(`/api/mailbox/v2/mailday/items/${id}/route`)
      .set('x-test-user-id', USER)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.item.action).toBe('routed');
    expect(res.body.item.routed_to).toBe('Maria'); // first name of suggested_name
    expect(res.body.item.routed_tint).toBe('person_primary');
    expect(res.body.item.undo_countdown).toBe(5);

    const today = await request(app).get('/api/mailbox/v2/mailday/today').set('x-test-user-id', USER);
    expect(today.body.unreviewed).toHaveLength(0);
    expect(today.body.reviewed).toHaveLength(1);
    expect(today.body.reviewed[0].action).toBe('routed');
  });

  test('junk and return record the action with no recipient chip', async () => {
    const app = buildApp();
    const junkId = (await ingest(app)).body.item.id;
    const returnId = (await ingest(app)).body.item.id;

    const junk = await request(app)
      .post(`/api/mailbox/v2/mailday/items/${junkId}/junk`)
      .set('x-test-user-id', USER).send({});
    expect(junk.body.item.action).toBe('junked');
    expect(junk.body.item.routed_to).toBeNull();

    const ret = await request(app)
      .post(`/api/mailbox/v2/mailday/items/${returnId}/return`)
      .set('x-test-user-id', USER).send({});
    expect(ret.body.item.action).toBe('returned');
    expect(ret.body.item.routed_tint).toBeNull();
  });

  test('undo returns a reviewed piece to the unreviewed queue', async () => {
    const app = buildApp();
    const id = (await ingest(app)).body.item.id;
    await request(app).post(`/api/mailbox/v2/mailday/items/${id}/route`).set('x-test-user-id', USER).send({});

    const undo = await request(app).post(`/api/mailbox/v2/mailday/items/${id}/undo`).set('x-test-user-id', USER).send({});
    expect(undo.status).toBe(200);

    const today = await request(app).get('/api/mailbox/v2/mailday/today').set('x-test-user-id', USER);
    expect(today.body.unreviewed).toHaveLength(1);
    expect(today.body.reviewed).toHaveLength(0);
  });

  test('acting on another user\'s item is a 404', async () => {
    const app = buildApp();
    seedTable('MailDayItem', [{
      id: 'foreign-1', user_id: OTHER, day_date: todayDate(), status: 'unreviewed',
      kind: 'envelope', label: 'Theirs', suggested_avatar: 'personal_sky', confidence_percent: 0,
    }]);
    const res = await request(app)
      .post('/api/mailbox/v2/mailday/items/foreign-1/route')
      .set('x-test-user-id', USER).send({});
    expect(res.status).toBe(404);
  });
});

describe('POST /finish', () => {
  test('is rejected while pieces remain', async () => {
    const app = buildApp();
    await ingest(app);
    const res = await request(app).post('/api/mailbox/v2/mailday/finish').set('x-test-user-id', USER).send({});
    expect(res.status).toBe(400);
  });

  test('closes the day, counts actions, and starts a streak at 1', async () => {
    const app = buildApp();
    const a = (await ingest(app)).body.item.id;
    const b = (await ingest(app)).body.item.id;
    await request(app).post(`/api/mailbox/v2/mailday/items/${a}/route`).set('x-test-user-id', USER).send({});
    await request(app).post(`/api/mailbox/v2/mailday/items/${b}/junk`).set('x-test-user-id', USER).send({});

    const res = await request(app).post('/api/mailbox/v2/mailday/finish').set('x-test-user-id', USER).send({});
    expect(res.status).toBe(200);
    expect(res.body.streak_days).toBe(1);
    expect(res.body.pieces).toBe(2);
    expect(res.body.routed_count).toBe(1);
    expect(res.body.junked_count).toBe(1);
    expect(getTable('MailDaySession')).toHaveLength(1);
  });

  test('extends the streak when yesterday was finished', async () => {
    const app = buildApp();
    seedTable('MailDaySession', [{
      id: 's-y', user_id: USER, day_date: addDays(todayDate(), -1),
      finished_at: new Date(Date.now() - 86400000).toISOString(), streak_days: 5,
    }]);
    const id = (await ingest(app)).body.item.id;
    await request(app).post(`/api/mailbox/v2/mailday/items/${id}/route`).set('x-test-user-id', USER).send({});

    const res = await request(app).post('/api/mailbox/v2/mailday/finish').set('x-test-user-id', USER).send({});
    expect(res.body.streak_days).toBe(6);
  });
});

describe('yesterday recap', () => {
  test('surfaces yesterday\'s finished session as a recap with segments', async () => {
    const yDate = addDays(todayDate(), -1);
    seedTable('MailDaySession', [{
      id: 's-y', user_id: USER, day_date: yDate,
      finished_at: '2026-06-03T18:42:00.000Z', streak_days: 4, pieces: 2,
      routed_count: 1, junked_count: 1, returned_count: 0,
    }]);
    seedTable('MailDayItem', [
      { id: 'y1', user_id: USER, day_date: yDate, status: 'reviewed', action: 'routed', routed_to: 'Maria', routed_tint: 'person_primary', kind: 'bill', label: 'X' },
      { id: 'y2', user_id: USER, day_date: yDate, status: 'reviewed', action: 'junked', kind: 'flyer', label: 'Y' },
    ]);

    const res = await request(buildApp()).get('/api/mailbox/v2/mailday/today').set('x-test-user-id', USER);
    expect(res.body.yesterday_recap).not.toBeNull();
    expect(res.body.yesterday_recap.pieces).toBe(2);
    expect(res.body.yesterday_recap.closed_at_label).toContain('closed');
    const labels = res.body.yesterday_recap.segments.map((s) => s.label);
    expect(labels).toContain('1 to Maria');
    expect(labels).toContain('1 junked');
    // Carried streak shows before today is finished.
    expect(res.body.streak_days).toBe(4);
  });
});
