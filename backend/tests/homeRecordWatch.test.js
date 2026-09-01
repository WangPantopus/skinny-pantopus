// ============================================================
// TEST: Home Record Watch — the rate-watch half (Wave 2b)
//
// The invariants:
//   * PMMS parsing: monthly averages from weekly rows, latest reading
//     wins by date, implausibly small files are rejected (never cached);
//   * a watch freezes the baseline from the loan month and fails
//     closed on months the survey can't answer;
//   * the refi window opens at a 0.75pp drop, and alerts are
//     idempotent: no re-alert without a further 0.25pp drop or 90
//     quiet days;
//   * the weekly job claims before sending (racing instances skip),
//     alert copy states averages and deltas — never advice;
//   * setting a watch is T4-gated; watches are personal per home+user.
// ============================================================

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

const notificationService = require('../services/notificationService');
const { parsePmmsCsv } = require('../services/pmmsService');
const watchService = require('../services/homeRecordWatchService');
const { evaluate, shouldAlert } = watchService;
const recordWatchRoutes = require('../routes/homeRecordWatch');

const USER = 'rw-user-1';
const HOME_ID = 'home-rw-1';

// fetchPmms rejects implausibly small histories (<100 months) so a
// truncated file can never overwrite a good cache — the fixture
// therefore carries a filler decade plus the months under test.
const FILLER_ROWS = [];
for (let year = 2005; year <= 2019; year += 1) {
  for (let month = 1; month <= 12; month += 1) {
    FILLER_ROWS.push(`${month}/7/${year},6.00,`);
  }
}
const CSV = [
  'date,pmms30,pmms30p',
  ...FILLER_ROWS,
  '3/6/2023,6.50,',
  '3/13/2023,6.60,',
  '3/20/2023,6.70,',
  'bad-row,,',
  '8/13/2026,5.80,',
  '8/20/2026,5.70,',
].join('\n');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', recordWatchRoutes);
  return app;
}

function seedHome({ verification = 'verified' } = {}) {
  seedTable('Home', [{ id: HOME_ID, owner_id: USER, address: '1 Main St', city: 'Portland', state: 'OR' }]);
  seedTable('HomeOccupancy', [{
    id: 'rw-occ-1', home_id: HOME_ID, user_id: USER, is_active: true,
    role: 'owner', role_base: 'owner', verification_status: verification,
  }]);
}

function mockPmmsFetch(csv = CSV) {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => csv });
}

beforeEach(() => {
  resetTables();
  mockPmmsFetch();
  // The stub returns undefined by default; the service treats a falsy
  // result as dispatch failure and rolls the claim back.
  notificationService.createNotification.mockResolvedValue({ id: 'notif-1' });
});
afterEach(() => {
  delete global.fetch;
});

// ── PMMS parsing (pure) ──────────────────────────────────────

describe('parsePmmsCsv', () => {
  test('monthly averages from weekly rows; latest wins by date; junk skipped', () => {
    const { monthly, latest } = parsePmmsCsv(CSV);
    expect(monthly['2023-03']).toBe(6.6); // (6.50+6.60+6.70)/3
    expect(monthly['2026-08']).toBe(5.75);
    expect(latest).toEqual({ date: '2026-08-20', rate: 5.7 });
  });
});

// ── evaluate + shouldAlert (pure) ────────────────────────────

describe('the refi window', () => {
  const pmms = { monthly: {}, latest: { date: '2026-08-20', rate: 5.7 } };

  test('opens at a 0.75pp drop below baseline', () => {
    expect(evaluate({ baseline_rate: 6.45 }, pmms).refi_window).toBe(true);
    expect(evaluate({ baseline_rate: 6.44 }, pmms).refi_window).toBe(false);
    expect(evaluate({ baseline_rate: 6.6 }, pmms).delta_pp).toBe(-0.9);
  });

  test('alerts once, then only on a further 0.25pp drop or after 90 days', () => {
    const open = evaluate({ baseline_rate: 6.6 }, pmms); // current 5.70
    const now = new Date('2026-08-21T00:00:00.000Z');
    expect(shouldAlert({ last_alert_rate: null }, open, now)).toBe(true);
    expect(shouldAlert({ last_alert_rate: 5.8, last_alert_at: '2026-08-01T00:00:00.000Z' }, open, now)).toBe(false);
    expect(shouldAlert({ last_alert_rate: 5.95, last_alert_at: '2026-08-01T00:00:00.000Z' }, open, now)).toBe(true);
    expect(shouldAlert({ last_alert_rate: 5.8, last_alert_at: '2026-05-01T00:00:00.000Z' }, open, now)).toBe(true);
    expect(shouldAlert({ last_alert_rate: null }, evaluate({ baseline_rate: 6.0 }, pmms), now)).toBe(false);
  });
});

