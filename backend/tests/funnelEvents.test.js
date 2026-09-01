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
const { resetTables, getTable } = require('./__mocks__/supabaseAdmin');

const publicRouter = require('../routes/public');
const { recordFunnelEvent } = require('../services/funnelEvents');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public', publicRouter);
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
