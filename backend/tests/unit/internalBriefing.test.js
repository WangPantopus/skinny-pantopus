const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../services/context/providerOrchestrator', () => ({
  composeScheduledBriefing: jest.fn(),
}));
jest.mock('../../services/context/internalContextCollector', () => ({ collectInternalContext: jest.fn() }));

const { composeScheduledBriefing } = require('../../services/context/providerOrchestrator');
// jest.config maps `../services/pushService` (the route's specifier) to this
// file mock, so the test must hold the SAME instance to observe its calls —
// requiring '../../services/pushService' yields a different module.
const pushService = require('../__mocks__/pushService');

const USER_ID = '22222222-2222-2222-2222-222222222222';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/internal/briefing', require('../../routes/internalBriefing'));
  return app;
}

describe('POST /api/internal/briefing/send', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    process.env.INTERNAL_API_KEY = 'test-internal-key';
  });

  it('treats null evening preference as enabled during rollout', async () => {
    seedTable('UserNotificationPreferences', [{
      id: 'pref-1',
      user_id: USER_ID,
      daily_briefing_enabled: false,
      evening_briefing_enabled: null,
      daily_briefing_timezone: 'America/Los_Angeles',
      quiet_hours_start_local: null,
      quiet_hours_end_local: null,
    }]);

    composeScheduledBriefing.mockResolvedValue({
      should_send: false,
      skip_reason: 'low_signal_day',
      signals_snapshot: [],
      location_geohash: 'c20g8',
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/internal/briefing/send')
      .set('x-internal-api-key', 'test-internal-key')
      .send({ userId: USER_ID, briefingKind: 'evening' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'skipped', skip_reason: 'low_signal_day' });
    expect(composeScheduledBriefing).toHaveBeenCalledWith(USER_ID, { kind: 'evening' });
    expect(pushService.sendToUser).not.toHaveBeenCalled();

    const deliveries = getTable('DailyBriefingDelivery');
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].briefing_kind).toBe('evening');
    expect(deliveries[0].status).toBe('skipped');
  });

  // The briefing push used to route to '/hub/today' while both mobile
  // clients auto-land the Home tab on Place — so tapping it dropped the
  // user on the secondary address surface.
  it('deep links the push to the Place dashboard for the briefing home', async () => {
    seedTable('UserNotificationPreferences', [{
      id: 'pref-2',
      user_id: USER_ID,
      daily_briefing_enabled: true,
      evening_briefing_enabled: true,
      daily_briefing_timezone: 'America/Los_Angeles',
      quiet_hours_start_local: null,
      quiet_hours_end_local: null,
    }]);
    seedTable('PushToken', [{ user_id: USER_ID, token: 'tok-1' }]);

    composeScheduledBriefing.mockResolvedValue({
      should_send: true,
      skip_reason: null,
      text: 'Wind advisory until 6pm.',
      mode: 'template',
      tokens_used: 0,
      signals_snapshot: [{ kind: 'alert' }],
      location_geohash: 'c20g8',
      home_id: 'home-abc',
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/internal/briefing/send')
      .set('x-internal-api-key', 'test-internal-key')
      .send({ userId: USER_ID, briefingKind: 'morning' });

    expect(res.status).toBe(200);
    expect(pushService.sendToUser).not.toHaveBeenCalled();
    expect(pushService.sendToUserWithReceipt).toHaveBeenCalledTimes(1);
    const payload = pushService.sendToUserWithReceipt.mock.calls[0][1];
    // BOTH clients read `link` (then `deepLink`) and neither reads `route`,
    // so a route-only payload produces no deep link at all.
    expect(payload.data.link).toBe('/place/home-abc');
    expect(payload.data.route).toBe('/place/home-abc');
    expect(payload.data.homeId).toBe('home-abc');
    expect(payload.data.link).not.toContain('/hub');
    const taskLink = '/app/homes/home-abc/tasks/task-1';
    const reminder = await request(app)
      .post('/api/internal/briefing/reminder-push')
      .set('x-internal-api-key', 'test-internal-key')
      .send({ userId: USER_ID, title: 'Task due today', body: 'Test for radon is due today.', reminderType: 'task_due',
        data: { homeId: 'home-abc', taskId: 'task-1', category: 'TASK_REMINDER', link: taskLink, route: taskLink, recipient_user_id: 'other-account' } });
    expect(reminder.status).toBe(200);
    expect(pushService.sendToUserWithReceipt.mock.calls.at(-1)[1].data).toMatchObject({
      link: taskLink, route: taskLink, category: 'TASK_REMINDER', homeId: 'home-abc', taskId: 'task-1', recipient_user_id: USER_ID,
    });
    expect(reminder.body).toEqual({ status: 'sent' });
    expect(getTable('FunnelEvent')).toEqual([expect.objectContaining({ event_type: 'reminder_sent', user_id: USER_ID, meta: { kind: 'task' } })]);
    // A receipt means provider acceptance, not delivery to every device.
    // Partial acceptance settles this user/day rather than duplicating an
    // already accepted device; zero acceptance remains retryable.
    for (const receipt of [{ acceptedCount: 0, unresolvedCount: 0 }, { acceptedCount: 0, unresolvedCount: 1 }, undefined]) {
      pushService.sendToUserWithReceipt.mockResolvedValueOnce(receipt);
      const failed = await request(app).post('/api/internal/briefing/reminder-push')
        .set('x-internal-api-key', 'test-internal-key')
        .send({ userId: USER_ID, title: 'Task due today', body: 'Private task', reminderType: 'task_due' });
      expect(failed.status).toBe(503);
      expect(failed.body.status).toBe('failed');
      expect(getTable('FunnelEvent')).toHaveLength(1);
    }
    pushService.sendToUserWithReceipt.mockRejectedValueOnce(new Error('Provider unavailable'));
    const providerError = await request(app).post('/api/internal/briefing/reminder-push')
      .set('x-internal-api-key', 'test-internal-key')
      .send({ userId: USER_ID, title: 'Task due today', body: 'Private task', reminderType: 'task_due' });
    expect(providerError.status).toBe(500);
    expect(providerError.body.status).toBe('failed');
    expect(getTable('FunnelEvent')).toHaveLength(1);
    pushService.sendToUserWithReceipt.mockResolvedValueOnce({ acceptedCount: 1, unresolvedCount: 1 });
    const partial = await request(app).post('/api/internal/briefing/reminder-push')
      .set('x-internal-api-key', 'test-internal-key')
      .send({ userId: USER_ID, title: 'Task due today', body: 'Private task', reminderType: 'task_due' });
    expect(partial.body).toEqual({ status: 'sent' });
    expect(getTable('FunnelEvent')).toHaveLength(2);
    expect(getTable('FunnelEvent')[1]).toMatchObject({ event_type: 'reminder_sent', user_id: USER_ID, meta: { kind: 'task' } });
    const collector = require('../../services/context/internalContextCollector').collectInternalContext;
    const notifications = require('../__mocks__/notificationService');
    const due = new Date(Date.now() + 3600000).toISOString();
    const household = [
      { kind: 'bill_due', data: { bill_id: 'bill', due_date: due, amount: 144.72 }, context: { bills_due: [{ id: 'bill', due_date: due, amount: 144.72 }] } },
      { kind: 'task_due', data: { task_id: 'task', due_at: due, priority: 'high' }, context: { tasks_due: [{ id: 'task', due_at: due, priority: 'high' }] } },
      { kind: 'calendar', data: { event_id: 'event', start_at: due, event_type: 'appointment' }, context: { calendar_events: [{ id: 'event', start_at: due, event_type: 'appointment' }] } },
    ];
    for (const signal of household) {
      composeScheduledBriefing.mockResolvedValue({ should_send: true, text: 'Private household detail', mode: 'template', tokens_used: 0,
        signals_snapshot: [{ kind: signal.kind, data: signal.data }], home_id: 'home-abc', location_geohash: 'c20g8' });
      seedTable('DailyBriefingDelivery', []);
      collector.mockResolvedValue({ bills_due: [], tasks_due: [], calendar_events: [], ...signal.context });
      const accepted = await request(app).post('/api/internal/briefing/send').set('x-internal-api-key', 'test-internal-key')
        .send({ userId: USER_ID, briefingKind: 'morning' });
      expect(accepted.body.status).toBe('sent');
      for (const unreadable of [false, true]) {
        seedTable('DailyBriefingDelivery', []);
        pushService.sendToUser.mockClear();
        pushService.sendToUserWithReceipt.mockClear();
        let release;
        let entered;
        const started = new Promise(resolve => { entered = resolve; });
        notifications.isPushEnabled.mockImplementationOnce(() => { entered(); return new Promise(resolve => { release = resolve; }); });
        const pending = request(app).post('/api/internal/briefing/send').set('x-internal-api-key', 'test-internal-key')
          .send({ userId: USER_ID, briefingKind: 'morning' }).then(response => response);
        await started;
        if (unreadable) collector.mockRejectedValueOnce(new Error('Home authority unavailable'));
        else collector.mockResolvedValue({ bills_due: [], tasks_due: [], calendar_events: [] });
        release(true);
        const revoked = await pending;
        expect(revoked.status).toBe(500);
        expect(revoked.body.status).toBe('failed');
        expect(pushService.sendToUser).not.toHaveBeenCalled();
        expect(pushService.sendToUserWithReceipt).not.toHaveBeenCalled();
        expect(getTable('DailyBriefingDelivery')[0].status).toBe('failed');
        expect(getTable('DailyBriefingDelivery')[0].summary_text).toBeUndefined();
      }
      expect(collector).toHaveBeenLastCalledWith(USER_ID, 'home-abc');
    }
  });

  it('falls back to a bare Place link when the briefing has no home', async () => {
    seedTable('UserNotificationPreferences', [{
      id: 'pref-3',
      user_id: USER_ID,
      daily_briefing_enabled: true,
      evening_briefing_enabled: true,
      daily_briefing_timezone: 'America/Los_Angeles',
      quiet_hours_start_local: null,
      quiet_hours_end_local: null,
    }]);
    seedTable('PushToken', [{ user_id: USER_ID, token: 'tok-1' }]);

    composeScheduledBriefing.mockResolvedValue({
      should_send: true,
      skip_reason: null,
      text: 'Rain this afternoon.',
      mode: 'template',
      tokens_used: 0,
      signals_snapshot: [{ kind: 'precipitation' }],
      location_geohash: 'c20g8',
      home_id: null,
    });

    const app = createApp();
    await request(app)
      .post('/api/internal/briefing/send')
      .set('x-internal-api-key', 'test-internal-key')
      .send({ userId: USER_ID, briefingKind: 'morning' });

    // The client resolves the primary home, exactly as the auto-land does.
    expect(pushService.sendToUserWithReceipt.mock.calls[0][1].data.link).toBe('/place');
    expect(pushService.sendToUserWithReceipt.mock.calls[0][1].data.route).toBe('/place');
    for (const receipt of [undefined, { acceptedCount: 0, unresolvedCount: 1 }, { acceptedCount: -1 }, { acceptedCount: 0.5 }]) {
      seedTable('DailyBriefingDelivery', []);
      pushService.sendToUserWithReceipt.mockResolvedValueOnce(receipt);
      const refused = await request(app).post('/api/internal/briefing/send').set('x-internal-api-key', 'test-internal-key')
        .send({ userId: USER_ID, briefingKind: 'morning' });
      expect(refused.status).toBe(503);
      expect(refused.body.status).toBe('failed');
      expect(getTable('DailyBriefingDelivery')[0].status).toBe('failed');
      expect(getTable('DailyBriefingDelivery')[0].summary_text).toBeUndefined();
      expect(getTable('FunnelEvent')).toHaveLength(0);
    }
    pushService.sendToUserWithReceipt.mockRejectedValueOnce(new Error('Provider unavailable'));
    const providerError = await request(app).post('/api/internal/briefing/send').set('x-internal-api-key', 'test-internal-key')
      .send({ userId: USER_ID, briefingKind: 'morning' });
    expect(providerError.status).toBe(500);
    expect(getTable('DailyBriefingDelivery')).toHaveLength(1);
    expect(getTable('DailyBriefingDelivery')[0].status).toBe('failed');
    pushService.sendToUserWithReceipt.mockResolvedValueOnce({ acceptedCount: 1, unresolvedCount: 1 });
    const retry = await request(app).post('/api/internal/briefing/send').set('x-internal-api-key', 'test-internal-key')
      .send({ userId: USER_ID, briefingKind: 'morning' });
    expect(retry.body.status).toBe('sent');
    expect(getTable('DailyBriefingDelivery')).toHaveLength(1);
    expect(getTable('DailyBriefingDelivery')[0].status).toBe('sent');
    const acceptedCalls = pushService.sendToUserWithReceipt.mock.calls.length;
    const duplicate = await request(app).post('/api/internal/briefing/send').set('x-internal-api-key', 'test-internal-key')
      .send({ userId: USER_ID, briefingKind: 'morning' });
    expect(duplicate.body).toEqual({ status: 'skipped', skip_reason: 'already_processed' });
    expect(pushService.sendToUserWithReceipt).toHaveBeenCalledTimes(acceptedCalls);
  });
});

