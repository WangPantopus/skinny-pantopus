const express = require('express');
const request = require('supertest');
const db = require('./__mocks__/supabaseAdmin');

jest.mock('../utils/homePermissions', () => ({ checkHomePermission: jest.fn() }));
jest.mock('../services/s3Service', () => ({}));

const { checkHomePermission } = require('../utils/homePermissions');
const router = require('../routes/files');
const app = express();
app.use(express.json());
app.use('/api/files', router);

const homeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const userId = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const ownerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const upload = jest.fn();
const storageFrom = jest.fn();

function postFile(visibility = 'private', fileType = 'home_document') {
  return request(app).post(`/api/files/home/${homeId}`)
    .field('fileType', fileType).field('visibility', visibility)
    .attach('file', Buffer.from('synthetic home document'), 'house-rules.txt');
}

beforeEach(() => {
  db.resetTables();
  db.seedTable('Home', [{ id: homeId, owner_id: ownerId, occupants: [{ user_id: userId }] }]);
  db.seedTable('File', [
    { id: 'private-file', home_id: homeId, visibility: 'private', is_deleted: false, file_url: 'private-document' },
    { id: 'public-file', home_id: homeId, visibility: 'public', is_deleted: false },
    { id: 'shared-file', home_id: homeId, visibility: 'shared', is_deleted: false },
    { id: 'deleted-file', home_id: homeId, visibility: 'public', is_deleted: true },
    { id: 'other-home-file', home_id: 'other-home', visibility: 'public', is_deleted: false },
  ]);
  checkHomePermission.mockResolvedValue({ hasAccess: false, isOwner: false, occupancy: null });
  db.setRpcMock(async () => ({ data: { canUpload: true }, error: null }));
  upload.mockResolvedValue({ data: {}, error: null });
  storageFrom.mockReturnValue({
    upload,
    createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://storage.example/private' }, error: null }),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example/public' } }),
  });
  db.storage = { from: storageFrom };
});

afterEach(() => { jest.restoreAllMocks(); delete db.storage; });

describe('Home document permissions', () => {
  test.each([
    ['former occupant', null],
    ['current occupant denied docs.view', { user_id: userId, is_active: true }],
  ])('denies private listing to a %s despite the Home relation', async (_label, occupancy) => {
    checkHomePermission.mockResolvedValue({ hasAccess: false, isOwner: false, occupancy });
    const from = jest.spyOn(db, 'from');
    const response = await request(app).get(`/api/files/home/${homeId}?visibility=private`);
    expect(response.status).toBe(403);
    expect(response.body.files).toBeUndefined();
    expect(from.mock.calls.some(([table]) => table === 'File')).toBe(false);
    expect(checkHomePermission).toHaveBeenCalledWith(homeId, userId, 'docs.view');
  });

  test.each([false, true])('allows docs.view for a permitted member (owner=%s)', async (isOwner) => {
    checkHomePermission.mockResolvedValue({ hasAccess: true, isOwner });
    const response = await request(app).get(`/api/files/home/${homeId}?visibility=private`);
    expect(response.status).toBe(200);
    expect(response.body.files.map(file => file.id)).toEqual(['private-file']);
  });

  test.each(['', '?visibility=public'])('keeps explicitly public files available to authenticated visitors: %s', async (query) => {
    const response = await request(app).get(`/api/files/home/${homeId}${query}`);
    expect(response.status).toBe(200);
    expect(response.body.files.map(file => file.id)).toEqual(['public-file']);
  });

  test.each(['shared', 'unknown', 'private&visibility=public'])('rejects unsupported or ambiguous visibility: %s', async (visibility) => {
    const from = jest.spyOn(db, 'from');
    const response = await request(app).get(`/api/files/home/${homeId}?visibility=${visibility}`);
    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  test('returns a retryable error when the private access check fails', async () => {
    checkHomePermission.mockResolvedValue({ hasAccess: false, isOwner: false, readFailed: true });
    const response = await request(app).get(`/api/files/home/${homeId}?visibility=private`);
    expect(response.status).toBe(503);
    expect(response.body.files).toBeUndefined();
  });

  test.each([
    ['former occupant', null],
    ['current occupant denied docs.upload', { user_id: userId, is_active: true }],
  ])('denies upload by a %s before storage or file mutation', async (_label, occupancy) => {
    checkHomePermission.mockResolvedValue({ hasAccess: false, isOwner: false, occupancy });
    const before = structuredClone(db.getTable('File'));
    const response = await postFile();
    expect(response.status).toBe(403);
    expect(storageFrom).not.toHaveBeenCalled();
    expect(db.getTable('File')).toEqual(before);
    expect(checkHomePermission).toHaveBeenCalledWith(homeId, userId, 'docs.upload');
  });

  test('returns a retryable error for upload access lookup failure', async () => {
    checkHomePermission.mockResolvedValue({ hasAccess: false, isOwner: false, readFailed: true });
    expect((await postFile()).status).toBe(503);
    expect(storageFrom).not.toHaveBeenCalled();
  });

  test('allows a member with docs.upload to upload a private document', async () => {
    checkHomePermission.mockResolvedValue({ hasAccess: true, isOwner: false });
    const response = await postFile();
    expect(response.status).toBe(201);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(db.getTable('File').at(-1)).toMatchObject({ user_id: userId, home_id: homeId, visibility: 'private' });
  });

  test('keeps public uploads owner-only even with docs.upload', async () => {
    checkHomePermission.mockResolvedValue({ hasAccess: true, isOwner: false });
    expect((await postFile('public')).status).toBe(403);
    expect(storageFrom).not.toHaveBeenCalled();
  });

  test('allows a permitted owner to upload a public file', async () => {
    checkHomePermission.mockResolvedValue({ hasAccess: true, isOwner: true });
    expect((await postFile('public')).status).toBe(201);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  test('reports an absent public home without exposing any files', async () => {
    db.seedTable('Home', []);
    expect((await request(app).get(`/api/files/home/${homeId}`)).status).toBe(404);
  });

  test('reports a public home lookup failure as retryable', async () => {
    jest.spyOn(db, 'from').mockImplementation(() => ({ select: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: null, error: { message: 'timeout' } }),
      single: async () => ({ data: null, error: { message: 'timeout' } }),
    }) }) }));
    expect((await request(app).get(`/api/files/home/${homeId}`)).status).toBe(503);
  });
});


test('the legacy Home listing excludes byte-contract documents with separate visibility rules', async () => {
  checkHomePermission.mockResolvedValue({ hasAccess: true, isOwner: false });
  db.seedTable('File', [
    { id: 'legacy-private', home_id: homeId, visibility: 'private', is_deleted: false },
    { id: 'sensitive-document', home_id: homeId, visibility: 'private', is_deleted: false,
      metadata: { storage_contract: 'home_document_v1', original_filename: 'restricted.txt' } },
  ]);
  const response = await request(app).get(`/api/files/home/${homeId}?visibility=private`);
  expect(response.status).toBe(200);
  expect(response.body.files.map(file => file.id)).toEqual(['legacy-private']);
});
