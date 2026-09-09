const express = require('express');
const request = require('supertest');
const db = require('../__mocks__/supabaseAdmin');
const notifications = require('../../services/notificationService');
const service = require('../../services/homePostcardService');
const { hashPostcardCode } = require('../../utils/postcardDispatch');
const app = express().use(express.json()).use('/api/homes', require('../../routes/homeOwnership'));
const occupancy = { id: 'occ', home_id: 'home', user_id: 'user', is_active: true, role_base: 'member', verification_status: 'verified' };
beforeEach(() => { db.resetTables(); notifications.createNotification.mockReset(); });
function answer(data) { db.setRpcMock(async (name, args) => {
  expect(name).toBe('confirm_home_postcard');
  expect(args.p_user_id).toBe('user'); expect(args.p_home_id).toBe('home');
  expect(args.p_submitted_hash).toBe(hashPostcardCode('123456'));
  expect(args.p_templates.adult).toMatchObject({ role_base: 'member', can_manage_home: false, can_manage_access: false, can_manage_finance: false });
  expect(args.p_templates.child).toMatchObject({ can_view_sensitive: false, can_manage_tasks: false });
  expect(args.p_templates.provisional).toMatchObject({ role_base: 'restricted_member', can_manage_tasks: false, can_view_sensitive: false });
  return { data, error: null };
}); }
test('confirmation delegates proof and member templates to one atomic function', async () => {
  answer({ occupancy, reused: false });
  const result = await service.confirm('home', 'user', '123456');
  expect(result.status).toBe(200); expect(result.body.occupancy).toEqual(occupancy);
  expect(db.getTable('HomeOccupancy')).toHaveLength(0); // no separate JS membership write
});
test.each([
  ['NO_POSTCARD', 404], ['WRONG_CODE', 400], ['EXPIRED', 410], ['LOCKED', 429],
  ['ACCESS_REVOKED', 403], ['ADDRESS_CHANGED', 409],
])('%s is a real confirmation failure', async (error, status) => {
  answer({ error, attempts_remaining: 4 });
  const result = await request(app).post('/api/homes/home/verify-postcard').set('x-test-user-id', 'user').send({ code: '123456' });
  expect(result.status).toBe(status); expect(result.body.occupancy).toBeUndefined();
  if (error === 'WRONG_CODE') expect(result.body.attempts_remaining).toBe(4);
  expect(notifications.createNotification).not.toHaveBeenCalled();
});
test('missing RPC fails without claiming verification or consuming proof', async () => {
  expect((await service.confirm('home', 'user', '123456')).status).toBe(503);
  expect(db.getTable('HomePostcardCode')).toHaveLength(0);
});
test.each([null, { ...occupancy, is_active: false }])('malformed success cannot report usable membership', async row => {
  answer({ occupancy: row, reused: false });
  expect((await service.confirm('home', 'user', '123456')).status).toBe(503);
});
test('retry returns current membership without notifying again', async () => {
  answer({ occupancy, reused: true });
  const result = await request(app).post('/api/homes/home/verify-postcard').set('x-test-user-id', 'user').send({ code: '123456' });
  expect(result.status).toBe(200); expect(notifications.createNotification).not.toHaveBeenCalled();
});
test('notification failure cannot misreport a committed confirmation', async () => {
  answer({ occupancy, reused: false }); notifications.createNotification.mockRejectedValue(new Error('offline'));
  const result = await request(app).post('/api/homes/home/verify-postcard').set('x-test-user-id', 'user').send({ code: '123456' });
  expect(result.status).toBe(200); expect(result.body.occupancy.id).toBe('occ');
});
