/**
 * Funnel report — the wedge ladder from FunnelEvent rows: aha rate, share
 * rate, and the ladder per distinct visitor, overall and by route.
 */
jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
const { resetTables, seedTable, setRpcMock } = require('../__mocks__/supabaseAdmin');
const { summarizeFunnel, loadFunnelSummary, NO_ROUTE } = require('../../services/funnelReport');
const db = require('../../config/supabaseAdmin');

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

  it('groups each pilot type by its bounded metadata without changing the anonymous ladder', () => {
    const out = summarizeFunnel([
      ev('session_open', null, { trigger: 'push', kind: 'task', address: 'never returned' }),
      ev('session_open', null, { trigger: 'organic' }),
      ev('reminder_sent', null, { kind: 'pickup' }),
      ev('reminder_action', null, { kind: 'task', action: 'done' }),
      ev('suggestion_decision', null, { decision: 'already_tested' }),
      ev('reminder_action', null, { action: '__proto__' }),
      ev('reminder_action', null, { action: 'x'.repeat(41), kind: { nested: 'invalid' } }),
    ]);
    expect(out.events.session_open).toBe(2);
    expect(out.pilot.session_open.by_trigger).toEqual({ push: 1, organic: 1 });
    expect(out.pilot.reminder_sent).toMatchObject({ count: 1, by_kind: { pickup: 1 } });
    expect(out.pilot.reminder_action).toMatchObject({ count: 3, by_action: { done: 1, '(none)': 1 } });
    expect(out.pilot.reminder_action.by_action.__proto__).toBe(1);
    expect(out.pilot.suggestion_decision.by_decision).toEqual({ already_tested: 1 });
    expect(out.ladder.accounts).toBe(0);
    expect(out.ladder.previews).toBe(0);
    expect(JSON.stringify(out)).not.toContain('never returned');
  });
});

