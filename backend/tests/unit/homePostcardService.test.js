const request = require('supertest');
const express = require('express');
jest.mock('../../utils/postcardDispatch', () => ({
  generatePostcardCode: jest.fn(() => '123456'),
  hashPostcardCode: jest.requireActual('../../utils/postcardDispatch').hashPostcardCode,
  dispatchPostcardCode: jest.fn(),
}));
jest.mock('../../utils/homePermissions', () => ({
  checkHomePermission: jest.fn(async () => ({ hasAccess: true })),
  writeAuditLog: jest.fn(), applyOccupancyTemplate: jest.fn(), mapLegacyRole: jest.fn(),
}));
const db = require('../__mocks__/supabaseAdmin');
const supabase = require('../../config/supabaseAdmin');
const { dispatchPostcardCode } = require('../../utils/postcardDispatch');
const { checkHomePermission } = require('../../utils/homePermissions');
const service = require('../../services/homePostcardService');
const app = express().use(express.json()).use('/api/homes', require('../../routes/homeOwnership'));
const ID = 'eee00000-0000-4000-8000-000000000081';
const destination = { address: 'Synthetic street', address2: 'Apt 4', city: 'Test', state: 'CA', zipcode: '00000' };
function card(overrides = {}) { return {
  id: ID, home_id: 'home', user_id: 'user', status: 'pending', dispatch_status: 'pending',
  vendor_job_id: null, requested_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(),
  code_hash: 'a'.repeat(64), destination, ...overrides,
}; }
function admit(row, reused = false) {
  db.seedTable('HomePostcardCode', [row]);
  db.setRpcMock(async (name, args) => {
    expect(name).toBe('admit_home_postcard');
    expect(args).toMatchObject({ p_home_id: 'home', p_user_id: 'user' });
    expect(args.p_code_hash).toMatch(/^[0-9a-f]{64}$/);
    return { data: { postcard: row, reused }, error: null };
  });
}
beforeEach(() => {
  db.resetTables(); jest.restoreAllMocks();
  dispatchPostcardCode.mockReset().mockResolvedValue({ success: true, vendorJobId: 'psc_native' });
  checkHomePermission.mockResolvedValue({ hasAccess: true });
});
test('sends the saved unit and stable identity once, exposing no proof or provider receipt', async () => {
  admit(card());
  const result = await service.request('home', 'user');
  expect(result.status).toBe(201);
  expect(result.body.delivery_unknown).toBe(false);
  expect(dispatchPostcardCode).toHaveBeenCalledWith(destination, '123456', ID);
  expect(JSON.stringify(result.body)).not.toMatch(/code_hash|vendor_job_id|psc_native|Synthetic street/);
  expect(db.getTable('HomePostcardCode')[0]).toMatchObject({ dispatch_status: 'accepted', status: 'pending', code_hash: 'a'.repeat(64) });
});
test.each(['pending', 'dispatching', 'delivery_unknown', null])('retry never resends an unresolved %s proof', async dispatchStatus => {
  admit(card({ dispatch_status: dispatchStatus }), true);
  const result = await service.request('home', 'user');
  expect(result.status).toBe(202); expect(result.body.delivery_unknown).toBe(true);
  expect(dispatchPostcardCode).not.toHaveBeenCalled();
});
test('known receipt resumes with 200', async () => {
  admit(card({ dispatch_status: 'accepted', vendor_job_id: 'psc_native' }), true);
  expect((await service.request('home', 'user')).status).toBe(200);
  expect(dispatchPostcardCode).not.toHaveBeenCalled();
});
test('lost provider response preserves pending proof and reports uncertainty', async () => {
  admit(card()); dispatchPostcardCode.mockResolvedValue({ success: false, deliveryUnknown: true });
  expect((await service.request('home', 'user')).status).toBe(202);
  expect(db.getTable('HomePostcardCode')[0]).toMatchObject({ status: 'pending', dispatch_status: 'delivery_unknown', code_hash: 'a'.repeat(64) });
});
test('only definite provider rejection retires the proof', async () => {
  admit(card()); dispatchPostcardCode.mockResolvedValue({ success: false });
  expect((await service.request('home', 'user')).status).toBe(502);
  expect(db.getTable('HomePostcardCode')[0]).toMatchObject({ status: 'cancelled', dispatch_status: 'rejected' });
});
test('missing migration fails closed before provider calls', async () => {
  expect((await service.request('home', 'user')).status).toBe(503);
  expect(dispatchPostcardCode).not.toHaveBeenCalled();
});
test.each(['ADDRESS_LIMIT', 'USER_LIMIT'])('atomic budget %s is a real error, not pending mail', async error => {
  db.setRpcMock(async () => ({ data: { error }, error: null }));
  expect((await service.request('home', 'user')).status).toBe(429);
  expect(dispatchPostcardCode).not.toHaveBeenCalled();
});
test('receipt save failure keeps proof and never promises success', async () => {
  admit(card()); const from = supabase.from.bind(supabase);
  jest.spyOn(supabase, 'from').mockImplementation(table => {
    const q = from(table), update = q.update;
    q.update = changes => changes.vendor_job_id ? {
      eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'unavailable' } }) }) }) }),
    } : update(changes);
    return q;
  });
  expect((await service.request('home', 'user')).status).toBe(202);
  expect(db.getTable('HomePostcardCode')[0].status).toBe('pending');
});
test('status is own-only, read-only and omits proof', async () => {
  db.seedTable('HomePostcardCode', [card()]);
  expect((await service.status('home', 'other')).status).toBe(404);
  const result = await request(app).get('/api/homes/home/postcard').set('x-test-user-id', 'user');
  expect(result.status).toBe(200); expect(result.body.postcard.id).toBe(ID);
  expect(JSON.stringify(result.body)).not.toMatch(/code_hash|vendor_job_id|destination/);
  expect(dispatchPostcardCode).not.toHaveBeenCalled();
});
test('permission read failure cannot fall through to empty-home mailing', async () => {
  checkHomePermission.mockResolvedValue({ hasAccess: false, readFailed: true });
  const result = await request(app).post('/api/homes/home/request-postcard').set('x-test-user-id', 'user');
  expect(result.status).toBe(503); expect(dispatchPostcardCode).not.toHaveBeenCalled();
});
test('signed native correlation recovers only its own unresolved receipt', async () => {
  db.seedTable('HomePostcardCode', [card({ dispatch_status: 'delivery_unknown' })]);
  const event = { body: { id: 'psc_native', object: 'postcard', metadata: { pantopus_home_postcard_id: ID } } };
  expect((await service.processWebhookEvent('psc_native', 'postcard.created', event)).success).toBe(true);
  expect(db.getTable('HomePostcardCode')[0]).toMatchObject({ status: 'pending', dispatch_status: 'accepted', vendor_job_id: 'psc_native' });
  const other = { body: { ...event.body, id: 'psc_other' } };
  expect((await service.processWebhookEvent('psc_other', 'postcard.created', other)).success).toBe(false);
  expect(db.getTable('HomePostcardCode')[0].vendor_job_id).toBe('psc_native');
});
test('modern correlation cannot bind a native card', async () => {
  db.seedTable('HomePostcardCode', [card({ dispatch_status: 'delivery_unknown' })]);
  const event = { body: { id: 'psc_native', object: 'postcard', metadata: { pantopus_verification_job_id: ID } } };
  expect((await service.processWebhookEvent('psc_native', 'postcard.created', event)).success).toBe(false);
  expect(db.getTable('HomePostcardCode')[0].vendor_job_id).toBeNull();
});

test('frozen or revoked household access cannot spend postage', async () => {
  db.setRpcMock(async () => ({ data: { error: 'HOME_RESTRICTED' }, error: null }));
  expect((await service.request('home', 'user')).status).toBe(403);
  expect(dispatchPostcardCode).not.toHaveBeenCalled();
});
