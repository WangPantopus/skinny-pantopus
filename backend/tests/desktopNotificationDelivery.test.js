const path = require('node:path');
const db = require('./__mocks__/supabaseAdmin');
const notifications = require(path.resolve(__dirname, '../services/notificationService.js'));
const emit = jest.fn();
const userId = 'recipient';
const input = { userId, type: 'persona_broadcast', title: 'Beacon update', link: '/post/exact-post' };
const drain = () => new Promise(setImmediate);

beforeEach(() => {
  jest.restoreAllMocks(); jest.clearAllMocks(); db.resetTables();
  db.seedTable('MailPreferences', [{ user_id: userId, push_notifications: true }]);
  notifications.init({ to: () => ({ emit }) }, new Map([[userId, new Set(['socket'])]]));
});
afterEach(() => notifications.init(null, null));

describe.each(['single', 'bulk'])('%s browser alert eligibility', (mode) => {
  async function publish() {
    const note = mode === 'single' ? await notifications.createNotification(input)
      : (await notifications.createBulkNotifications([input]))[0];
    await drain(); return note;
  }
  test.each(['global', 'beacon'])('%s opt-out preserves in-app updates and blocks browser alerts', async (kind) => {
    if (kind === 'global') db.getTable('MailPreferences')[0].push_notifications = false;
    else db.seedTable('UserNotificationPreferences', [{ user_id: userId, beacon_push_enabled: false }]);
    const note = await publish();
    expect(emit).toHaveBeenCalledWith('notification:new', note);
    expect(emit).not.toHaveBeenCalledWith('notification:alert', expect.anything());
    expect(db.getTable('Notification')).toHaveLength(1);
  });
  test('restoring preferences alerts only for the next exact stored notification', async () => {
    db.getTable('MailPreferences')[0].push_notifications = false;
    const quiet = await publish();
    db.getTable('MailPreferences')[0].push_notifications = true;
    await drain();
    expect(emit).not.toHaveBeenCalledWith('notification:alert', quiet);
    const next = await publish();
    expect(emit.mock.calls.filter(([event]) => event === 'notification:alert')).toEqual([['notification:alert', next]]);
    expect(next.link).toBe('/post/exact-post');
  });
});

test.each([[true,true],[true,false],[false,true]])('durable Home notice honors assignment=%s and current=%s', async (atAssignment, current) => {
  const push = require('./__mocks__/pushService');
  push.sendToUserWithReceipt = jest.fn().mockResolvedValue({ acceptedCount:1,unresolvedCount:0 });
  db.seedTable('UserNotificationPreferences', [{ user_id:userId,home_reminders_enabled:current }]);
  const note = { id:'task-note',user_id:userId,type:'task_assigned',title:'A Home task was assigned to you',
    context:'personal',context_type:'personal',context_id:null,link:'/app/homes/home/dashboard?tab=tasks',
    metadata:{home_id:'home',task_id:'task',assignment_event_id:'assignment'} };
  await notifications.deliverStoredHomeTaskNotification(note,{pushAllowedAtAssignment:atAssignment});
  expect(emit).toHaveBeenCalledWith('notification:new',note);
  expect(emit.mock.calls.filter(([event])=>event==='notification:alert')).toEqual(atAssignment&&current?[['notification:alert',note]]:[]);
});

test.each(['persona_broadcast', 'gig_completed', 'home_update', 'mail_new'])('%s preference read failure cannot emit a browser alert', async (type) => {
  const from = db.from.bind(db);
  jest.spyOn(db, 'from').mockImplementation((table) => {
    const query = from(table);
    if (table === 'UserNotificationPreferences') query.maybeSingle = async () => ({ error: { code: '08006' } });
    return query;
  });
  const note = await notifications.createNotification({ ...input, type }); await drain();
  expect(emit).toHaveBeenCalledWith('notification:new', note);
  expect(emit).not.toHaveBeenCalledWith('notification:alert', expect.anything());
});