describe('loadFunnelSummary', () => {
  beforeEach(() => resetTables());
  afterEach(() => jest.restoreAllMocks());
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

  it('paginates beyond the default 1000-row server page without double counting', async () => {
    const now = Date.now();
    seedTable('FunnelEvent', Array.from({ length: 1001 }, (_, id) => ({
      id, event_type: 'session_open', anon_id: null, meta: { trigger: 'organic' },
      created_at: new Date(now - 3600e3).toISOString(),
    })));
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table);
      const range = query.range.bind(query);
      // Simulate a server row cap smaller than the requested page.
      query.range = (start, end) => range(start, Math.min(end, start + 299));
      return query;
    });
    const out = await loadFunnelSummary();
    expect(out.rows).toBe(1001);
    expect(out.pilot.session_open.by_trigger.organic).toBe(1001);
    expect(out.truncated).toBe(false);
    expect(out.activation).toMatchObject({ cohort_users: 0, activated_users: 0, matured_rate: null });
  });

  it('counts first-week current records, existing household pickup on joining, and only visible radon tasks', async () => {
    const now = Date.now();
    const day = offset => new Date(now + offset * 86400000).toISOString();
    const user = id => ({ id, account_type: 'individual', created_at: day(-20) });
    const users = ['pickup', 'radon', 'member', 'late', 'orphan', 'denied', 'hidden', 'late_verified'].map(user);
    users.push({ id: 'pending', account_type: 'individual', created_at: day(-2) },
      { id: 'curator', account_type: 'curator', created_at: day(-20) });
    seedTable('User', users);
    const home = id => ({ id: `${id}-home`, created_by_user_id: id, owner_id: id,
      created_at: day(-19), home_status: 'active', security_state: 'normal' });
    seedTable('Home', ['pickup', 'radon', 'late', 'denied', 'hidden', 'curator'].map(home).concat([
      { ...home('other'), created_at: day(-60) },
      { ...home('pending'), created_at: day(-1) },
    ]));
    seedTable('SavedPlace', [{ id: 'saved-orphan', user_id: 'orphan', created_at: day(-19) }]);
    seedTable('HomeOccupancy', ['member', 'late_verified'].map(id => ({ id: `${id}-occupancy`, user_id: id,
      home_id: 'other-home', created_at: day(-19), verified_at: day(id === 'member' ? -18 : -12),
      verification_status: 'verified', role: 'tenant', is_active: true, start_at: day(-19) })));
    const rule = (id, scope_key, created_at = day(-18)) => ({ id, scope_type: 'home', scope_key,
      kind: 'garbage', confidence: 'official', source: 'Set by your household', created_by: 'confirmer', created_at });
    seedTable('AddressCalendarRule', [rule('pickup-rule', 'pickup-home'), rule('old-rule', 'other-home', day(-30)),
      rule('denied-rule', 'denied-home'), rule('curator-rule', 'curator-home'),
      { ...rule('city-rule', 'pending-home', day(-1)), scope_type: 'city' }]);
    const task = (id, home_id, created_at = day(-18)) => ({ id, home_id, created_at, task_type: 'reminder',
      status: 'open', details: { suggestion: 'radon_test' }, source_mail_id: null,
      visibility: 'members', created_by: home_id.replace('-home', '') });
    seedTable('HomeTask', [task('radon-task', 'radon-home'), task('late-task', 'late-home', day(-12)),
      { ...task('hidden-task', 'hidden-home'), visibility: 'managers' }, task('orphan-task', 'unassociated-home'),
      { ...task('pending-canceled', 'pending-home', day(-1)), status: 'canceled' }]);
    const rpc = jest.fn(async (name, args) => {
      if (name === 'home_record_context') return { data: { allowed: args.p_user_id !== 'denied', private: args.p_user_id === 'radon',
        user_id: args.p_user_id, role: 'member', permissions: ['calendar.view', 'tasks.view'] }, error: null };
      if (name === 'home_record_visible') return { data: args.p_visibility === 'members'
        && (!args.p_context.private || args.p_created_by === args.p_context.user_id), error: null };
      throw new Error('Unexpected authority call');
    });
    setRpcMock(rpc);
    const out = await loadFunnelSummary();
    expect(out.activation).toEqual({ window_days: 7, basis: 'current_records', cohort_users: 9,
      activated_users: 3, matured_users: 8, activated_matured_users: 3, pending_users: 1,
      matured_rate: 0.375, truncated: false });
    expect(rpc).toHaveBeenCalledWith('home_record_context', { p_home_id: 'other-home', p_user_id: 'member' });
    expect(rpc).not.toHaveBeenCalledWith('home_record_context', { p_home_id: 'other-home', p_user_id: 'late_verified' });
    expect(JSON.stringify(out)).not.toContain('pickup-home');
    expect(JSON.stringify(out)).not.toContain('late_verified');
  });

  it('fails the summary rather than reporting zero activation on an unreadable authority', async () => {
    const created_at = new Date(Date.now() - 86400000).toISOString();
    seedTable('User', [{ id: 'creator', account_type: 'individual', created_at }]);
    seedTable('Home', [{ id: 'home', created_by_user_id: 'creator', created_at, home_status: 'active', security_state: 'normal' }]);
    seedTable('AddressCalendarRule', [{ id: 'rule', scope_type: 'home', scope_key: 'home', kind: 'garbage',
      confidence: 'official', source: 'Set by your household', created_by: 'creator', created_at }]);
    setRpcMock(async () => ({ data: null, error: { code: 'READ_REFUSED' } }));
    await expect(loadFunnelSummary()).rejects.toThrow('Could not load activation authority');
  });

  it('marks the authority-check cap as partial and suppresses an incomplete activation rate', async () => {
    const created_at = new Date(Date.now() - 10 * 86400000).toISOString();
    const ids = Array.from({ length: 1001 }, (_, id) => String(id));
    seedTable('User', ids.map(id => ({ id, account_type: 'individual', created_at })));
    seedTable('Home', ids.map(id => ({ id: `home-${id}`, created_by_user_id: id, created_at,
      home_status: 'active', security_state: 'normal' })));
    seedTable('AddressCalendarRule', ids.map(id => ({ id: `rule-${id}`, scope_type: 'home', scope_key: `home-${id}`,
      kind: 'garbage', confidence: 'official', source: 'Set by your household', created_by: id, created_at })));
    const rpc = jest.fn(async (_name, args) => ({ data: { allowed: true, private: true,
      user_id: args.p_user_id, permissions: ['calendar.view'] }, error: null }));
    setRpcMock(rpc);
    const out = await loadFunnelSummary();
    expect(rpc).toHaveBeenCalledTimes(1000);
    expect(out.activation).toMatchObject({ cohort_users: 1001, activated_users: 1000, truncated: true, matured_rate: null });
  });
});
