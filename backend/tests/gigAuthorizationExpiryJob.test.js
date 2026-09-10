jest.mock('../services/gigAuthorizationExpiry', () => ({ recover: jest.fn(), deliverPending: jest.fn() }));
jest.mock('../services/scheduling/bookingService', () => ({ cancelBooking: jest.fn() }));
const db = require('./__mocks__/supabaseAdmin');
const expiry = require('../services/gigAuthorizationExpiry');
const booking = require('../services/scheduling/bookingService');
const bookingJob = require('../jobs/expireUncapturedAuthorizations');
const job = require('../jobs/reconcileGigAuthorizationExpiry');
const relay = require('../jobs/deliverGigAuthorizationExpiry');
beforeEach(() => {
 jest.clearAllMocks(); db.resetTables();
 expiry.recover.mockResolvedValue({ complete: true }); expiry.deliverPending.mockResolvedValue({ delivered: 0 });
 booking.cancelBooking.mockResolvedValue({ success: true });
});
test('unchanged booking policy preserves pending-slot sweep and ignores already confirmed bookings', async () => {
 db.seedTable('Payment', [
  { id: 'abandoned', booking_id: 'b1', payment_type: 'booking_payment', payment_status: 'authorize_pending', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'lapsing', booking_id: 'b2', payment_type: 'booking_payment', payment_status: 'authorized', authorization_expires_at: new Date().toISOString() },
  { id: 'taken', booking_id: 'b3', payment_type: 'booking_payment', payment_status: 'authorized', authorization_expires_at: new Date().toISOString() },
  { id: 'gig', payment_type: 'gig_payment', payment_status: 'authorized', authorization_expires_at: new Date().toISOString() },
 ]);
 db.seedTable('Booking', [{ id: 'b1', status: 'pending' }, { id: 'b2', status: 'pending' }, { id: 'b3', status: 'confirmed' }]);
 db.setRpcMock(async () => ({ data: [] }));
 await expect(bookingJob()).resolves.toEqual({ sweptBookings: true });
 expect(booking.cancelBooking.mock.calls).toEqual([
  ['b1', null, 'Payment was not completed in time.', 'system'], ['b2', null, 'Payment was not completed in time.', 'system'],
 ]);
 expect(expiry.recover).not.toHaveBeenCalled();
});
test('one unknown Gig outcome does not close a task or prevent independent candidates and durable delivery', async () => {
 db.seedTable('Gig', [{ id: 'g1', status: 'assigned' }, { id: 'g2', status: 'in_progress' }]);
 db.setRpcMock(async (name, args) => { expect(name).toBe('claim_gig_expiry_scan'); expect(args).toEqual({ p_limit: 100 }); return { data: ['p1', 'p2'] }; });
 expiry.recover.mockRejectedValueOnce(new Error('Unknown')).mockResolvedValueOnce({ complete: true });
 await expect(job()).resolves.toEqual({ checked: 2 });
 expect(expiry.recover.mock.calls).toEqual([['p1'], ['p2']]);
 await relay(); expect(expiry.deliverPending).toHaveBeenCalledWith(25);
 expect(db.getTable('Gig')).toEqual([{ id: 'g1', status: 'assigned' }, { id: 'g2', status: 'in_progress' }]);
});
test('unreadable candidate discovery fails without inventing absence or a cancellation', async () => {
 db.setRpcMock(async () => ({ error: { code: '08006' } }));
 await expect(job()).rejects.toThrow('discovery unavailable');
 expect(expiry.recover).not.toHaveBeenCalled();
 await relay(); expect(expiry.deliverPending).toHaveBeenCalledWith(25);
});
test('lost delivery acknowledgement fails the job so the same durable event can recover', async () => {
 db.setRpcMock(async () => ({ data: [] })); expiry.deliverPending.mockRejectedValue(new Error('Unknown acknowledgement'));
 await expect(relay()).rejects.toThrow('Unknown acknowledgement');
});