// These strings are parsed by DeepLinkRouter on iOS and Android; the shapes
// are a cross-repo contract, so they are pinned here rather than assumed.
describe('placeRoute', () => {
  const { placeRoute } = require('../../routes/internalBriefing');

  it('degrades to a bare link without a home id', () => {
    expect(placeRoute(null)).toBe('/place');
    expect(placeRoute(undefined)).toBe('/place');
    expect(placeRoute('')).toBe('/place');
    expect(placeRoute('   ')).toBe('/place');
  });

  it('addresses a specific home', () => {
    expect(placeRoute('home-1')).toBe('/place/home-1');
  });

  it('appends a group-detail slug', () => {
    expect(placeRoute('home-1', 'today')).toBe('/place/home-1/today');
    expect(placeRoute('home-1', 'risk')).toBe('/place/home-1/risk');
  });

  it('drops an unknown slug rather than emitting a dead link', () => {
    expect(placeRoute('home-1', 'not-a-group')).toBe('/place/home-1');
  });

  it('never emits a slug without a home id — the detail route needs both', () => {
    expect(placeRoute(null, 'today')).toBe('/place');
  });

  it('accepts exactly the slugs both routers parse', () => {
    for (const slug of ['today', 'your-home', 'risk', 'block', 'money', 'civic', 'identity']) {
      expect(placeRoute('h', slug)).toBe(`/place/h/${slug}`);
    }
  });
});
