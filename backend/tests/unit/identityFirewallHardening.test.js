const express = require('express');
const request = require('supertest');
const {
  resetTables,
  seedTable,
  getTable,
} = require('../__mocks__/supabaseAdmin');
const notificationService = require('../../services/notificationService');

jest.setTimeout(15000);

jest.mock('../../middleware/optionalAuth', () => (req, _res, next) => {
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'], role: req.headers['x-test-role'] || 'user' };
  }
  next();
});

const mockUploadToS3 = jest.fn();
const mockDeleteFromS3 = jest.fn();
jest.mock('../../services/s3Service', () => ({
  isAllowedType: (mimeType) => String(mimeType || '').startsWith('image/'),
  categorizeFile: (mimeType) => (String(mimeType || '').startsWith('image/') ? 'image' : null),
  MAX_FILE_SIZES: { image: 10 * 1024 * 1024, video: 100 * 1024 * 1024, document: 25 * 1024 * 1024 },
  uploadToS3: (...args) => mockUploadToS3(...args),
  deleteFromS3: (...args) => mockDeleteFromS3(...args),
}));

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const USER_C = '33333333-3333-4333-8333-333333333333';
const PERSONA_A = '44444444-4444-4444-8444-444444444444';
const CHANNEL_A = '55555555-5555-4555-8555-555555555555';

const originalFlags = {
  IDENTITY_FIREWALL_ENABLED: process.env.IDENTITY_FIREWALL_ENABLED,
  PERSONA_ENABLED: process.env.PERSONA_ENABLED,
  PERSONA_BROADCAST_ENABLED: process.env.PERSONA_BROADCAST_ENABLED,
};

function restoreFlags() {
  for (const [key, value] of Object.entries(originalFlags)) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
}

function enableIdentityFlags() {
  process.env.IDENTITY_FIREWALL_ENABLED = 'true';
  process.env.PERSONA_ENABLED = 'true';
  process.env.PERSONA_BROADCAST_ENABLED = 'true';
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/personas', require('../../routes/personas'));
  app.use('/api/broadcast', require('../../routes/broadcastChannels'));
  app.use('/api/identity-center', require('../../routes/identityCenter'));
  app.use('/api/local-profiles', require('../../routes/localProfiles'));
  app.use('/api/privacy', require('../../routes/privacy'));
  app.use('/api/users', require('../../routes/blocks'));
  app.use('/api/posts', require('../../routes/posts'));
  app.use('/api/upload', require('../../routes/upload'));
  return app;
}

function seedUsers() {
  seedTable('User', [
    { id: USER_A, username: 'maya', name: 'Maya', email: 'maya@example.com', verified: true },
    { id: USER_B, username: 'viewer', name: 'Viewer' },
    { id: USER_C, username: 'blocked', name: 'Blocked User' },
  ]);
}

function seedPersona() {
  seedTable('PublicPersona', [{
    id: PERSONA_A,
    user_id: USER_A,
    handle: 'MayaBuilds',
    handle_normalized: 'mayabuilds',
    display_name: 'Maya Builds',
    category: 'creator',
    audience_label: 'followers',
    audience_mode: 'open',
    follower_count: 0,
    post_count: 0,
    status: 'active',
  }]);
  seedTable('IdentityBridgeSetting', [{
    id: 'bridge-a',
    user_id: USER_A,
    persona_id: PERSONA_A,
    show_persona_on_local: false,
    show_local_on_persona: false,
  }]);
  seedTable('LocalProfile', [{
    id: 'local-a',
    user_id: USER_A,
    handle: 'RiverHome',
    handle_normalized: 'riverhome',
    display_name: 'RiverHome',
  }]);
  seedTable('BroadcastChannel', [{
    id: CHANNEL_A,
    persona_id: PERSONA_A,
    title: 'Maya Builds Broadcast',
    status: 'active',
  }]);
}

function auditActions() {
  return getTable('IdentityAuditLog').map((row) => row.action);
}

