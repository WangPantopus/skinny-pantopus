/**
 * Funnel report — the wedge ladder from FunnelEvent rows: aha rate, share
 * rate, and the ladder per distinct visitor, overall and by route.
 */
jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');
const { summarizeFunnel, loadFunnelSummary, NO_ROUTE } = require('../../services/funnelReport');

const ev = (event_type, anon_id, meta = {}) => ({ event_type, anon_id, meta });

describe('summarizeFunnel', () => {
  it('counts distinct visitors, the aha rate excludes calm cards, and routes split the ladder', () => {
    const rows = [
      // Visitor a: two reloads of the preview, radon aha, shared, walled, registered.
      ev('t0_preview_viewed', 'a', { status: 'ready', route: 'eddm-1' }),
      ev('t0_preview_viewed', 'a', { status: 'ready', route: 'eddm-1' }),
      ev('t0_aha_viewed', 'a', { section_id: 'lead_radon', tone: 'alert', grade: 'Radon zone 1', route: 'eddm-1' }),
      ev('t0_share_clicked', 'a', { method: 'copy', route: 'eddm-1' }),
      ev('t0_wall_viewed', 'a', { route: 'eddm-1' }),
      ev('register_started', 'a', { route: 'eddm-1' }),
      // Visitor b: direct, calm card, bounced.
      ev('t0_preview_viewed', 'b', { status: 'ready' }),
      ev('t0_aha_viewed', 'b', { tone: 'calm', grade: 'Quiet' }),
      // Visitor c: direct, seismic aha, walled.
      ev('t0_preview_viewed', 'c', { status: 'ready' }),
      ev('t0_aha_viewed', 'c', { section_id: 'seismic', tone: 'alert', grade: 'Category D' }),
      ev('t0_wall_viewed', 'c'),
      // Server-owned account event: user id, no anon id.
      { event_type: 't1_account_created', anon_id: null, meta: { route: 'eddm-1' } },
      // Garbage type is ignored.
      ev('something_else', 'z'),
    ];
    const out = summarizeFunnel(rows);
    expect(out.ladder).toEqual({ previews: 3, aha_views: 3, shares: 1, walls: 2, registers: 1, accounts: 1 });
    expect(out.events.t0_preview_viewed).toBe(4);
    // 2 of 3 aha cards were non-calm → 0.667 of previews.
    expect(out.rates.aha).toBe(0.667);
    expect(out.rates.share).toBe(0.333);
    expect(out.rates.wall).toBe(0.667);
    expect(out.rates.register).toBe(0.333);
    expect(out.rates.account).toBe(0.333);
    expect(out.aha.by_section).toEqual({ lead_radon: 1, seismic: 1, calm: 1 });
    expect(out.aha.by_tone).toEqual({ alert: 2, calm: 1 });
    expect(out.share.by_method).toEqual({ copy: 1 });
    // Routes: eddm-1 has one visitor who went all the way; direct has two.
    expect(out.by_route.map((r) => r.route)).toEqual([NO_ROUTE, 'eddm-1']);
    const eddm = out.by_route.find((r) => r.route === 'eddm-1');
    expect(eddm.ladder).toMatchObject({ previews: 1, shares: 1, registers: 1, accounts: 1 });
    expect(eddm.rates.aha).toBe(1);
    expect(out.rows).toBe(13);
    expect(out.truncated).toBe(false);
  });

  it('falls back to event counts when beacons carried no anon id, and rates are null with no previews', () => {
    const out = summarizeFunnel([ev('t0_preview_viewed', null), ev('t0_preview_viewed', null), ev('t0_wall_viewed', null)]);
    expect(out.ladder.previews).toBe(2);
    expect(out.rates.wall).toBe(0.5);
    expect(summarizeFunnel([]).rates.aha).toBeNull();
  });
});

describe('loadFunnelSummary', () => {
  beforeEach(() => resetTables());
  it('reads the window and clamps days', async () => {
    const now = Date.now();
    seedTable('FunnelEvent', [
      { id: 1, event_type: 't0_preview_viewed', anon_id: 'a', meta: {}, created_at: new Date(now - 3600e3).toISOString() },
      { id: 2, event_type: 't0_preview_viewed', anon_id: 'old', meta: {}, created_at: new Date(now - 400 * 86400e3).toISOString() },
    ]);
    const out = await loadFunnelSummary({ days: 9999 });
    expect(out.days).toBe(365);
    expect(out.ladder.previews).toBe(1);
  });
});
