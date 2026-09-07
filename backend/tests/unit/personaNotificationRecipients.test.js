const db = require('../__mocks__/supabaseAdmin');
const {
  getPersonaNotificationRecipientIds,
} = require('../../services/personaNotificationRecipients');
const {
  runPostCreatedHooksNow,
} = require('../../services/postCreationHooksService');
const notifications = require('../__mocks__/notificationService');
const persona = { id: 'beacon', user_id: 'owner', display_name: 'Public Name' };
const now = Date.parse('2026-09-07T00:00:00Z');
const member = (user_id, extra = {}) => ({
  persona_id: 'beacon',
  user_id,
  status: 'active',
  notification_level: 'all',
  ...extra,
});
beforeEach(() => {
  db.resetTables();
  jest.clearAllMocks();
});

test('selects active, opted-in, unmuted and unblocked followers only', async () => {
  db.seedTable('PersonaMembership', [
    member('active'),
    member('expired-mute', { muted_until: '2026-09-06T00:00:00Z' }),
    member('muted', { muted_until: '2099-01-01T00:00:00Z' }),
    member('off', { notification_level: 'none' }),
    member('pending', { status: 'pending' }),
    member('blocked'),
    member('owner'),
    member('invalid-mute', { muted_until: 'invalid' }),
    member('past-due', { status: 'past_due' }),
  ]);
  db.seedTable('PersonaBlock', [
    { persona_id: 'beacon', blocked_user_id: 'blocked' },
  ]);
  expect(
    await getPersonaNotificationRecipientIds(persona, 'followers', null, now),
  ).toEqual(['active', 'expired-mute', 'past-due']);
});

test('limits notification content to the permitted tier and supports legacy subscribers', async () => {
  db.seedTable('PersonaMembership', [
    member('free'),
    member('member', { tier_id: 't2' }),
    member('insider', { tier_id: 't3' }),
    member('legacy', { relationship_type: 'subscriber' }),
  ]);
  db.seedTable('PersonaTier', [
    { id: 't2', rank: 2 },
    { id: 't3', rank: 3 },
  ]);
  expect(
    await getPersonaNotificationRecipientIds(persona, 'tier_or_above', 2, now),
  ).toEqual(['member', 'insider', 'legacy']);
  expect(
    await getPersonaNotificationRecipientIds(persona, 'tier_or_above', 3, now),
  ).toEqual(['insider']);
});

test('ordinary persona post hooks also respect notification preferences and mute', async () => {
  db.seedTable('PersonaMembership', [
    member('active'),
    member('off', { notification_level: 'none' }),
    member('muted', { muted_until: '2099-01-01T00:00:00Z' }),
  ]);
  await runPostCreatedHooksNow({
    post: {
      id: 'post',
      content: 'New update',
      distribution_targets: ['persona_followers'],
    },
    userId: 'owner',
    personaContext: persona,
    rateLimit: false,
  });
  expect(notifications.createBulkNotifications).toHaveBeenCalledWith([
    expect.objectContaining({ userId: 'active', link: '/posts/post' }),
  ]);
});

test.each(['PersonaBlock', 'PersonaTier'])(
  'fails closed when %s cannot be checked',
  async (table) => {
    db.seedTable('PersonaMembership', [member('member', { tier_id: 't2' })]);
    const original = db.from;
    const spy = jest.spyOn(db, 'from').mockImplementation((name) => {
      if (name !== table) return original(name);
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        then: (resolve) =>
          Promise.resolve({ data: null, error: { message: 'offline' } }).then(
            resolve,
          ),
      };
      return query;
    });
    try {
      expect(
        await getPersonaNotificationRecipientIds(
          persona,
          'tier_or_above',
          2,
          now,
        ),
      ).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  },
);