describe('Identity Firewall backend hardening', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    enableIdentityFlags();
    seedUsers();
    seedTable('IdentityAuditLog', []);
    seedTable('PersonaFollow', []);
    seedTable('UserBlock', []);
    seedTable('UserProfileBlock', []);
    seedTable('Post', []);
    seedTable('PostHide', []);
    seedTable('PostMute', []);
    seedTable('UserMute', []);
    seedTable('UserFeedPreference', []);
    seedTable('PostLike', []);
    seedTable('PostSave', []);
    seedTable('PostShare', []);
    seedTable('Notification', []);
    seedTable('UserNotificationPreferences', []);
    mockUploadToS3.mockResolvedValue({
      url: 'https://cdn.example.com/persona-avatar.webp',
      key: `persona-media/${PERSONA_A}/avatar-test.webp`,
    });
    mockDeleteFromS3.mockResolvedValue(true);
  });

  afterAll(() => {
    restoreFlags();
  });

  test('persona create and update write identity audit records', async () => {
    const app = createApp();

    const createRes = await request(app)
      .post('/api/personas')
      .set('x-test-user-id', USER_A)
      .send({
        handle: 'MayaBuilds',
        display_name: 'Maya Builds',
        category: 'creator',
        audience_label: 'followers',
        audience_mode: 'open',
      });

    expect(createRes.status).toBe(201);
    const personaId = getTable('PublicPersona')[0].id;

    const updateRes = await request(app)
      .patch(`/api/personas/${personaId}`)
      .set('x-test-user-id', USER_A)
      .send({ display_name: 'Maya Builds Studio', audience_label: 'members' });

    expect(updateRes.status).toBe(200);
    expect(auditActions()).toEqual(expect.arrayContaining([
      'persona.created',
      'persona.updated',
    ]));
    expect(getTable('IdentityAuditLog')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'persona.created',
        actor_user_id: USER_A,
        target_user_id: USER_A,
        persona_id: personaId,
        target_type: 'PublicPersona',
      }),
      expect.objectContaining({
        action: 'persona.updated',
        metadata: expect.objectContaining({
          changed_fields: ['audience_label', 'display_name'],
        }),
      }),
    ]));
  });

  test('follow, bridge, broadcast, and block mutations write audit records', async () => {
    const app = createApp();
    seedPersona();

    const followRes = await request(app)
      .post(`/api/personas/${PERSONA_A}/follow`)
      .set('x-test-user-id', USER_B);
    expect(followRes.status).toBe(201);

    const bridgeRes = await request(app)
      .patch(`/api/identity-center/bridges/${PERSONA_A}`)
      .set('x-test-user-id', USER_A)
      .send({ show_persona_on_local: true, show_local_on_persona: true });
    expect(bridgeRes.status).toBe(200);

    const broadcastRes = await request(app)
      .post(`/api/broadcast/channels/${CHANNEL_A}/messages`)
      .set('x-test-user-id', USER_A)
      .send({ body: 'A hardened broadcast', visibility: 'followers' });
    expect(broadcastRes.status).toBe(201);

    const scopedBlockRes = await request(app)
      .post('/api/privacy/blocks')
      .set('x-test-user-id', USER_A)
      .send({ blocked_user_id: USER_C, block_scope: 'full', reason: 'privacy' });
    expect(scopedBlockRes.status).toBe(201);

    const userBlockRes = await request(app)
      .post(`/api/users/${USER_C}/block`)
      .set('x-test-user-id', USER_A)
      .send({ reason: 'chat safety' });
    expect(userBlockRes.status).toBe(200);

    expect(auditActions()).toEqual(expect.arrayContaining([
      'persona.followed',
      'identity.bridge_updated',
      'persona.broadcast_published',
      'privacy.block_created',
      'user.blocked',
    ]));
    expect(getTable('IdentityAuditLog')).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'persona.followed', actor_user_id: USER_B, target_user_id: USER_A, persona_id: PERSONA_A }),
      expect.objectContaining({ action: 'identity.bridge_updated', actor_user_id: USER_A, persona_id: PERSONA_A }),
      expect.objectContaining({ action: 'persona.broadcast_published', actor_user_id: USER_A, persona_id: PERSONA_A }),
      expect.objectContaining({ action: 'privacy.block_created', actor_user_id: USER_A, target_user_id: USER_C }),
      expect.objectContaining({ action: 'user.blocked', actor_user_id: USER_A, target_user_id: USER_C }),
    ]));
    expect(notificationService.notifyPersonaFollow).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: USER_A,
      fanDisplayName: expect.any(String),
      fanHandle: expect.any(String),
      personaId: PERSONA_A,
      personaHandle: 'MayaBuilds',
      followStatus: 'active',
    }));
    expect(notificationService.notifyPersonaBroadcast).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserIds: [USER_B],
      personaId: PERSONA_A,
      personaHandle: 'MayaBuilds',
      messageId: broadcastRes.body.message.id,
      visibility: 'followers',
    }));
    expect(broadcastRes.body.message.delivered_count).toBe(1);
  });

  test('persona owner can manage followers and followers can update broadcast notification preferences', async () => {
    const app = createApp();
    seedPersona();
    seedTable('PersonaFollow', [{
      id: 'follow-pending',
      persona_id: PERSONA_A,
      follower_user_id: USER_B,
      relationship_type: 'follower',
      status: 'pending',
      source: 'follow_request',
      notification_level: 'all',
      public_visibility: 'private',
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    }]);

    const listPending = await request(app)
      .get(`/api/personas/${PERSONA_A}/followers?status=pending`)
      .set('x-test-user-id', USER_A);
    expect(listPending.status).toBe(200);
    expect(listPending.body.counts.pending).toBe(1);
    expect(listPending.body.followers[0]).toMatchObject({
      id: 'follow-pending',
      status: 'pending',
      follower: {
        type: 'local',
        handle: 'viewer',
      },
    });
    expect(JSON.stringify(listPending.body)).not.toContain('follower_user_id');

    const approve = await request(app)
      .patch(`/api/personas/${PERSONA_A}/followers/follow-pending`)
      .set('x-test-user-id', USER_A)
      .send({ status: 'active', relationship_type: 'member' });
    expect(approve.status).toBe(200);
    expect(approve.body.follower).toMatchObject({
      id: 'follow-pending',
      status: 'active',
      relationshipType: 'member',
    });
    expect(notificationService.notifyPersonaFollowApproved).toHaveBeenCalledWith(expect.objectContaining({
      fanUserId: USER_B,
      personaId: PERSONA_A,
      personaHandle: 'MayaBuilds',
      personaDisplayName: 'Maya Builds',
      membershipId: 'follow-pending',
    }));
    expect(getTable('PublicPersona')[0].follower_count).toBe(1);
    expect(auditActions()).toContain('persona.follower_updated');

    const pref = await request(app)
      .patch(`/api/personas/${PERSONA_A}/follow/preferences`)
      .set('x-test-user-id', USER_B)
      .send({ notification_level: 'highlights' });
    expect(pref.status).toBe(200);
    expect(pref.body.notificationLevel).toBe('highlights');
    expect(getTable('PersonaFollow')[0].notification_level).toBe('highlights');
    expect(auditActions()).toContain('persona.follow_notification_updated');

    const block = await request(app)
      .patch(`/api/personas/${PERSONA_A}/followers/follow-pending`)
      .set('x-test-user-id', USER_A)
      .send({ status: 'blocked' });
    expect(block.status).toBe(200);
    expect(getTable('PublicPersona')[0].follower_count).toBe(0);
  });

  test('broadcast analytics expose owner counters and read updates', async () => {
    const app = createApp();
    seedPersona();
    seedTable('PersonaFollow', [{
      id: 'follow-active',
      persona_id: PERSONA_A,
      follower_user_id: USER_B,
      relationship_type: 'follower',
      status: 'active',
      source: 'self_follow',
      notification_level: 'all',
      public_visibility: 'private',
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    }]);

    const publish = await request(app)
      .post(`/api/broadcast/channels/${CHANNEL_A}/messages`)
      .set('x-test-user-id', USER_A)
      .send({ body: 'Analytics broadcast', visibility: 'followers' });
    expect(publish.status).toBe(201);
    expect(publish.body.message.delivered_count).toBe(1);
    expect(publish.body.message.read_count).toBe(0);

    const read = await request(app)
      .post(`/api/broadcast/messages/${publish.body.message.id}/read`)
      .set('x-test-user-id', USER_B);
    expect(read.status).toBe(200);
    expect(read.body.message.read_count).toBe(1);

    const ownerMessages = await request(app)
      .get(`/api/broadcast/channels/${CHANNEL_A}/messages`)
      .set('x-test-user-id', USER_A);
    expect(ownerMessages.status).toBe(200);
    expect(ownerMessages.body.analytics).toEqual({ deliveredCount: 1, readCount: 1 });

    const followerMessages = await request(app)
      .get(`/api/broadcast/channels/${CHANNEL_A}/messages`)
      .set('x-test-user-id', USER_B);
    expect(followerMessages.status).toBe(200);
    expect(followerMessages.body.analytics).toBeNull();
  });

  test('feature flags hide disabled identity, persona, broadcast, and persona feed surfaces', async () => {
    const app = createApp();
    seedPersona();

    process.env.IDENTITY_FIREWALL_ENABLED = 'false';
    expect((await request(app).get('/api/local-profiles/RiverHome')).status).toBe(404);
    expect((await request(app).get('/api/identity-center').set('x-test-user-id', USER_A)).status).toBe(404);

    process.env.IDENTITY_FIREWALL_ENABLED = 'true';
    process.env.PERSONA_ENABLED = 'false';
    expect((await request(app).get('/api/personas/MayaBuilds')).status).toBe(404);
    expect((await request(app).get('/api/posts/feed?surface=personas').set('x-test-user-id', USER_B)).status).toBe(404);

    process.env.PERSONA_ENABLED = 'true';
    process.env.PERSONA_BROADCAST_ENABLED = 'false';
    expect((await request(app).get(`/api/broadcast/channels/${CHANNEL_A}/messages`)).status).toBe(404);
  });

  test('persona follow writes are rate limited', async () => {
    const app = createApp();
    seedPersona();
    const rateUserId = '99999999-9999-4999-8999-999999999999';

    let lastRes;
    for (let i = 0; i < 16; i += 1) {
      lastRes = await request(app)
        .post(`/api/personas/${PERSONA_A}/follow`)
        .set('x-test-user-id', rateUserId);
    }

    expect(lastRes.status).toBe(429);
    expect(lastRes.body.error).toMatch(/Too many Beacon follow requests/);
  });

  test('persona media upload is owner-scoped and updates only persona media fields', async () => {
    const app = createApp();
    seedPersona();

    const res = await request(app)
      .post(`/api/upload/persona-media/${PERSONA_A}?type=avatar`)
      .set('x-test-user-id', USER_A)
      .attach('file', Buffer.from('avatar-image'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://cdn.example.com/persona-avatar.webp');
    expect(getTable('PublicPersona')[0].avatar_url).toBe('https://cdn.example.com/persona-avatar.webp');
    expect(mockUploadToS3).toHaveBeenCalledTimes(1);
    expect(mockUploadToS3.mock.calls[0][1]).toContain(`persona-media/${PERSONA_A}/avatar-`);
    expect(mockUploadToS3.mock.calls[0][1]).not.toContain(USER_A);
    expect(getTable('IdentityAuditLog')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'persona.avatar_uploaded',
        actor_user_id: USER_A,
        target_user_id: USER_A,
        persona_id: PERSONA_A,
      }),
    ]));

    mockUploadToS3.mockClear();
    const forbidden = await request(app)
      .post(`/api/upload/persona-media/${PERSONA_A}?type=banner`)
      .set('x-test-user-id', USER_B)
      .attach('file', Buffer.from('banner-image'), {
        filename: 'banner.png',
        contentType: 'image/png',
      });

    expect(forbidden.status).toBe(403);
    expect(mockUploadToS3).not.toHaveBeenCalled();
  });
});
