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
afterEach(() => { supabaseAdmin.from = originalFrom; supabaseAdmin.resetRpc(); jest.clearAllMocks(); });
beforeEach(() => {
  resetTables();
  seedTable('HomeEmergency', [{
    id: ROW_ID, home_id: HOME_ID, type: 'shutoff_water', label: 'Water shutoff',
    location: 'Garage wall', details: {}, created_by: OWNER,
    created_at: '2026-09-16T00:00:00Z', updated_at: '2026-09-16T00:00:00Z',
  }]);
  grantManageTo(OWNER);
});

describe('GET /api/homes/:id/emergencies uses the effective sensitivity permission', () => {
  const MEMBER = OUTSIDER;
  beforeEach(() => {
    checkHomePermission.mockImplementation(jest.requireActual('../utils/homePermissions').checkHomePermission);
    seedTable('Home', [{ id: HOME_ID, owner_id: OWNER, created_by_user_id: OWNER, home_status: 'active', security_state: 'normal' }]);
    seedTable('HomeOccupancy', [
      { id: OWNER, home_id: HOME_ID, user_id: OWNER, role_base: 'owner', is_active: true, verification_status: 'verified', age_band: 'adult' },
      { id: MEMBER, home_id: HOME_ID, user_id: MEMBER, role_base: 'member', is_active: true, verification_status: 'verified', age_band: 'adult' },
    ]);
    seedTable('HomeRolePermission', [{ role_base: 'member', permission: 'home.view', allowed: true },
      { role_base: 'member', permission: 'home.edit', allowed: true }]);
    seedTable('HomeEmergency', [{ id: ROW_ID, home_id: HOME_ID, type: 'medication', label: 'Private fixture medication',
      location: 'Cabinet', details: { notes: 'Private fixture instructions' }, created_by: OWNER }]);
    // Exercise the existing state reader, with only its SQL boundary mocked.
    supabaseAdmin.setRpcMock(async (name, args) => {
      if (name !== 'home_record_context') return { data: null, error: { message: 'Unexpected RPC' } };
      const access = await jest.requireActual('../utils/homePermissions').getUserAccess(args.p_home_id, args.p_user_id);
      return { data: { allowed: access.hasAccess, private: false, permissions: access.permissions,
        role: access.effective_role_base, user_id: args.p_user_id }, error: null };
    });
  });

  async function get(actor) {
    return request(makeApp()).get(`/api/homes/${HOME_ID}/emergencies`).set('x-test-user-id', actor);
  }
  function denied(res) {
    expect(res.status).toBe(403);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body).toEqual({ error: "You don't have permission to view this home's emergency info." });
    expect(JSON.stringify(res.body)).not.toContain('Private fixture');
  }
  function retireDuringRead(change) {
    supabaseAdmin.from = table => {
      const query = originalFrom(table);
      if (table === 'HomeEmergency') {
        const order = query.order;
        query.order = (...args) => Promise.resolve(order.apply(query, args)).then(result => {
          change();
          return result;
        });
      }
      return query;
    };
  }

  test.each([
    ['security_state', 'frozen'], ['security_state', 'frozen_silent'], ['security_state', 'disputed'],
    ['home_status', 'archived'], ['home_status', 'merged'],
  ])('current Home %s=%s refuses Emergency rows before querying them', async (field, value) => {
    getTable('Home')[0][field] = value;
    const from = jest.spyOn(supabaseAdmin, 'from');
    try {
      denied(await get(OWNER));
      expect(from).not.toHaveBeenCalledWith('HomeEmergency');
    } finally { from.mockRestore(); }
  });

  test.each(['disputed', 'revoked'])('retained owner pointer cannot bypass %s ownership', async owner_status => {
    seedTable('HomeOwner', [{ id: ROW_ID, home_id: HOME_ID, subject_id: OWNER, subject_type: 'user',
      owner_status, is_primary_owner: true, verification_tier: null }]);
    denied(await get(OWNER));
  });

  test.each(['freeze', 'archive', 'withdraw sensitivity', 'revoke membership', 'dispute ownership'])(
    '%s while Emergency rows are pending retires the response', async change => {
      retireDuringRead(() => {
        if (change === 'freeze') getTable('Home')[0].security_state = 'frozen';
        if (change === 'archive') getTable('Home')[0].home_status = 'archived';
        if (change === 'withdraw sensitivity') seedTable('HomePermissionOverride', [{ home_id: HOME_ID, user_id: OWNER, permission: 'sensitive.view', allowed: false }]);
        if (change === 'revoke membership') getTable('HomeOccupancy')[0].verification_status = 'revoked';
        if (change === 'dispute ownership') seedTable('HomeOwner', [{ id: ROW_ID, home_id: HOME_ID, subject_id: OWNER, subject_type: 'user',
          owner_status: 'disputed', is_primary_owner: true, verification_tier: null }]);
      });
      denied(await get(OWNER));
    });

  test('changed authority still permitting sensitive.view returns a retry without private rows', async () => {
    retireDuringRead(() => seedTable('HomePermissionOverride', [{ home_id: HOME_ID, user_id: OWNER, permission: 'finance.view', allowed: false }]));
    const res = await get(OWNER);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('HOME_LIST_ACCESS_CHANGED');
    expect(JSON.stringify(res.body)).not.toContain('Private fixture');
  });

  test.each([
    [null, { message: 'Private fixture SQL failure' }],
    [null, null],
    [{ allowed: true, private: false, permissions: 'sensitive.view' }, null],
  ])('unavailable or malformed SQL authority refuses an Emergency response (%s)', async (data, error) => {
    supabaseAdmin.setRpcMock(async () => ({ data, error }));
    const res = await get(OWNER);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('HOME_LIST_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('Private fixture');
  });

  test('private setup context cannot authorize the shared Emergency reader', async () => {
    const access = await jest.requireActual('../utils/homePermissions').getUserAccess(HOME_ID, OWNER);
    supabaseAdmin.setRpcMock(async () => ({ data: { allowed: true, private: true,
      permissions: access.permissions, role: access.effective_role_base, user_id: OWNER }, error: null }));
    denied(await get(OWNER));
  });

  test('failed final authority recheck cannot publish previously fetched Emergency rows', async () => {
    retireDuringRead(() => supabaseAdmin.setRpcMock(async () => ({ data: null, error: { message: 'Private fixture recheck failure' } })));
    const res = await get(OWNER);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('HOME_LIST_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('Private fixture');
  });

  test('owner and explicitly granted member use the existing response and aliases', async () => {
    const expected = { emergencies: getTable('HomeEmergency').map(row => ({
      ...row, info_type: row.type, location_in_home: row.location,
    })) };
    const owner = await get(OWNER);
    expect(owner.status).toBe(200);
    expect(owner.body).toEqual(expected);
    seedTable('HomePermissionOverride', [{ home_id: HOME_ID, user_id: MEMBER, permission: 'sensitive.view', allowed: true }]);
    const res = await get(MEMBER);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body).toEqual(expected);
    expect(res.body.emergencies[0].details.notes).toBe('Private fixture instructions');
    expect(checkHomePermission).toHaveBeenCalledWith(HOME_ID, MEMBER, 'sensitive.view');
  });

  test.each(['member', 'admin', 'manager', 'lease_resident', 'restricted_member', 'guest', 'service_provider'])(
    'membership/home.edit alone does not let a %s read Emergency info', async role => {
      getTable('HomeOccupancy')[1].role_base = role;
      seedTable('HomeRolePermission', [{ role_base: role, permission: 'home.view', allowed: true },
        { role_base: role, permission: 'home.edit', allowed: true }]);
      const from = jest.spyOn(supabaseAdmin, 'from');
      denied(await get(MEMBER));
      expect(from).not.toHaveBeenCalledWith('HomeEmergency');
      from.mockRestore();
    });

  test('explicit deny fences the owner and a withdrawn grant retires the next read', async () => {
    seedTable('HomePermissionOverride', [{ home_id: HOME_ID, user_id: OWNER, permission: 'sensitive.view', allowed: false },
      { home_id: HOME_ID, user_id: MEMBER, permission: 'sensitive.view', allowed: true }]);
    denied(await get(OWNER));
    expect((await get(MEMBER)).status).toBe(200);
    getTable('HomePermissionOverride')[1].allowed = false;
    denied(await get(MEMBER));
  });

  test.each(['child', 'teen'])('%s sensitivity remains denied even for an owner with an explicit grant', async age => {
    getTable('HomeOccupancy')[0].age_band = age;
    seedTable('HomePermissionOverride', [{ home_id: HOME_ID, user_id: OWNER, permission: 'sensitive.view', allowed: true }]);
    denied(await get(OWNER));
  });

  test.each(['suspended', 'revoked', 'pending_doc'])('%s membership cannot use a retained sensitivity grant', async status => {
    seedTable('HomePermissionOverride', [{ home_id: HOME_ID, user_id: MEMBER, permission: 'sensitive.view', allowed: true }]);
    getTable('HomeOccupancy')[1].verification_status = status;
    denied(await get(MEMBER));
  });

  test('home.edit PUT replaces submitted fields and cannot echo the previous private details', async () => {
    denied(await get(MEMBER));
    const res = await request(makeApp()).put(`/api/homes/${HOME_ID}/emergencies/${ROW_ID}`)
      .set('x-test-user-id', MEMBER).send({ type: 'contact', label: 'Caller supplied contact' });
    expect(res.status).toBe(200);
    expect(res.body.emergency).toMatchObject({ type: 'contact', label: 'Caller supplied contact', details: {} });
    expect(JSON.stringify(res.body)).not.toContain('Private fixture');
    expect(getTable('HomeEmergency')[0].details).toEqual({});
  });

  test('home.edit POST retry returns only the same actor payload and refuses later changed private details', async () => {
    const payload = { type: 'contact', label: 'Caller supplied contact', details: { notes: 'Caller supplied note' }, clientRequestId: ROW_ID };
    const post = () => request(makeApp()).post(`/api/homes/${HOME_ID}/emergencies`)
      .set('x-test-user-id', MEMBER).send(payload);
    expect((await post()).status).toBe(201);
    const first = getTable('HomeEmergency').find(row => row.created_by === MEMBER);
    expect((await post()).body.emergency.id).toBe(first.id);
    expect(getTable('HomeEmergency')).toHaveLength(2);
    first.details = { notes: 'Private fixture changed after creation' };
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.emergency).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Private fixture');
    expect(getTable('HomeEmergency')).toHaveLength(2);
  });

  test('home.edit DELETE returns an acknowledgement without Emergency fields', async () => {
    const res = await request(makeApp()).delete(`/api/homes/${HOME_ID}/emergencies/${ROW_ID}`)
      .set('x-test-user-id', MEMBER);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Emergency info deleted' });
    expect(JSON.stringify(res.body)).not.toContain('Private fixture');
  });
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
