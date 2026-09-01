// ============================================================
// TEST: Per-home privacy toggles — GET/PATCH /api/homes/:id/privacy
// (P3F / A14.2). Uses the in-memory supabaseAdmin mock + stubbed
// verifyToken. Owner access is granted via Home.owner_id (legacy owner
// bypasses the security.manage permission check).
// ============================================================

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

const homePrivacyRoutes = require('../routes/homePrivacy');

const OWNER = 'owner-user-1';
const STRANGER = 'stranger-user-1';
const HOME_ID = 'home-1';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', homePrivacyRoutes);
  return app;
}

function seedOwnedHome() {
  seedTable('Home', [{ id: HOME_ID, owner_id: OWNER, name: 'Elm Park' }]);
}

beforeEach(() => resetTables());

describe('GET /api/homes/:id/privacy', () => {
  test('owner gets the default toggle set (balanced baseline)', async () => {
    seedOwnedHome();
    const res = await request(buildApp())
      .get(`/api/homes/${HOME_ID}/privacy`)
      .set('x-test-user-id', OWNER);

    expect(res.status).toBe(200);
    expect(res.body.privacy).toMatchObject({
      home_id: HOME_ID,
      guest_approval: true,
      member_name_visibility: true,
      address_precision: false,
      activity_visibility: true,
      map_opt_out: false,
      notification_previews: true,
      doc_lock: true,
      photo_blur: false,
      vault_auto_lock: false,
    });
    // 5 of 9 on — the design's balanced baseline.
    const onCount = Object.entries(res.body.privacy)
      .filter(([k]) => k !== 'home_id')
      .filter(([, v]) => v === true).length;
    expect(onCount).toBe(5);
  });

  test('a persisted row overrides defaults', async () => {
    seedOwnedHome();
    seedTable('HomePrivacy', [{
      id: 'hp-1',
      home_id: HOME_ID,
      guest_approval: false,
      member_name_visibility: false,
      address_precision: true,
      activity_visibility: false,
      map_opt_out: true,
      notification_previews: false,
      doc_lock: false,
      photo_blur: true,
      vault_auto_lock: true,
    }]);

    const res = await request(buildApp())
      .get(`/api/homes/${HOME_ID}/privacy`)
      .set('x-test-user-id', OWNER);

    expect(res.status).toBe(200);
    expect(res.body.privacy.map_opt_out).toBe(true);
    expect(res.body.privacy.guest_approval).toBe(false);
  });

  test('non-member is forbidden', async () => {
    seedOwnedHome();
    const res = await request(buildApp())
      .get(`/api/homes/${HOME_ID}/privacy`)
      .set('x-test-user-id', STRANGER);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/homes/:id/privacy', () => {
  test('updates a single toggle, preserves the rest, and persists', async () => {
    seedOwnedHome();
    const app = buildApp();

    const res = await request(app)
      .patch(`/api/homes/${HOME_ID}/privacy`)
      .set('x-test-user-id', OWNER)
      .send({ map_opt_out: true });

    expect(res.status).toBe(200);
    expect(res.body.privacy.map_opt_out).toBe(true);
    expect(res.body.privacy.guest_approval).toBe(true); // untouched default

    const rows = getTable('HomePrivacy');
    expect(rows).toHaveLength(1);
    expect(rows[0].map_opt_out).toBe(true);

    const get = await request(app)
      .get(`/api/homes/${HOME_ID}/privacy`)
      .set('x-test-user-id', OWNER);
    expect(get.body.privacy.map_opt_out).toBe(true);
  });

  test('a second partial PATCH merges with the existing row (single row)', async () => {
    seedOwnedHome();
    const app = buildApp();

    await request(app)
      .patch(`/api/homes/${HOME_ID}/privacy`)
      .set('x-test-user-id', OWNER)
      .send({ photo_blur: true });
    const res = await request(app)
      .patch(`/api/homes/${HOME_ID}/privacy`)
      .set('x-test-user-id', OWNER)
      .send({ map_opt_out: true });

    expect(res.body.privacy.photo_blur).toBe(true);
    expect(res.body.privacy.map_opt_out).toBe(true);
    expect(getTable('HomePrivacy')).toHaveLength(1);
  });

  test('rejects an empty body (min 1 toggle)', async () => {
    seedOwnedHome();
    const res = await request(buildApp())
      .patch(`/api/homes/${HOME_ID}/privacy`)
      .set('x-test-user-id', OWNER)
      .send({});
    expect(res.status).toBe(400);
  });

  test('rejects a non-boolean toggle value', async () => {
    seedOwnedHome();
    const res = await request(buildApp())
      .patch(`/api/homes/${HOME_ID}/privacy`)
      .set('x-test-user-id', OWNER)
      .send({ map_opt_out: 'yes' });
    expect(res.status).toBe(400);
  });

  test('non-member cannot patch', async () => {
    seedOwnedHome();
    const res = await request(buildApp())
      .patch(`/api/homes/${HOME_ID}/privacy`)
      .set('x-test-user-id', STRANGER)
      .send({ map_opt_out: true });
    expect(res.status).toBe(403);
  });
});
