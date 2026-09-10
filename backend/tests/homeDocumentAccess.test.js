const express = require('express');
const request = require('supertest');
const db = require('./__mocks__/supabaseAdmin');
jest.mock('../utils/homePermissions', () => ({
  ...jest.requireActual('../utils/homePermissions'),
  checkHomePermission: jest.fn(),
  getUserAccess: jest.fn(),
}));
const { checkHomePermission, getUserAccess } = require('../utils/homePermissions');
const app = express();
app.use(express.json());
app.use('/api/homes', require('../routes/home'));
const homeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const userId = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const url = `/api/homes/${homeId}/documents`;
const visibilities = ['public', 'members', 'managers', 'sensitive'];

function allow({ role = 'member', sensitive = false, denied = [], owner = false } = {}) {
  checkHomePermission.mockImplementation(async (_home, _user, permission) => ({
    hasAccess: permission === 'sensitive.view' ? (sensitive || owner) : !denied.includes(permission),
    isOwner: owner,
    occupancy: { role_base: role, can_view_sensitive: true, can_manage_home: true },
  }));
}
beforeEach(() => {
  db.resetTables();
  allow();
  getUserAccess.mockResolvedValue({ permissions: ['docs.view'] });
  db.seedTable('Home', [{ id: homeId, name: 'Test Home' }]);
  db.seedTable('HomeDocument', [
    ...visibilities.map(visibility => ({ id: visibility, home_id: homeId, visibility })),
    { id: 'other-home', home_id: 'other', visibility: 'members' },
    { id: 'unknown-visibility', home_id: homeId, visibility: 'unknown' },
  ]);
});
afterEach(() => jest.restoreAllMocks());

test.each([
  [{}, ['public', 'members']],
  [{ sensitive: true }, ['public', 'members', 'sensitive']],
  [{ role: 'manager' }, ['public', 'members', 'managers']],
  [{ role: 'admin', sensitive: true }, visibilities],
  [{ owner: true }, visibilities],
])('document visibility follows current IAM access: %j', async (options, expected) => {
  allow(options);
  const response = await request(app).get(url);
  expect(response.status).toBe(200);
  expect(response.body.documents.map(row => row.id).sort()).toEqual([...expected].sort());
  expect(checkHomePermission).toHaveBeenCalledWith(homeId, userId, 'docs.view');
});

test('denied docs.view blocks a current member before querying documents', async () => {
  allow({ denied: ['docs.view'] });
  const from = jest.spyOn(db, 'from');
  expect((await request(app).get(url)).status).toBe(403);
  expect(from).not.toHaveBeenCalled();
});

test('denied docs.upload blocks a current member before insertion', async () => {
  allow({ denied: ['docs.upload'] });
  const before = structuredClone(db.getTable('HomeDocument'));
  expect((await request(app).post(url).send({ title: 'A receipt', doc_type: 'receipt' })).status).toBe(403);
  expect(db.getTable('HomeDocument')).toEqual(before);
});

test.each(['get', 'post'])('access lookup failure remains retryable for %s', async method => {
  checkHomePermission.mockResolvedValue({ hasAccess: false, readFailed: true });
  const response = await request(app)[method](url).send({ title: 'A receipt', doc_type: 'receipt' });
  expect(response.status).toBe(503);
});

test('sensitive access lookup failure does not expose documents or masquerade as an empty list', async () => {
  const original = checkHomePermission.getMockImplementation();
  checkHomePermission.mockImplementation((home, user, permission) => permission === 'sensitive.view'
    ? Promise.resolve({ hasAccess: false, readFailed: true }) : original(home, user, permission));
  expect((await request(app).get(url)).status).toBe(503);
});

test.each(['managers', 'sensitive'])('a member cannot create a document in denied %s visibility', async visibility => {
  const before = structuredClone(db.getTable('HomeDocument'));
  const response = await request(app).post(url).send({ title: 'A receipt', doc_type: 'receipt', visibility });
  expect(response.status).toBe(403);
  expect(db.getTable('HomeDocument')).toEqual(before);
});

test.each([
  { title: 'A receipt', doc_type: 'receipt', visibility: 'unknown' },
  { title: 'A receipt', doc_type: 'unknown' },
  { title: ' ', doc_type: 'receipt' },
])('rejects invalid document metadata before insertion: %j', async body => {
  const before = structuredClone(db.getTable('HomeDocument'));
  expect((await request(app).post(url).send(body)).status).toBe(400);
  expect(db.getTable('HomeDocument')).toEqual(before);
});

test('a permitted member can create a document record in their visible scope', async () => {
  const response = await request(app).post(url).send({ title: 'A receipt', doc_type: 'receipt' });
  expect(response.status).toBe(201);
  expect(response.body.document).toMatchObject({ home_id: homeId, created_by: userId, visibility: 'members' });
  expect(checkHomePermission).toHaveBeenCalledWith(homeId, userId, 'docs.upload');
});

test.each([true, false])('dashboard document counts include only permitted records (docs.view=%s)', async permitted => {
  db.setRpcMock(async name => name === 'get_home_records'
    ? { data: { ok: true, records: [], attendees: [] }, error: null }
    : name === 'home_delete_eligibility'
      ? { data: { allowed: false, deleted: false, code: 'HOME_DELETE_ACCESS_DENIED' }, error: null }
      : { data: null, error: { message: 'Unexpected RPC' } });
  getUserAccess.mockResolvedValue({ permissions: permitted ? ['docs.view'] : [] });
  const response = await request(app).get(`/api/homes/${homeId}/dashboard`).set('Authorization', 'Bearer synthetic-document-session');
  expect(response.status).toBe(200);
  expect(response.body.counts.documents).toBe(permitted ? 2 : 0);
});
