/**
 * Address redaction on the two routes that let a signed-in NON-member look
 * at a home (Wedge v2 §2, the privacy promise):
 *
 *   GET /api/homes/discover          — outsiders get the street; a searcher
 *                                      who typed the house number gets the
 *                                      exact match (knowledge proof)
 *   GET /api/homes/:id/public-profile — insiders (members / creator /
 *                                      claimants) get the exact address;
 *                                      everyone else the street + first name
 *
 * checkHomePermission is stubbed per test; supabaseAdmin + verifyToken are
 * the project's standard mocks.
 */
const express = require('express');
const request = require('supertest');
const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');

jest.mock('../utils/homePermissions', () => ({
  ...jest.requireActual('../utils/homePermissions'),
  checkHomePermission: jest.fn(),
}));
const { checkHomePermission } = require('../utils/homePermissions');

const homeRouter = require('../routes/home');

const OWNER = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const OUTSIDER = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc';
const HOME_ID = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', homeRouter);
  return app;
}

function seedHome() {
  seedTable('Home', [{
    id: HOME_ID,
    name: null,
    address: '1214 NE Birch St Apt 3',
    city: 'Camas',
    state: 'WA',
    zipcode: '98607',
    home_type: 'house',
    visibility: 'public_preview',
    home_status: 'active',
    privacy_mask_level: 'normal',
    owner_id: OWNER,
    created_by_user_id: OWNER,
    description: null,
    created_at: '2026-01-01T00:00:00Z',
  }]);
  seedTable('User', [{
    id: OWNER, username: 'yp', name: 'Yingpeng Wang', first_name: 'Yingpeng', last_name: 'Wang', profile_picture_url: null,
  }]);
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  checkHomePermission.mockResolvedValue({ hasAccess: false });
  seedHome();
});

describe('GET /api/homes/:id/public-profile', () => {
  it('shows an outsider the street and a first name — never the house number, unit, or zip', async () => {
    const res = await request(makeApp())
      .get(`/api/homes/${HOME_ID}/public-profile`)
      .set('x-test-user-id', OUTSIDER);
    expect(res.status).toBe(200);
    expect(res.body.home).toMatchObject({ address: 'NE Birch St', zipcode: null, address_redacted: true, city: 'Camas' });
    expect(JSON.stringify(res.body)).not.toContain('1214');
    expect(JSON.stringify(res.body)).not.toContain('Apt');
    expect(res.body.owner.name).toBe('Yingpeng');
  });

  it('shows a member the exact address and the full name', async () => {
    checkHomePermission.mockResolvedValue({ hasAccess: true });
    const res = await request(makeApp())
      .get(`/api/homes/${HOME_ID}/public-profile`)
      .set('x-test-user-id', OUTSIDER);
    expect(res.status).toBe(200);
    expect(res.body.home).toMatchObject({ address: '1214 NE Birch St Apt 3', zipcode: '98607', address_redacted: false });
    expect(res.body.owner.name).toBe('Yingpeng Wang');
  });

  it('treats a user with a residency claim on the home as an insider', async () => {
    seedTable('HomeResidencyClaim', [{ id: 'claim-1', home_id: HOME_ID, user_id: OUTSIDER, status: 'pending', created_at: '2026-02-01T00:00:00Z' }]);
    const res = await request(makeApp())
      .get(`/api/homes/${HOME_ID}/public-profile`)
      .set('x-test-user-id', OUTSIDER);
    expect(res.status).toBe(200);
    expect(res.body.home.address).toBe('1214 NE Birch St Apt 3');
    expect(res.body.home.address_redacted).toBe(false);
  });

  it('refuses a stranger a private home even when it has a verified owner (no join probe since PR 351)', async () => {
    resetTables();
    seedHome();
    seedTable('Home', [{ ...(require('./__mocks__/supabaseAdmin').getTable('Home')[0]), visibility: 'private' }]);
    seedTable('HomeOwner', [{ id: 'ho-1', home_id: HOME_ID, subject_type: 'user', subject_id: OWNER, owner_status: 'verified', is_primary_owner: true }]);
    const res = await request(makeApp())
      .get(`/api/homes/${HOME_ID}/public-profile`)
      .set('x-test-user-id', OUTSIDER);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/homes/discover', () => {
  it('redacts the house number for an outsider searching by street', async () => {
    const res = await request(makeApp())
      .get('/api/homes/discover')
      .query({ q: 'birch' })
      .set('x-test-user-id', OUTSIDER);
    expect(res.status).toBe(200);
    expect(res.body.homes).toHaveLength(1);
    expect(res.body.homes[0]).toMatchObject({ address: 'NE Birch St', zipcode: null, address_redacted: true });
    expect(res.body.homes[0].owner.name).toBe('Yingpeng');
  });

  it('reveals the exact match to a searcher who typed the house number (knowledge proof)', async () => {
    const res = await request(makeApp())
      .get('/api/homes/discover')
      .query({ q: '1214 NE Birch' })
      .set('x-test-user-id', OUTSIDER);
    expect(res.status).toBe(200);
    expect(res.body.homes).toHaveLength(1);
    expect(res.body.homes[0]).toMatchObject({ address: '1214 NE Birch St Apt 3', zipcode: '98607', address_redacted: false });
    expect(res.body.homes[0].owner.name).toBe('Yingpeng Wang');
  });

  it('reveals the exact address to an active member', async () => {
    seedTable('HomeOccupancy', [{ id: 'occ-1', home_id: HOME_ID, user_id: OUTSIDER, is_active: true }]);
    const res = await request(makeApp())
      .get('/api/homes/discover')
      .query({ q: 'birch' })
      .set('x-test-user-id', OUTSIDER);
    expect(res.status).toBe(200);
    expect(res.body.homes[0]).toMatchObject({ address: '1214 NE Birch St Apt 3', is_member: true, address_redacted: false });
  });
});
