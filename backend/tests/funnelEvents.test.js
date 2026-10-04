/**
 * Tests for the funnel instrumentation (wedge Phase 1):
 *   • POST /api/public/funnel-events accepts whitelisted client events,
 *     writes a FunnelEvent row, and always answers 204;
 *   • server-owned event types (t1_account_created) posted by a client are
 *     silently dropped — no row, still 204 (beacons never error);
 *   • recordFunnelEvent drops unknown types and never throws.
 */

const express = require('express');
const request = require('supertest');
const { resetTables, getTable, seedTable } = require('./__mocks__/supabaseAdmin');

jest.mock('../services/context/providerOrchestrator', () => ({
  getHubToday: jest.fn(),
  clearHubTodayCache: jest.fn(),
}));

const publicRouter = require('../routes/public');
const { recordFunnelEvent } = require('../services/funnelEvents');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public', publicRouter);
  app.use('/api/hub', require('../routes/hub'));
  return app;
}

describe('POST /api/public/funnel-events', () => {
  beforeEach(() => resetTables());

  it('records a whitelisted client event and returns 204', async () => {
    const res = await request(makeApp())
      .post('/api/public/funnel-events')
      .send({ event_type: 't0_wall_viewed', anon_id: 'abc123', meta: { status: 'ready' } });

    expect(res.status).toBe(204);
    const rows = getTable('FunnelEvent');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event_type: 't0_wall_viewed',
      anon_id: 'abc123',
      user_id: null,
      meta: { status: 'ready' },
    });
  });

  it('accepts the aha and share beacons with their small metas', async () => {
    const app = makeApp();
    await request(app).post('/api/public/funnel-events')
      .send({ event_type: 't0_aha_viewed', anon_id: 'v1', meta: { section_id: 'lead_radon', tone: 'alert', grade: 'Radon zone 1', route: 'eddm-lacamas-1' } });
    await request(app).post('/api/public/funnel-events')
      .send({ event_type: 't0_share_clicked', anon_id: 'v1', meta: { method: 'copy' } });
    const rows = getTable('FunnelEvent');
    expect(rows.map((r) => r.event_type)).toEqual(['t0_aha_viewed', 't0_share_clicked']);
    expect(rows[0].meta).toMatchObject({ section_id: 'lead_radon', tone: 'alert', route: 'eddm-lacamas-1' });
  });

  it('drops server-owned event types without erroring', async () => {
    const res = await request(makeApp())
      .post('/api/public/funnel-events')
      .send({ event_type: 't1_account_created', anon_id: 'abc123' });

    expect(res.status).toBe(204);
    expect(getTable('FunnelEvent')).toHaveLength(0);
  });

  it('drops garbage payloads without erroring', async () => {
    const res = await request(makeApp())
      .post('/api/public/funnel-events')
      .send({ event_type: 42, meta: 'not-an-object' });

    expect(res.status).toBe(204);
    expect(getTable('FunnelEvent')).toHaveLength(0);
  });
});

describe('authenticated pilot funnel events', () => {
  const actor = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
  beforeEach(() => resetTables());

  it('records app events for the authenticated actor with only small allowlisted metadata', async () => {
    const res = await request(makeApp()).post('/api/hub/funnel-events')
      .set('x-test-user-id', actor)
      .send({ event_type: 'session_open', user_id: 'another-person', anon_id: 'untrusted',
        meta: { platform: 'ios', trigger: 'push', push_type: 'task_due', kind: 'task',
          address: 'private address', coordinates: [1, 2], action: 'x'.repeat(41),
          date: 42, decision: null } });
    expect(res.status).toBe(204);
    expect(getTable('FunnelEvent')).toEqual([expect.objectContaining({
      event_type: 'session_open', user_id: actor, anon_id: null,
      meta: { platform: 'ios', trigger: 'push', push_type: 'task_due', kind: 'task' },
    })]);
    for (const event_type of ['reminder_action', 'suggestion_decision']) {
      expect((await request(makeApp()).post('/api/hub/funnel-events')
        .send({ event_type, meta: { action: 'done', suggestion: 'radon_test' } })).status).toBe(204);
    }
    expect(getTable('FunnelEvent')).toHaveLength(3);
  });

  it('silently drops server-owned, anonymous-only, unknown and oversized app events', async () => {
    for (const event_type of ['reminder_sent', 't1_account_created', 't0_preview_viewed', 'unknown']) {
      expect((await request(makeApp()).post('/api/hub/funnel-events')
        .send({ event_type, meta: {} })).status).toBe(204);
    }
    expect((await request(makeApp()).post('/api/hub/funnel-events')
      .send({ event_type: 'session_open', meta: { platform: 'ios' }, ignored: 'x'.repeat(2048) })).status).toBe(204);
    expect(getTable('FunnelEvent')).toHaveLength(0);
    for (const event_type of ['session_open', 'reminder_action', 'suggestion_decision', 'reminder_sent']) {
      expect((await request(makeApp()).post('/api/public/funnel-events')
        .send({ event_type, meta: {} })).status).toBe(204);
    }
    expect(getTable('FunnelEvent')).toHaveLength(0);
  });

  it('accepts absent metadata without persisting arrays or nested values', async () => {
    for (const meta of [undefined, null, ['private text'], { platform: { value: 'ios' } }]) {
      expect((await request(makeApp()).post('/api/hub/funnel-events')
        .send({ event_type: 'reminder_action', meta })).status).toBe(204);
    }
    expect(getTable('FunnelEvent')).toHaveLength(4);
    expect(getTable('FunnelEvent').every(row => Object.keys(row.meta).length === 0)).toBe(true);
  });
});

describe('pilot Hub truthfulness', () => {
  beforeEach(() => resetTables());

  it('hides Earn today with production launch flags while retaining unread personal mail', async () => {
    const previous = process.env.LAUNCH_FEATURES;
    process.env.LAUNCH_FEATURES = '';
    try {
      const actor = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
      seedTable('User', [{ id: actor, username: 'pilot-test' }]);
      seedTable('Mail', ['ad', 'newsletter', 'personal'].map((type, i) => ({
        id: String(i), type, recipient_user_id: actor, viewed: false,
        archived: false, deleted_at: null,
      })));
      const res = await request(makeApp()).get('/api/hub').set('x-test-user-id', actor);
      expect(res.status).toBe(200);
      expect(res.body.statusItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'inbox_personal', count: 3, subtitle: 'Open inbox' }),
      ]));
      expect(res.body.statusItems.some(item => item.id === 'inbox_offers' || item.subtitle === 'Earn today')).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.LAUNCH_FEATURES;
      else process.env.LAUNCH_FEATURES = previous;
    }
  });
});

describe('recordFunnelEvent', () => {
  beforeEach(() => resetTables());

  it('writes known events', async () => {
    await recordFunnelEvent('t1_account_created', {
      userId: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa',
      anonId: 'abc123',
      meta: { provided_username: false },
    });
    const rows = getTable('FunnelEvent');
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe('t1_account_created');
    expect(rows[0].user_id).toBe('aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa');
  });

  it('drops unknown event types and never throws', async () => {
    await expect(recordFunnelEvent('made_up_event', {})).resolves.toBeUndefined();
    expect(getTable('FunnelEvent')).toHaveLength(0);
  });
});
