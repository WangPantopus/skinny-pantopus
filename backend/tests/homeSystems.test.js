// ============================================================
// TEST: Systems Ledger — the compounding home record
//
// The invariants that matter are about honesty and trust, not arithmetic:
// the ledger is never blank, an estimate is never presented as a fact,
// and a resident's correction can never be overwritten by something the
// system inferred.
// ============================================================

// The route requires placeIntelligenceService, which pulls the whole
// provider chain (weatherkit → winston) into the module graph. Only the
// Systems Ledger is under test here, so the providers are stubbed out —
// mirroring placeIntelligence.endpoint.test.js.
jest.mock('../services/context/providerOrchestrator', () => ({
  getHubToday: jest.fn().mockResolvedValue(null),
  composeDailyBriefing: jest.fn(),
}));
jest.mock('../services/ai/neighborhoodProfileService', () => ({
  getProfile: jest.fn().mockResolvedValue(null),
  geocodeToTract: jest.fn().mockResolvedValue(null),
}));
jest.mock('../services/ai/propertyIntelligenceService', () => ({
  getProfile: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

const {
  getSystemsLedger,
  recordSystem,
  recordCompletedJob,
  statusFor,
  remainingFraction,
  SYSTEM_KEYS,
  SYSTEM_DEFS,
} = require('../services/homeSystemsService');
const placeIntelligenceRoutes = require('../routes/placeIntelligence');

const USER = 'sys-user-1';
const HOME_ID = 'home-sys-1';
const NOW = new Date('2026-08-19T00:00:00.000Z');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', placeIntelligenceRoutes);
  return app;
}

function seedHome(extra = {}) {
  seedTable('Home', [{
    id: HOME_ID,
    owner_id: USER,
    address: '1421 SE Oak St',
    city: 'Portland',
    state: 'OR',
    zipcode: '97214',
    year_built: 1979,
    ...extra,
  }]);
}

function byKey(ledger, key) {
  return ledger.systems.find((s) => s.key === key);
}

describe('life modelling', () => {
  const waterHeater = SYSTEM_DEFS.find((d) => d.key === 'water_heater'); // 8–12

  test('classifies age against the typical range', () => {
    expect(statusFor(3, waterHeater)).toBe('ok');
    expect(statusFor(10, waterHeater)).toBe('aging');
    expect(statusFor(15, waterHeater)).toBe('past_expected');
    expect(statusFor(null, waterHeater)).toBe('unknown');
  });

  test('remaining life is measured against the high bound, never negative', () => {
    expect(remainingFraction(0, waterHeater)).toBe(1);
    expect(remainingFraction(6, waterHeater)).toBe(0.5);
    expect(remainingFraction(40, waterHeater)).toBe(0);
    expect(remainingFraction(null, waterHeater)).toBeNull();
  });
});

describe('the ledger is never blank', () => {
  beforeEach(() => {
    resetTables();
    seedHome();
  });

  test('returns all six systems with nothing stored', async () => {
    const ledger = await getSystemsLedger({ id: HOME_ID, year_built: 1979 }, { now: NOW });
    expect(ledger.systems).toHaveLength(6);
    expect(ledger.systems.map((s) => s.key).sort()).toEqual([...SYSTEM_KEYS].sort());
  });

  test('seeds every system from the build year, labelled as an estimate', async () => {
    const ledger = await getSystemsLedger({ id: HOME_ID, year_built: 1979 }, { now: NOW });
    for (const s of ledger.systems) {
      expect(s.installed_year).toBe(1979);
      expect(s.source).toBe('estimated');
      expect(s.source_label).toBe('Estimated from year built');
      expect(s.confidence).toBe('low');
    }
    // Nothing is persisted — an estimate is not a record.
    expect(getTable('HomeSystem')).toHaveLength(0);
  });

  test('degrades to unknown rather than guessing when there is no build year', async () => {
    const ledger = await getSystemsLedger({ id: HOME_ID, year_built: null }, { now: NOW });
    for (const s of ledger.systems) {
      expect(s.installed_year).toBeNull();
      expect(s.status).toBe('unknown');
      expect(s.life_remaining).toBeNull();
    }
  });

  test('a 1979 home reads as past expected life on the short-lived systems', async () => {
    const ledger = await getSystemsLedger({ id: HOME_ID, year_built: 1979 }, { now: NOW });
    expect(byKey(ledger, 'water_heater').status).toBe('past_expected');
    expect(byKey(ledger, 'roof').status).toBe('past_expected');
    // Panels outlive the rest: at 47 years a 1979 panel is inside its
    // 40–60 window, not past it. The model must not flatten that.
    expect(byKey(ledger, 'electrical_panel').status).toBe('aging');
    expect(ledger.summary.past_expected_count).toBeGreaterThan(0);
    expect(ledger.summary.headline).toMatch(/Past typical service life/);
  });
});

describe('provenance', () => {
  beforeEach(() => {
    resetTables();
    seedHome();
  });

  test('a stored resident entry outranks the estimate and shows its chip', async () => {
    await recordSystem({
      homeId: HOME_ID, systemKey: 'water_heater', installedYear: 2022, source: 'resident', userId: USER,
    });

    const ledger = await getSystemsLedger({ id: HOME_ID, year_built: 1979 }, { now: NOW });
    const wh = byKey(ledger, 'water_heater');
    expect(wh.installed_year).toBe(2022);
    expect(wh.source).toBe('resident');
    expect(wh.source_label).toBe('You told us');
    expect(wh.confidence).toBe('high');
    expect(wh.status).toBe('ok');
    // The others still read from the build year.
    expect(byKey(ledger, 'roof').source).toBe('estimated');
  });

  test('a derived source can never overwrite what the household said', async () => {
    await recordSystem({ homeId: HOME_ID, systemKey: 'roof', installedYear: 2015, source: 'resident' });

    const permit = await recordSystem({
      homeId: HOME_ID, systemKey: 'roof', installedYear: 2019, source: 'permit', sourceRef: 'RES-19-3382',
    });
    expect(permit.ok).toBe(false);
    expect(permit.reason).toBe('outranked');

    const ledger = await getSystemsLedger({ id: HOME_ID, year_built: 1979 }, { now: NOW });
    expect(byKey(ledger, 'roof').installed_year).toBe(2015);
  });

  test('a permit does upgrade a bare estimate', async () => {
    const r = await recordSystem({
      homeId: HOME_ID, systemKey: 'roof', installedYear: 2019, source: 'permit', sourceRef: 'RES-19-3382',
    });
    expect(r.ok).toBe(true);

    const ledger = await getSystemsLedger({ id: HOME_ID, year_built: 1979 }, { now: NOW });
    const roof = byKey(ledger, 'roof');
    expect(roof.source).toBe('permit');
    expect(roof.source_ref).toBe('RES-19-3382');
    expect(roof.confidence).toBe('medium');
  });

  test('rejects an implausible year rather than rendering a 900-year-old roof', async () => {
    const r = await recordSystem({ homeId: HOME_ID, systemKey: 'roof', installedYear: 1100 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_year');
  });

  test('rejects an unknown system key', async () => {
    const r = await recordSystem({ homeId: HOME_ID, systemKey: 'hot_tub', installedYear: 2020 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_system');
  });

  test('counts how much of the ledger rests on evidence', async () => {
    await recordSystem({ homeId: HOME_ID, systemKey: 'water_heater', installedYear: 2022, source: 'resident' });
    await recordSystem({ homeId: HOME_ID, systemKey: 'roof', installedYear: 2019, source: 'permit' });

    const ledger = await getSystemsLedger({ id: HOME_ID, year_built: 1979 }, { now: NOW });
    expect(ledger.summary.confirmed_count).toBe(2);
    expect(ledger.summary.total_count).toBe(6);
  });
});

describe('PUT /api/homes/:id/systems/:key', () => {
  let app;

  beforeEach(() => {
    resetTables();
    seedHome();
    app = buildApp();
  });

  test('records a replacement without requiring a transaction', async () => {
    const res = await request(app)
      .put(`/api/homes/${HOME_ID}/systems/water_heater`)
      .set('x-test-user-id', USER)
      .send({ installed_year: 2024 });

    expect(res.status).toBe(200);
    const rows = getTable('HomeSystem');
    expect(rows).toHaveLength(1);
    expect(rows[0].installed_year).toBe(2024);
    // The household speaking is always the highest-ranked source.
    expect(rows[0].source).toBe('resident');
  });

  test('rejects an unknown system', async () => {
    const res = await request(app)
      .put(`/api/homes/${HOME_ID}/systems/hot_tub`)
      .set('x-test-user-id', USER)
      .send({ installed_year: 2024 });
    expect(res.status).toBe(400);
  });

  test('requires the field explicitly so a typo cannot silently clear it', async () => {
    const res = await request(app)
      .put(`/api/homes/${HOME_ID}/systems/roof`)
      .set('x-test-user-id', USER)
      .send({ year: 2024 });
    expect(res.status).toBe(400);
  });

  test('rejects an implausible year', async () => {
    const res = await request(app)
      .put(`/api/homes/${HOME_ID}/systems/roof`)
      .set('x-test-user-id', USER)
      .send({ installed_year: 3200 });
    expect(res.status).toBe(400);
  });

  test('refuses a caller with no access to the home', async () => {
    const res = await request(app)
      .put(`/api/homes/${HOME_ID}/systems/roof`)
      .set('x-test-user-id', 'someone-else')
      .send({ installed_year: 2024 });
    expect(res.status).toBe(403);
    expect(getTable('HomeSystem')).toHaveLength(0);
  });
});


describe('provenance capture from a completed job', () => {
  beforeEach(() => {
    resetTables();
    seedHome();
  });

  test('records the service history with the gig as evidence', async () => {
    const r = await recordCompletedJob({
      homeId: HOME_ID,
      gigId: 'gig-1',
      title: 'Gutter clearing',
      category: 'home_maintenance',
      price: 180,
      performedBy: 'worker-1',
      performedAt: '2026-08-19T17:00:00.000Z',
    });

    expect(r.ok).toBe(true);
    const rows = getTable('HomeMaintenanceLog');
    expect(rows).toHaveLength(1);
    expect(rows[0].task).toBe('Gutter clearing');
    expect(rows[0].cost).toBe(180);
    expect(rows[0].status).toBe('completed');
    // The gig id is what makes the row verifiable rather than self-reported,
    // and it lives in its own column (migration 163) with a partial unique
    // index behind it — so the guarantee does not rest on user-visible text.
    expect(rows[0].gig_id).toBe('gig-1');
    expect(rows[0].notes).toBeUndefined();
  });

  test('is idempotent — re-confirming does not duplicate the history', async () => {
    const args = { homeId: HOME_ID, gigId: 'gig-1', title: 'Gutter clearing', price: 180 };
    await recordCompletedJob(args);
    const second = await recordCompletedJob(args);

    expect(second.ok).toBe(true);
    expect(second.reason).toBe('already_recorded');
    expect(getTable('HomeMaintenanceLog')).toHaveLength(1);
  });

  test('does NOT touch the system install year', async () => {
    // A completed roofing gig does not say whether the roof was replaced
    // or a flashing was patched. Guessing would reset a 25-year clock.
    await recordCompletedJob({ homeId: HOME_ID, gigId: 'gig-2', title: 'Roof repair', category: 'roofing' });

    expect(getTable('HomeSystem')).toHaveLength(0);
    const ledger = await getSystemsLedger({ id: HOME_ID, year_built: 1979 }, { now: NOW });
    expect(byKey(ledger, 'roof').source).toBe('estimated');
    expect(byKey(ledger, 'roof').installed_year).toBe(1979);
  });

  test('refuses a job with no home to attach to', async () => {
    const r = await recordCompletedJob({ homeId: null, gigId: 'gig-3', title: 'x' });
    expect(r.ok).toBe(false);
    expect(getTable('HomeMaintenanceLog')).toHaveLength(0);
  });

  test('never throws — provenance must not be able to fail a payment path', async () => {
    await expect(recordCompletedJob({})).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
    await expect(
      recordCompletedJob({ homeId: HOME_ID, gigId: 'g', price: 'not-a-number' }),
    ).resolves.toEqual(expect.objectContaining({ ok: true }));
    // A non-numeric price is stored as null rather than NaN.
    expect(getTable('HomeMaintenanceLog')[0].cost).toBeNull();
  });
});
