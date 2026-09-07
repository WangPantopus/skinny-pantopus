// Real publish/Following/read routes and notification persistence; isolated DB
// and push mocks mean this suite cannot notify a real person.
jest.mock('../../middleware/optionalAuth', () => (req, _res, next) => {
  if (req.headers['x-test-user-id'])
    req.user = { id: req.headers['x-test-user-id'], role: 'user' };
  next();
});
jest.mock('../../jobs/organicMatch', () => ({
  matchBusinessesForPost: jest.fn(),
}));
jest.mock('../../services/s3Service', () => ({
  getPublicUrl: jest.fn((key) => key),
}));

const path = require('path');
const express = require('express');
const request = require('supertest');
const db = require('../__mocks__/supabaseAdmin');
const notifications = require('../__mocks__/notificationService');
const realNotifications = require(
  path.resolve(__dirname, '../../services/notificationService.js'),
);
const flags = require('../../services/featureFlagService');
const app = express();
app.use(express.json());
app.use('/api/broadcast', require('../../routes/broadcastChannels'));
app.use('/api/personas', require('../../routes/personas'));
app.use('/api/posts', require('../../routes/posts'));

const owner = '11111111-1111-4111-8111-111111111111';
const follower = '22222222-2222-4222-8222-222222222222';
const member = '33333333-3333-4333-8333-333333333333';
const personaId = '66666666-6666-4666-8666-666666666666';
const channelId = '77777777-7777-4777-8777-777777777777';
const tierId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const persona = {
  id: personaId,
  user_id: owner,
  handle: 'maya.builds',
  handle_normalized: 'maya.builds',
  display_name: 'Maya Builds',
  status: 'active',
  audience_mode: 'open',
};
const tier = {
  id: tierId,
  persona_id: personaId,
  rank: 2,
  name: 'Member',
  price_cents: 500,
  status: 'active',
};
const as = (req, user) => req.set('x-test-user-id', user);
const publish = (body, extra = {}) =>
  as(
    request(app).post(`/api/broadcast/channels/${channelId}/messages`),
    owner,
  ).send({ body, visibility: 'followers', ...extra });
const following = (user) =>
  as(request(app).get('/api/personas/me/following'), user);
const read = (user, postId) =>
  as(request(app).get(`/api/posts/${postId}`), user);

beforeEach(() => {
  db.resetTables();
  flags.invalidateFlagCache();
  notifications.notifyPersonaBroadcast.mockImplementation(
    realNotifications.notifyPersonaBroadcast,
  );
  db.seedTable('FeatureFlag', [
    { flag_name: 'audience_profile', enabled_globally: true },
  ]);
  db.seedTable('User', [
    { id: owner, username: 'private_owner_name' },
    { id: follower },
    { id: member },
  ]);
  db.seedTable('PublicPersona', [persona]);
  db.seedTable('BroadcastChannel', [
    {
      id: channelId,
      persona_id: personaId,
      status: 'active',
      title: 'Maya updates',
    },
  ]);
  db.seedTable('PersonaTier', [tier]);
  // The in-memory DB does not expand PostgREST joins; include the joined
  // persona/tier alongside the actual foreign keys used by the other routes.
  db.seedTable('PersonaMembership', [
    {
      id: 'free',
      persona_id: personaId,
      persona,
      user_id: follower,
      status: 'active',
      relationship_type: 'follower',
      notification_level: 'all',
      joined_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'paid',
      persona_id: personaId,
      persona,
      user_id: member,
      status: 'active',
      relationship_type: 'subscriber',
      notification_level: 'all',
      tier_id: tierId,
      tier,
      joined_at: '2026-01-01T00:00:00Z',
    },
  ]);
});
afterEach(() => {
  flags.invalidateFlagCache();
  notifications.notifyPersonaBroadcast.mockReset();
});

