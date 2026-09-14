const path = require('node:path');
const db = require('../__mocks__/supabaseAdmin');
const push = require('../__mocks__/pushService');
const notifications = require(path.resolve(__dirname, '../../services/notificationService.js'));
const note = { id: 'original-notice', user_id: 'recipient', type: 'task_assigned',
  title: 'A Home task was assigned to you', body: 'Open Pantopus to view the current task details.',
  context: 'personal', context_type: 'personal', context_id: null, link: '/app/homes/home/dashboard?tab=tasks',
  metadata: { home_id: 'home', task_id: 'task', assignment_event_id: 'original-event' } };
beforeEach(() => {
  db.resetTables(); jest.clearAllMocks();
  push.sendToUserWithReceipt = jest.fn().mockResolvedValue({ acceptedCount: 1, unresolvedCount: 0 });
  db.seedTable('Notification', [note]);
});
test.each([
  [true, true, true, false], [false, true, true, true], [true, false, true, true],
  [true, true, false, true], [true, undefined, true, true], [true, true, undefined, false],
])('assignment=%s global=%s Home=%s suppresses=%s without recreating in-app notice', async (atAssignment, global, home, suppressed) => {
  if (global !== undefined) db.seedTable('MailPreferences', [{ user_id: note.user_id, push_notifications: global }]);
  if (home !== undefined) db.seedTable('UserNotificationPreferences', [{ user_id: note.user_id, home_reminders_enabled: home }]);
  const result = await notifications.deliverStoredHomeTaskNotification(note, { pushAllowedAtAssignment: atAssignment });
  expect(result.suppressed).toBe(suppressed);
  expect(db.getTable('Notification')).toEqual([note]);
  if (suppressed) expect(push.sendToUserWithReceipt).not.toHaveBeenCalled();
  else expect(push.sendToUserWithReceipt).toHaveBeenCalledWith(note.user_id, expect.objectContaining({
    data: { ...note.metadata, notificationId: note.id, type: note.type, link: note.link },
  }));
});
test.each(['audience', 'business'])('foreign %s context cannot enter assignment transport', async context => {
  await expect(notifications.deliverStoredHomeTaskNotification({ ...note, context }, { pushAllowedAtAssignment: true })).rejects.toThrow();
  expect(push.sendToUserWithReceipt).not.toHaveBeenCalled();
});
