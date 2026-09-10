const express = require('express');
const request = require('supertest');
const db = require('../__mocks__/supabaseAdmin');
const service = require('../../services/addressValidation/mailVerificationService');
const app = express().use(express.json()).use('/api/address', require('../../routes/addressValidation'));
const occupancy = { id: 'membership', home_id: 'home', user_id: 'user', is_active: true, verification_status: 'verified', role_base: 'member' };
beforeEach(() => db.resetTables());
function answer(data) {
  db.setRpcMock(async (name, args) => {
    expect(name).toBe('confirm_mail_verification');
    expect(args.p_user_id).toBe('user');
    expect(args.p_submitted_hash).toBe(service._hashCode('123456'));
    expect(args.p_templates.adult).toMatchObject({ role_base: 'member', can_manage_home: false, can_manage_access: false, can_manage_finance: false });
    expect(args.p_templates.child).toMatchObject({ can_manage_tasks: false, can_view_sensitive: false });
    expect(args.p_templates.teen).toMatchObject({ can_view_sensitive: false });
    return { data, error: null };
  });
}
test('all proof and membership writes belong to one RPC', async () => {
  answer({ occupancy, reused: false });
  expect(await service.confirmCode('attempt', '123456', 'user')).toMatchObject({ verified: true, occupancy_id: 'membership' });
  expect(db.getTable('HomeOccupancy')).toHaveLength(0);
  expect(db.getTable('AddressVerificationToken')).toHaveLength(0);
});
test('missing RPC preserves proof instead of falling back to partial writes', async () => {
  db.setRpcMock(async () => ({ data: null, error: { message: 'missing function' } }));
  expect(await service.confirmCode('attempt', '123456', 'user')).toMatchObject({ verified: false, statusCode: 503 });
  expect(db.getTable('AddressVerificationToken')).toHaveLength(0);
});
test.each([
  ['NOT_FOUND', 404], ['ACCESS_REVOKED', 403], ['ADDRESS_CHANGED', 409],
  ['HOME_OCCUPIED', 409], ['AMBIGUOUS_HOME', 409], ['UNBOUND_DESTINATION', 409], ['INCONSISTENT_PROOF', 503],
])('%s does not report confirmed membership', async (error, statusCode) => {
  answer({ error });
  expect(await service.confirmCode('attempt', '123456', 'user')).toMatchObject({ verified: false, statusCode });
});
test.each([null, { ...occupancy, is_active: false }, { ...occupancy, user_id: 'another' }, { ...occupancy, verification_status: 'pending_approval' }])('unusable RPC membership fails closed', async row => {
  answer({ occupancy: row });
  expect(await service.confirmCode('attempt', '123456', 'user')).toMatchObject({ verified: false, statusCode: 503 });
});
test('a correct-code retry observes current membership', async () => {
  answer({ occupancy, reused: true });
  expect(await service.confirmCode('attempt', '123456', 'user')).toEqual({ verified: true, occupancy_id: 'membership', reused: true });
});
test('a confirmation RPC outage reaches the client as retryable 503', async () => {
  db.setRpcMock(async () => ({ data: null, error: { message: 'unavailable' } }));
  const result = await request(app).post('/api/address/verify/mail/confirm')
    .set('x-test-user-id', 'user').send({ verification_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', code: '123456' });
  expect(result.status).toBe(503);
  expect(result.body.status).toBeUndefined();
});
