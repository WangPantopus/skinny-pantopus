// ============================================================
// TEST: Home emergency info routes and the shared-document download headers
//
// Reproduced 2026-09-16 against the replayed database: both native Add
// Emergency forms POST a form category (`contact`, `allergy`, ...) that
// HomeEmergency_type_chk refuses, and the route reported that as a 500
// "Failed to create emergency info". The planned DELETE route (T6.0c) did not
// exist, and the shared-document download applied res.attachment() after
// res.type(), so every download was served as application/octet-stream.
// No existing suite loads these handlers; guestPass.test.js exercises the
// share service logic against the mocked database, not these routers.
// ============================================================

const express = require('express');
const request = require('supertest');
const supabaseAdmin = require('./__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;

jest.mock('../utils/homePermissions', () => ({
  ...jest.requireActual('../utils/homePermissions'),
  checkHomePermission: jest.fn(),
}));
jest.mock('../services/homeExternalShareService', () => ({
  mutate: jest.fn(), read: jest.fn(), download: jest.fn(),
}));
const { checkHomePermission } = require('../utils/homePermissions');
const share = require('../services/homeExternalShareService');
const homeRouter = require('../routes/home');
const guestRouter = require('../routes/homeGuest');

const OWNER = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const OUTSIDER = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc';
const HOME_ID = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const ROW_ID = 'dddddddd-dddd-1ddd-8ddd-dddddddddddd';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', guestRouter);
  app.use('/api/homes', homeRouter);
  return app;
}

// The route's own permission check: managers of the home may write, anyone
// outside it may not, mirroring the route's `can_manage_home` gate.
function grantManageTo(userId) {
  checkHomePermission.mockImplementation(async (homeId, actor) => ({
    hasAccess: homeId === HOME_ID && actor === userId, permissions: [], readFailed: false,
  }));
}

const originalFrom = supabaseAdmin.from;
afterEach(() => { supabaseAdmin.from = originalFrom; jest.clearAllMocks(); });
beforeEach(() => {
  resetTables();
  seedTable('HomeEmergency', [{
    id: ROW_ID, home_id: HOME_ID, type: 'shutoff_water', label: 'Water shutoff',
    location: 'Garage wall', details: {}, created_by: OWNER,
    created_at: '2026-09-16T00:00:00Z', updated_at: '2026-09-16T00:00:00Z',
  }]);
  grantManageTo(OWNER);
});

// A chain whose execution reports the database's check-constraint refusal the
// way PostgREST surfaces it (SQLSTATE 23514 in error.code).
function refusingChain() {
  const result = { data: null, error: { code: '23514', message: 'new row for relation "HomeEmergency" violates check constraint "HomeEmergency_type_chk"' } };
  const chain = {};
  const proxy = new Proxy(chain, { get: (_target, key) => (key === 'then' ? (resolve) => resolve(result) : () => proxy) });
  return proxy;
}

describe('POST /api/homes/:id/emergencies', () => {
  test('a type the column refuses is the caller\'s error, not a server failure', async () => {
    supabaseAdmin.from = (table) => (table === 'HomeEmergency' ? refusingChain() : originalFrom.call(supabaseAdmin, table));
    const res = await request(makeApp()).post(`/api/homes/${HOME_ID}/emergencies`)
      .set('x-test-user-id', OWNER).send({ type: 'contact', label: 'Neighbour' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'This emergency type is not supported.', code: 'INVALID_EMERGENCY_TYPE' });
  });

  test('a canonical type is stored with its details and echoed with the legacy aliases', async () => {
    const res = await request(makeApp()).post(`/api/homes/${HOME_ID}/emergencies`)
      .set('x-test-user-id', OWNER)
      .send({ type: 'shutoff_gas', label: 'Gas valve', location: 'Behind the dryer', details: { notes: 'Turn clockwise' } });
    expect(res.status).toBe(201);
    expect(res.body.emergency).toMatchObject({ type: 'shutoff_gas', info_type: 'shutoff_gas', label: 'Gas valve',
      location: 'Behind the dryer', location_in_home: 'Behind the dryer', details: { notes: 'Turn clockwise' }, created_by: OWNER });
    expect(getTable('HomeEmergency')).toHaveLength(2);
  });

  test('a missing label or a non-manager cannot create one', async () => {
    expect((await request(makeApp()).post(`/api/homes/${HOME_ID}/emergencies`)
      .set('x-test-user-id', OWNER).send({ type: 'shutoff_gas' })).status).toBe(400);
    expect((await request(makeApp()).post(`/api/homes/${HOME_ID}/emergencies`)
      .set('x-test-user-id', OUTSIDER).send({ type: 'shutoff_gas', label: 'Gas valve' })).status).toBe(403);
    expect(getTable('HomeEmergency')).toHaveLength(1);
  });
});

describe('DELETE /api/homes/:id/emergencies/:emergencyId', () => {
  test('removes exactly the named row of this home once', async () => {
    const first = await request(makeApp()).delete(`/api/homes/${HOME_ID}/emergencies/${ROW_ID}`).set('x-test-user-id', OWNER);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ message: 'Emergency info deleted' });
    expect(getTable('HomeEmergency')).toHaveLength(0);
    const again = await request(makeApp()).delete(`/api/homes/${HOME_ID}/emergencies/${ROW_ID}`).set('x-test-user-id', OWNER);
    expect(again.status).toBe(404);
    expect(again.body.code).toBe('EMERGENCY_NOT_FOUND');
  });

  test('another home\'s row and a non-manager are refused without a write', async () => {
    const otherHome = 'eeeeeeee-eeee-1eee-8eee-eeeeeeeeeeee';
    expect((await request(makeApp()).delete(`/api/homes/${otherHome}/emergencies/${ROW_ID}`).set('x-test-user-id', OWNER)).status).toBe(403);
    expect((await request(makeApp()).delete(`/api/homes/${HOME_ID}/emergencies/${ROW_ID}`).set('x-test-user-id', OUTSIDER)).status).toBe(403);
    expect(getTable('HomeEmergency')).toHaveLength(1);
  });

  test('a manager of another home reaches the query and still cannot remove this home\'s row', async () => {
    const otherHome = 'eeeeeeee-eeee-1eee-8eee-eeeeeeeeeeee';
    checkHomePermission.mockImplementation(async () => ({ hasAccess: true, permissions: [], readFailed: false }));
    const res = await request(makeApp()).delete(`/api/homes/${otherHome}/emergencies/${ROW_ID}`).set('x-test-user-id', OWNER);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('EMERGENCY_NOT_FOUND');
    expect(getTable('HomeEmergency')).toHaveLength(1);
  });
});

describe('GET /api/homes/shared-documents/:receipt/:documentId', () => {
  test('serves the stored MIME type as an attachment', async () => {
    share.download.mockResolvedValue({ bytes: Buffer.from('Shared document fixture bytes\n'), mimeType: 'text/plain', title: 'Fixture document' });
    const res = await request(makeApp()).get(`/api/homes/shared-documents/${'a'.repeat(64)}/${ROW_ID}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="Fixture document"');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.text).toBe('Shared document fixture bytes\n');
  });

  test('a refused download keeps the share API envelope', async () => {
    share.download.mockRejectedValue(Object.assign(new Error('This share link has been revoked.'), { code: 'SHARE_REVOKED', statusCode: 410 }));
    const res = await request(makeApp()).get(`/api/homes/shared-documents/${'a'.repeat(64)}/${ROW_ID}`);
    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: 'This share link has been revoked.', code: 'SHARE_REVOKED' });
  });
});
