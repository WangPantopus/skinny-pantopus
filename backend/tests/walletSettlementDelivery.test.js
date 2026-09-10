const path = require('node:path');
const db = require('./__mocks__/supabaseAdmin');
const notificationMock = require('./__mocks__/notificationService');
const push = require('./__mocks__/pushService');
const notify = require(path.resolve(__dirname, '../services/notificationService.js'));
const relay = require('../jobs/deliverWalletSettlement');
const note = { id: 'note', user_id: 'worker', type: 'payout_sent', title: 'Wallet credited',
  body: 'Synthetic credit', link: '/app/wallet', metadata: { gig_id: 'gig' } };
beforeEach(() => {
  jest.restoreAllMocks(); jest.clearAllMocks(); db.resetTables();
  db.seedTable('Notification', [note]);
  db.seedTable('MailPreferences', [{ user_id: 'worker', push_notifications: true }]);
  push.sendToUserWithReceipt.mockResolvedValue({ acceptedCount: 1, unresolvedCount: 0 });
  notificationMock.deliverStoredGigNotification.mockResolvedValue({ acceptedCount: 1, unresolvedCount: 0 });
});

describe('stored notification delivery', () => {
  test('delivers the exact stored notification and never inserts another row', async () => {
    expect(await notify.deliverStoredGigNotification(note)).toMatchObject({ acceptedCount: 1, suppressed: false });
    expect(push.sendToUserWithReceipt).toHaveBeenCalledWith('worker', expect.objectContaining({ data: {
      notificationId: 'note', type: 'payout_sent', link: '/app/wallet', gig_id: 'gig',
    } }));
    expect(db.getTable('Notification')).toEqual([note]);
  });
  test.each(['global', 'gig'])('%s opt-out leaves in-app content and suppresses transport', async (kind) => {
    if (kind === 'global') db.getTable('MailPreferences')[0].push_notifications = false;
    else db.seedTable('UserNotificationPreferences', [{ user_id: 'worker', gig_updates_enabled: false }]);
    expect((await notify.deliverStoredGigNotification(note)).suppressed).toBe(true);
    expect(push.sendToUserWithReceipt).not.toHaveBeenCalled(); expect(db.getTable('Notification')).toEqual([note]);
  });
  test('preference storage error fails closed so an opt-out cannot become a send', async () => {
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation((table) => {
      const q = from(table);
      if (table === 'UserNotificationPreferences') q.maybeSingle = async () => ({ error: { code: '08006' } });
      return q;
    });
    await expect(notify.deliverStoredGigNotification(note)).rejects.toThrow('preferences unavailable');
    expect(push.sendToUserWithReceipt).not.toHaveBeenCalled();
  });
});

describe('durable wallet settlement relay', () => {
  function fixture({ eligible = true, missingLease = false, failedAck = false } = {}) {
    let claimed = false;
    const rpc = jest.fn(async (name) => {
      if (name === 'claim_wallet_settlement_delivery') {
        if (claimed) return { data: null }; claimed = true;
        return { data: { id: 'event', lease_id: 'lease' } };
      }
      if (name === 'read_wallet_settlement_delivery') return { data: missingLease ? { error: 'LEASE_LOST' } : { eligible, notification: note } };
      if (name === 'finish_wallet_settlement_delivery') return { data: !failedAck };
      throw new Error('Unexpected RPC');
    });
    db.setRpcMock(rpc); return rpc;
  }
  test('settles only after an accepted provider receipt', async () => {
    const rpc = fixture(); expect(await relay()).toEqual({ processed: 1 });
    expect(rpc).toHaveBeenCalledWith('finish_wallet_settlement_delivery', {
      p_id: 'event', p_lease_id: 'lease', p_outcome: 'done', p_error: null,
    });
  });
  test.each([{ eligible: false }, { missingLease: true }])('lost eligibility/lease never sends: %j', async (options) => {
    fixture(options); await relay(); expect(notificationMock.deliverStoredGigNotification).not.toHaveBeenCalled();
  });
  test('unknown or partial provider outcome stays retryable under the same event identity', async () => {
    const rpc = fixture();
    notificationMock.deliverStoredGigNotification.mockResolvedValue({ acceptedCount: 1, unresolvedCount: 1 });
    await relay(); expect(rpc).toHaveBeenCalledWith('finish_wallet_settlement_delivery', {
      p_id: 'event', p_lease_id: 'lease', p_outcome: 'retry', p_error: 'provider_outcome_unknown',
    });
  });
  test('push opt-out settles as suppressed, preventing replay after preference restoration', async () => {
    const rpc = fixture();
    notificationMock.deliverStoredGigNotification.mockResolvedValue({ acceptedCount: 0, unresolvedCount: 0, suppressed: true });
    await relay(); expect(rpc).toHaveBeenCalledWith('finish_wallet_settlement_delivery', expect.objectContaining({ p_outcome: 'suppressed' }));
  });
  test('lost acknowledgement is not reported as a completed relay', async () => {
    fixture({ failedAck: true }); await expect(relay()).rejects.toThrow('receipt not saved');
    expect(db.getTable('Notification')).toEqual([note]);
  });
  test.each([{}, { acceptedCount: 1 }, { acceptedCount: 0, unresolvedCount: -1 }])('malformed transport receipt remains retryable: %j', async receipt => {
    const rpc = fixture();
    notificationMock.deliverStoredGigNotification.mockResolvedValue(receipt);
    await relay();
    expect(rpc).toHaveBeenCalledWith('finish_wallet_settlement_delivery', expect.objectContaining({ p_outcome: 'retry' }));
  });
});