test('published update appears in Following and its audience notification opens the same readable post', async () => {
  const published = await publish('A new workshop for our followers');
  expect(published.status).toBe(201);
  const postId = published.body.message.id;
  const list = await following(follower);
  expect(list.status).toBe(200);
  expect(list.body.items[0]).toMatchObject({
    latestPost: { id: postId, snippet: 'A new workshop for our followers' },
    unreadCount: 1,
  });
  const notification = db
    .getTable('Notification')
    .find((n) => n.user_id === follower);
  expect(notification).toMatchObject({
    context: 'audience',
    title: 'Maya Builds shared an update',
    link: `/post/${postId}`,
    metadata: {
      persona_id: personaId,
      persona_handle: 'maya.builds',
      post_id: postId,
    },
  });
  expect(JSON.stringify(notification)).not.toContain('private_owner_name');
  const detail = await read(follower, notification.metadata.post_id);
  expect(detail.status).toBe(200);
  expect(detail.body.post).toMatchObject({
    id: postId,
    content: 'A new workshop for our followers',
  });
  // A follower can use Beacons without providing or exposing a home address.
  expect(db.getTable('Post')[0]).toMatchObject({
    home_id: null,
    latitude: null,
    longitude: null,
  });
});

test('a seven-day mute silences notifications but keeps updates readable; unmute restores notifications', async () => {
  const mute = await as(
    request(app).patch(`/api/personas/me/following/${personaId}/mute`),
    follower,
  ).send({ days: 7 });
  expect(mute.status).toBe(200);
  const first = await publish('Available while muted');
  expect(first.status).toBe(201);
  expect(
    db.getTable('Notification').filter((n) => n.user_id === follower),
  ).toHaveLength(0);
  expect((await following(follower)).body.items[0]).toMatchObject({
    latestPost: { id: first.body.message.id },
    unreadCount: 1,
  });
  expect((await read(follower, first.body.message.id)).status).toBe(200);
  const unmute = await as(
    request(app).patch(`/api/personas/me/following/${personaId}/mute`),
    follower,
  ).send({ days: null });
  expect(unmute.status).toBe(200);
  const second = await publish('Notifications are back');
  expect(second.status).toBe(201);
  expect(
    db.getTable('Notification').filter((n) => n.user_id === follower),
  ).toEqual([
    expect.objectContaining({ link: `/post/${second.body.message.id}` }),
  ]);
});

test('Member-only content stays out of free Following and notifications and is checked again on read', async () => {
  const published = await publish('Member workshop details', {
    visibility: 'tier_or_above',
    target_tier_rank: 2,
  });
  expect(published.status).toBe(201);
  const postId = published.body.message.id;
  expect((await following(follower)).body.items[0]).toMatchObject({
    latestPost: null,
    unreadCount: 0,
  });
  expect(db.getTable('Notification').map((n) => n.user_id)).toEqual([member]);
  expect((await read(follower, postId)).status).toBe(403);
  expect((await read(member, postId)).status).toBe(200);
  // An old notification must not grant access after the membership ends.
  db.getTable('PersonaMembership').find((m) => m.user_id === member).status =
    'expired';
  expect((await read(member, postId)).status).toBe(403);
});

test('a blocked former follower cannot receive, preview, or reopen an update', async () => {
  db.seedTable('PersonaBlock', [
    { persona_id: personaId, blocked_user_id: follower },
  ]);
  const published = await publish('New update');
  expect(published.status).toBe(201);
  expect((await following(follower)).body.items).toEqual([]);
  expect(
    db.getTable('Notification').filter((n) => n.user_id === follower),
  ).toEqual([]);
  expect((await read(follower, published.body.message.id)).status).toBe(403);
});

test('a notification failure does not report a stored update as a failed publish', async () => {
  notifications.notifyPersonaBroadcast.mockRejectedValueOnce(
    new Error('Notification service unavailable'),
  );
  const published = await publish('Saved despite notification outage');
  expect(published.status).toBe(201);
  expect(db.getTable('Post')).toHaveLength(1);
  expect((await following(follower)).body.items[0].latestPost.id).toBe(
    published.body.message.id,
  );
});

test.each(['PersonaBlock', 'Post'])(
  'Following reports an outage when %s cannot be checked',
  async (table) => {
    const original = db.from;
    const spy = jest.spyOn(db, 'from').mockImplementation((name) => {
      if (name !== table) return original(name);
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        is: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve) =>
          Promise.resolve({ data: null, error: { message: 'offline' } }).then(
            resolve,
          ),
      };
      return query;
    });
    try {
      const result = await following(follower);
      expect(result.status).toBe(503);
      expect(result.body.items).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  },
);
