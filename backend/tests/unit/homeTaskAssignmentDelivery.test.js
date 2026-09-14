const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/notificationService', () => ({ deliverStoredHomeTaskNotification: jest.fn() }));
const notifications = require('../../services/notificationService');
const service = require('../../services/homeTaskAssignmentDeliveryService');
const event = { id: 'original-event', lease_id: 'current-lease' };
const args = { p_id: event.id, p_lease_id: event.lease_id };
const notification = { id: 'original-notification' };
let calls;
function setup(current = { eligible: true, notification, push_allowed_at_assignment: true }, acknowledged = true) {
  let claimed = false;
  calls = [];
  db.setRpcMock(async (name, input) => {
    calls.push([name, input]);
    if (name === 'claim_home_task_assignment_delivery') {
      if (claimed) return { data: null }; claimed = true; return { data: event };
    }
    if (name === 'read_home_task_assignment_delivery') return current instanceof Error
      ? { error: current } : { data: current };
    if (name === 'finish_home_task_assignment_delivery') return { data: acknowledged };
    throw new Error('Unexpected RPC');
  });
}
beforeEach(() => {
  db.resetTables(); jest.clearAllMocks();
  notifications.deliverStoredHomeTaskNotification.mockReset().mockResolvedValue({ acceptedCount: 1, unresolvedCount: 0, suppressed: false });
});
test.each([
  [{ acceptedCount: 1, unresolvedCount: 0 }, 'done'],
  [{ acceptedCount: 1, unresolvedCount: 1 }, 'retry'],
  [{ acceptedCount: 0, unresolvedCount: 0, suppressed: true }, 'suppressed'],
  [{ acceptedCount: 0, unresolvedCount: 0 }, 'done'],
  [{ acceptedCount: -1, unresolvedCount: 0 }, 'retry'],
  [{ acceptedCount: 1 }, 'retry'],
])('provider receipt %j determines acknowledgement %s', async (receipt, outcome) => {
  setup(); notifications.deliverStoredHomeTaskNotification.mockResolvedValue(receipt);
  await service.deliverPending();
  expect(notifications.deliverStoredHomeTaskNotification).toHaveBeenCalledWith(notification, { pushAllowedAtAssignment: true });
  expect(calls).toContainEqual(['finish_home_task_assignment_delivery', { ...args, p_outcome: outcome }]);
});
test.each([{ eligible: false }, { lease_lost: true }, null, { eligible: true }, new Error('private SQL failure')])(
  'unproved current delivery %j never reaches transport', async current => {
    setup(current); await service.deliverPending();
    expect(notifications.deliverStoredHomeTaskNotification).not.toHaveBeenCalled();
    if (current?.lease_lost) expect(calls.some(([name]) => name === 'finish_home_task_assignment_delivery')).toBe(false);
    else expect(calls).toContainEqual(['finish_home_task_assignment_delivery', { ...args, p_outcome: current?.eligible === false ? 'suppressed' : 'retry' }]);
  },
);
test('unknown provider completion retains original event and notification for retry', async () => {
  setup(); notifications.deliverStoredHomeTaskNotification.mockRejectedValue(new Error('lost provider response'));
  expect(await service.deliverPending()).toEqual({ selected: 1, delivered: 0, suppressed: 0, retry: 1, leaseLost: 0 });
  expect(calls).toContainEqual(['finish_home_task_assignment_delivery', { ...args, p_outcome: 'retry' }]);
});
test('assignment replaced during transport cannot acknowledge an obsolete lease', async () => {
  setup(undefined, false);
  expect((await service.deliverPending()).leaseLost).toBe(1);
});
test('off-at-assignment snapshot reaches transport suppression unchanged', async () => {
  setup({ eligible: true, notification, push_allowed_at_assignment: false });
  await service.deliverPending(1);
  expect(notifications.deliverStoredHomeTaskNotification).toHaveBeenCalledWith(notification, { pushAllowedAtAssignment: false });
  expect(calls.filter(([name]) => name === 'claim_home_task_assignment_delivery')).toHaveLength(1);
});