// ── Routes: set / get / delete ───────────────────────────────

describe('the watch lifecycle', () => {
  test('an unverified resident cannot set a watch', async () => {
    seedHome({ verification: 'pending' });
    const res = await request(buildApp())
      .put(`/api/homes/${HOME_ID}/record-watch`)
      .set('x-test-user-id', USER)
      .send({ loan_recorded_month: '2023-03' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('VERIFICATION_REQUIRED');
  });

  test('setting freezes the loan-month baseline and evaluates live', async () => {
    seedHome();
    const res = await request(buildApp())
      .put(`/api/homes/${HOME_ID}/record-watch`)
      .set('x-test-user-id', USER)
      .send({ loan_recorded_month: '2023-03' });
    expect(res.status).toBe(200);
    const { watch } = res.body;
    expect(watch.baseline_rate).toBe(6.6);
    expect(watch.evaluation).toMatchObject({
      current_rate: 5.7,
      current_as_of: '2026-08-20',
      delta_pp: -0.9,
      refi_window: true,
    });
  });

  test('months the survey cannot answer fail closed', async () => {
    seedHome();
    const app = buildApp();
    const bad = await request(app)
      .put(`/api/homes/${HOME_ID}/record-watch`)
      .set('x-test-user-id', USER)
      .send({ loan_recorded_month: '1960-01' });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('MONTH_OUT_OF_RANGE');

    const malformed = await request(app)
      .put(`/api/homes/${HOME_ID}/record-watch`)
      .set('x-test-user-id', USER)
      .send({ loan_recorded_month: 'March 2023' });
    expect(malformed.status).toBe(400);
    expect(malformed.body.code).toBe('BAD_MONTH');
  });

  test('get returns the caller’s watch; delete removes it', async () => {
    seedHome();
    const app = buildApp();
    await request(app).put(`/api/homes/${HOME_ID}/record-watch`).set('x-test-user-id', USER).send({ loan_recorded_month: '2023-03' });

    const got = await request(app).get(`/api/homes/${HOME_ID}/record-watch`).set('x-test-user-id', USER);
    expect(got.body.watch.loan_recorded_month).toBe('2023-03');

    const del = await request(app).delete(`/api/homes/${HOME_ID}/record-watch`).set('x-test-user-id', USER);
    expect(del.body.removed).toBe(true);
    expect((await request(app).get(`/api/homes/${HOME_ID}/record-watch`).set('x-test-user-id', USER)).body.watch).toBeNull();
  });
});

// ── The weekly job ───────────────────────────────────────────

describe('evaluateWatches', () => {
  function seedWatch(extra = {}) {
    seedTable('HomeRecordWatch', [{
      id: 'rw-1', home_id: HOME_ID, user_id: USER,
      loan_recorded_month: '2023-03', baseline_rate: 6.6,
      last_alert_rate: null, last_alert_at: null,
      created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z',
      ...extra,
    }]);
  }

  test('alerts an open window with averages-and-deltas copy, and claims first', async () => {
    seedWatch();
    const result = await watchService.evaluateWatches();
    expect(result).toEqual({ evaluated: 1, alerted: 1 });

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    const call = notificationService.createNotification.mock.calls[0][0];
    expect(call.type).toBe('rate_watch');
    // The deep-link vocabulary all three clients parse (the old
    // /place/<homeId>/money routed nowhere on any of them).
    expect(call.link).toBe('/place?section=money');
    expect(call.body).toContain('5.70%');
    expect(call.body).toContain('March 2023 average of 6.60%');
    expect(call.body).not.toMatch(/should|refinance now|save/i);

    const row = getTable('HomeRecordWatch')[0];
    expect(row.last_alert_rate).toBe(5.7);
    expect(row.last_alert_at).toBeTruthy();
  });

  test('an already-alerted watch stays quiet without a further drop', async () => {
    seedWatch({ last_alert_rate: 5.75, last_alert_at: '2026-08-14T00:00:00.000Z' });
    const result = await watchService.evaluateWatches();
    expect(result).toEqual({ evaluated: 1, alerted: 0 });
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
});
