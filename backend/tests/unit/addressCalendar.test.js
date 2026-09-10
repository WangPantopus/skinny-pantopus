/**
 * Address calendar (Wedge Phase 2, D6): scoped RRULE rules → the next two
 * weeks at an address; a household's pickup day beats the city default.
 */
const express = require('express');
const request = require('supertest');

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { resetTables, seedTable, getTable, setRpcMock } = require('../__mocks__/supabaseAdmin');
const svc = require('../../services/addressCalendarService');
const router = require('../../routes/addressCalendar');

const USER = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const HOME = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const home = { id: HOME, city: 'Camas', state: 'WA', county: null, timezone: 'America/Los_Angeles' };
const NOW = new Date('2026-09-03T18:00:00.000Z'); // Thu Sep 3, 11:00 Pacific

function seedCamas() {
  seedTable('Home', [home]);
  seedTable('AddressCalendarRule', [
    { id: 'r-tax1', scope_type: 'state', scope_key: 'WA', kind: 'property_tax', title: 'Property tax — first half due', detail: null, rrule: 'FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=30', dtstart: '2026-04-30', until: null, all_day: true, lead_days: 14, source: 'Washington State', source_url: null, confidence: 'official' },
    { id: 'r-tax2', scope_type: 'state', scope_key: 'WA', kind: 'property_tax', title: 'Property tax — second half due', detail: null, rrule: 'FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=31', dtstart: '2026-10-31', until: null, all_day: true, lead_days: 14, source: 'Washington State', source_url: null, confidence: 'official' },
    { id: 'r-council', scope_type: 'city', scope_key: 'WA:Camas', kind: 'council', title: 'Camas City Council meeting', detail: null, rrule: 'FREQ=MONTHLY;BYDAY=1MO,3MO', dtstart: '2026-09-07', until: null, all_day: false, lead_days: 2, source: 'City of Camas', source_url: null, confidence: 'unverified' },
    { id: 'r-garbage', scope_type: 'city', scope_key: 'WA:Camas', kind: 'garbage', title: 'Garbage day', detail: null, rrule: 'FREQ=WEEKLY;BYDAY=TU', dtstart: '2026-09-01', until: null, all_day: true, lead_days: 1, source: 'City of Camas', source_url: null, confidence: 'unverified' },
    { id: 'r-recycle', scope_type: 'city', scope_key: 'WA:Camas', kind: 'recycling', title: 'Recycling day', detail: null, rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', dtstart: '2026-09-01', until: null, all_day: true, lead_days: 1, source: 'City of Camas', source_url: null, confidence: 'unverified' },
    // Another city's rule must never leak in.
    { id: 'r-other', scope_type: 'city', scope_key: 'WA:Vancouver', kind: 'garbage', title: 'Vancouver garbage', detail: null, rrule: 'FREQ=WEEKLY;BYDAY=FR', dtstart: '2026-09-04', until: null, all_day: true, lead_days: 1, source: null, source_url: null, confidence: 'unverified' },
  ]);
}

const contextRpc = jest.fn();
const pickupRpc = jest.fn(async (name, { p_home_id, p_rows, p_user_id }) => {
  if (name !== 'mutate_home_pickup_calendar') throw new Error(`Unexpected RPC: ${name}`);
  if (!p_user_id) throw new Error('Missing authenticated pickup actor');
  const retained = getTable('AddressCalendarRule').filter((r) =>
    !(r.scope_type === 'home' && r.scope_key === p_home_id && ['garbage', 'recycling', 'yard_waste'].includes(r.kind)));
  seedTable('AddressCalendarRule', [...retained, ...(p_rows || []).map((r) => ({ ...r, id: `${p_home_id}-${r.kind}`, scope_type: 'home', scope_key: p_home_id }))]);
  return { data: { allowed: true, count: p_rows?.length || 0 }, error: null };
});

beforeEach(() => {
  resetTables(); jest.clearAllMocks();
  contextRpc.mockImplementation(async ({ p_home_id, p_user_id }) => {
    if (!p_user_id) throw new Error('Missing authenticated pickup actor');
    const selected = getTable('Home').find(row => row.id === p_home_id);
    const scopes = svc.scopeKeysFor(selected || {});
    return { data: { allowed: !!selected, home: selected,
      rules: getTable('AddressCalendarRule').filter(rule => scopes.some(scope => scope.scope_type === rule.scope_type && scope.scope_key === rule.scope_key)) }, error: null };
  });
  setRpcMock((name, args) => name === 'get_home_pickup_calendar' ? contextRpc(args) : pickupRpc(name, args));
});

describe('composeForHome', () => {
  it('expands weekly, biweekly and monthly-by-weekday rules into dated events within 14 days', async () => {
    seedCamas();
    const cal = await svc.composeForHome(home, { now: NOW });
    expect(cal.today).toBe('2026-09-03');
    const byKind = (k) => cal.upcoming.filter((e) => e.kind === k).map((e) => e.date);
    expect(byKind('garbage')).toEqual(['2026-09-08', '2026-09-15']);
    expect(byKind('recycling')).toEqual(['2026-09-15']);          // every other week from Sep 1
    expect(byKind('council')).toEqual(['2026-09-07']);            // 1st Monday; the 3rd (Sep 21) is past the window
    expect(byKind('property_tax')).toEqual([]);                   // Oct 31 is outside 14 days
    expect(cal.next).toMatchObject({ kind: 'council', date: '2026-09-07', days_until: 4 });
    expect(cal.upcoming.find((e) => e.kind === 'garbage')).toMatchObject({ days_until: 5, scope: 'city', confidence: 'unverified' });
    expect(cal.upcoming.some((e) => e.title === 'Vancouver garbage')).toBe(false);
  });

  it('a rule seeded twice is one line on the card, never two (migration 198 + service guard)', async () => {
    seedCamas();
    const dup = getTable('AddressCalendarRule').find((r) => r.id === 'r-garbage');
    getTable('AddressCalendarRule').push({ ...dup, id: 'r-garbage-dup' });
    const out = await svc.composeForHome(home, { now: NOW });
    const garbageDays = out.upcoming.filter((e) => e.kind === 'garbage');
    expect(new Set(garbageDays.map((e) => e.date)).size).toBe(garbageDays.length);
    expect(garbageDays.length).toBeGreaterThan(0);
  });

  it('flags needs_pickup_day while pickup comes from the city default', async () => {
    seedCamas();
    const cal = await svc.composeForHome(home, { now: NOW });
    expect(cal.needs_pickup_day).toBe(true);
  });

  it('surfaces the yearly tax date with days_until when inside the window', async () => {
    seedCamas();
    const cal = await svc.composeForHome(home, { now: new Date('2026-10-20T18:00:00.000Z') });
    expect(cal.upcoming.find((e) => e.kind === 'property_tax')).toMatchObject({ date: '2026-10-31', days_until: 11, confidence: 'official', scope: 'state' });
  });

  it('a household pickup day replaces the city default (narrowest scope wins per kind)', async () => {
    seedCamas();
    const result = await svc.setPickupDay(home, { userId: USER, weekday: 'th', recyclingFrequency: 'biweekly', recyclingNextDate: '2026-09-03', now: NOW });
    expect(result).toMatchObject({ weekday: 'TH', dtstart: '2026-09-03', rules: 2 });
    const cal = await svc.composeForHome(home, { now: NOW });
    expect(cal.needs_pickup_day).toBe(false);
    expect(cal.upcoming.filter((e) => e.kind === 'garbage').map((e) => e.date)).toEqual(['2026-09-03', '2026-09-10', '2026-09-17']);
    expect(cal.upcoming.filter((e) => e.kind === 'recycling').map((e) => e.date)).toEqual(['2026-09-03', '2026-09-17']);
    expect(cal.upcoming.find((e) => e.kind === 'garbage')).toMatchObject({ scope: 'home', confidence: 'official' });
    // City rules for other kinds are untouched.
    expect(cal.upcoming.some((e) => e.kind === 'council')).toBe(true);
  });

  it('rejects a bad weekday and skips a malformed rrule without failing the rest', async () => {
    seedCamas();
    await expect(svc.setPickupDay(home, { userId: USER, weekday: 'XX', now: NOW })).rejects.toThrow(/weekday/);
    getTable('AddressCalendarRule').push({ id: 'r-bad', scope_type: 'city', scope_key: 'WA:Camas', kind: 'other', title: 'Broken', rrule: 'NOT-A-RULE', dtstart: '2026-09-01', confidence: 'unverified' });
    const cal = await svc.composeForHome(home, { now: NOW });
    expect(cal.upcoming.some((e) => e.title === 'Broken')).toBe(false);
    expect(cal.upcoming.some((e) => e.kind === 'garbage')).toBe(true);
  });

  it('clearing the pickup day restores the city default', async () => {
    seedCamas();
    await svc.setPickupDay(home, { userId: USER, weekday: 'TH', now: NOW });
    await svc.clearPickupDay(home, USER);
    const cal = await svc.composeForHome(home, { now: NOW });
    expect(cal.needs_pickup_day).toBe(true);
    expect(getTable('AddressCalendarRule').filter((r) => r.scope_type === 'home')).toHaveLength(0);
  });

  it('saves garbage only when recycling is unknown, without a guessed city fallback', async () => {
    seedCamas();
    await svc.setPickupDay(home, { userId: USER, weekday: 'TH', now: NOW });
    const cal = await svc.composeForHome(home, { now: NOW });
    expect(cal.pickup_schedule).toEqual({ weekday: 'TH', recycling_frequency: 'not_set', recycling_next_date: null });
    expect(cal.upcoming.some((e) => e.kind === 'recycling')).toBe(false);
    expect(cal.needs_pickup_day).toBe(false);
  });

  it('keeps the specified recycling week and separate weekday through reload and replacement', async () => {
    seedCamas();
    await svc.setPickupDay(home, { userId: USER, weekday: 'TH', recyclingFrequency: 'biweekly', recyclingNextDate: '2026-09-11', now: NOW });
    const cal = await svc.composeForHome(home, { now: NOW, windowDays: 35 });
    expect(cal.upcoming.filter((e) => e.kind === 'recycling').map((e) => e.date)).toEqual(['2026-09-11', '2026-09-25']);
    const later = await svc.composeForHome(home, { now: new Date('2026-09-12T18:00:00Z') });
    expect(later.pickup_schedule.recycling_next_date).toBe('2026-09-25');
    await svc.setPickupDay(home, { userId: USER, weekday: 'MO', recyclingFrequency: 'weekly', recyclingNextDate: '2026-09-05', now: NOW });
    const weekly = await svc.composeForHome(home, { now: NOW });
    expect(weekly.upcoming.filter((e) => e.kind === 'recycling').map((e) => e.date)).toEqual(['2026-09-05', '2026-09-12']);
    expect(getTable('AddressCalendarRule').filter((r) => r.scope_type === 'home')).toHaveLength(2);
  });

  it.each([
    ['biweekly', null], ['biweekly', '2026-02-30'], ['biweekly', '2026-09-02'],
    ['biweekly', '2026-09-17'], ['weekly', '2026-09-10'], ['not_set', '2026-09-03'],
  ])('rejects invalid or ambiguous recycling input (%s, %s) before writing', async (recyclingFrequency, recyclingNextDate) => {
    await expect(svc.setPickupDay(home, { userId: USER, weekday: 'TH', recyclingFrequency, recyclingNextDate, now: NOW })).rejects.toMatchObject({ code: 'INVALID_PICKUP' });
    expect(pickupRpc).not.toHaveBeenCalled();
  });

  it('keeps dates on the home calendar across UTC midnight and daylight saving changes', async () => {
    seedCamas();
    const now = new Date('2026-11-01T01:00:00Z'); // still Saturday at home
    await svc.setPickupDay(home, { userId: USER, weekday: 'SA', recyclingFrequency: 'biweekly', recyclingNextDate: '2026-10-31', now });
    const cal = await svc.composeForHome(home, { now, windowDays: 21 });
    expect(cal.today).toBe('2026-10-31');
    expect(cal.upcoming.filter((e) => e.kind === 'recycling').map((e) => e.date)).toEqual(['2026-10-31', '2026-11-14']);
    expect(cal.upcoming.find((e) => e.kind === 'recycling').days_until).toBe(0);
  });

  it('retains the previous schedule when the atomic swap fails and isolates another home', async () => {
    seedCamas();
    await svc.setPickupDay(home, { userId: USER, weekday: 'TH', now: NOW });
    const other = { ...home, id: 'other-home' };
    await svc.setPickupDay(other, { userId: USER, weekday: 'FR', now: NOW });
    const before = structuredClone(getTable('AddressCalendarRule'));
    pickupRpc.mockResolvedValueOnce({ data: null, error: { message: 'transaction failed' } });
    await expect(svc.setPickupDay(home, { userId: USER, weekday: 'MO', now: NOW })).rejects.toMatchObject({ code: 'HOME_ACCESS_UNAVAILABLE' });
    expect(getTable('AddressCalendarRule')).toEqual(before);
    await svc.clearPickupDay(home, USER);
    expect((await svc.composeForHome(other, { now: NOW })).pickup_schedule.weekday).toBe('FR');
  });
});

describe('/api/homes/:id/calendar', () => {
  function app() { const a = express(); a.use(express.json()); a.use('/api/homes', router); return a; }

  it('GET returns the calendar to a member and 403 to a stranger', async () => {
    seedCamas();
    const ok = await request(app()).get(`/api/homes/${HOME}/calendar`);
    expect(ok.status).toBe(200);
    expect(ok.body.calendar.upcoming.length).toBeGreaterThan(0);
    contextRpc.mockResolvedValue({ data: { allowed: false }, error: null });
    const no = await request(app()).get(`/api/homes/${HOME}/calendar`);
    expect(no.status).toBe(403);
  });

  it('PUT pickup-day validates, saves, and returns the recomputed calendar; DELETE restores the default', async () => {
    seedCamas();
    const bad = await request(app()).put(`/api/homes/${HOME}/calendar/pickup-day`).send({ weekday: 'Tuesday' });
    expect(bad.status).toBe(400);
    const res = await request(app()).put(`/api/homes/${HOME}/calendar/pickup-day`).send({ weekday: 'WE' });
    expect(res.status).toBe(200);
    expect(res.body.pickup.weekday).toBe('WE');
    expect(res.body.calendar.needs_pickup_day).toBe(false);
    expect(res.body.calendar.upcoming.find((e) => e.kind === 'garbage').scope).toBe('home');
    const del = await request(app()).delete(`/api/homes/${HOME}/calendar/pickup-day`);
    expect(del.status).toBe(200);
    expect(del.body.calendar.needs_pickup_day).toBe(true);
  });

  it('rejects stranger writes and resets without modifying household data', async () => {
    seedCamas();
    const before = structuredClone(getTable('AddressCalendarRule'));
    contextRpc.mockResolvedValue({ data: { allowed: false }, error: null });
    expect((await request(app()).put(`/api/homes/${HOME}/calendar/pickup-day`).send({ weekday: 'MO' })).status).toBe(403);
    expect((await request(app()).delete(`/api/homes/${HOME}/calendar/pickup-day`)).status).toBe(403);
    expect(getTable('AddressCalendarRule')).toEqual(before);
    expect(pickupRpc).not.toHaveBeenCalled();
  });

  it('reports a failed permission read as temporary unavailability and never writes', async () => {
    seedCamas();
    contextRpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    expect((await request(app()).put(`/api/homes/${HOME}/calendar/pickup-day`).send({ weekday: 'MO' })).status).toBe(503);
    expect(pickupRpc).not.toHaveBeenCalled();
  });

  it('returns actionable validation for incomplete recycling and accepts legacy garbage-only callers', async () => {
    seedCamas();
    const invalid = await request(app()).put(`/api/homes/${HOME}/calendar/pickup-day`).send({ weekday: 'MO', recycling_frequency: 'biweekly' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatch(/next recycling/);
    const legacy = await request(app()).put(`/api/homes/${HOME}/calendar/pickup-day`).send({ weekday: 'MO', recycling_every_other_week: true });
    expect(legacy.status).toBe(200);
    expect(legacy.body.calendar.pickup_schedule.recycling_frequency).toBe('not_set');
    expect(legacy.body.pickup.rules).toBe(1);
  });

  it('returns a write failure with the previously saved calendar still readable', async () => {
    seedCamas();
    await svc.setPickupDay(home, { userId: USER, weekday: 'TH', now: NOW });
    pickupRpc.mockResolvedValueOnce({ data: null, error: { message: 'transaction failed' } });
    expect((await request(app()).put(`/api/homes/${HOME}/calendar/pickup-day`).send({ weekday: 'MO' })).status).toBe(503);
    const read = await request(app()).get(`/api/homes/${HOME}/calendar`);
    expect(read.body.calendar.pickup_schedule.weekday).toBe('TH');
  });

  it('binds read and mutation to the authenticated actor, never a submitted caller id', async () => {
    seedCamas();
    const result = await request(app()).put(`/api/homes/${HOME}/calendar/pickup-day`).send({ weekday: 'WE' });
    expect(result.status).toBe(200);
    expect(contextRpc).toHaveBeenCalledWith({ p_home_id: HOME, p_user_id: USER });
    expect(pickupRpc).toHaveBeenCalledWith('mutate_home_pickup_calendar', expect.objectContaining({
      p_home_id: HOME, p_user_id: USER, p_rows: [expect.objectContaining({ created_by: USER })],
    }));
  });

  it('a mutation denial after an allowed read preserves the previous schedule', async () => {
    seedCamas();
    await svc.setPickupDay(home, { userId: USER, weekday: 'TH', now: NOW });
    const before = structuredClone(getTable('AddressCalendarRule'));
    pickupRpc.mockResolvedValueOnce({ data: { allowed: false }, error: null });
    expect((await request(app()).delete(`/api/homes/${HOME}/calendar/pickup-day`)).status).toBe(403);
    expect(getTable('AddressCalendarRule')).toEqual(before);
  });

  it('an inconsistent context response is retryable and exposes no foreign Home', async () => {
    seedCamas();
    contextRpc.mockResolvedValueOnce({ data: { allowed: true, home: { ...home, id: 'other-home' }, rules: [] }, error: null });
    const result = await request(app()).get(`/api/homes/${HOME}/calendar`);
    expect(result.status).toBe(503);
    expect(result.body).not.toHaveProperty('calendar');
  });
});

describe('briefing signals (the push)', () => {
  const { generateAddressCalendarSignals, rankSignals } = require('../../services/context/usefulnessEngine');
  const ev = (over) => ({ rule_id: 'r', kind: 'garbage', title: 'Garbage day', detail: null, date: '2026-09-04', days_until: 1, all_day: true, lead_days: 1, scope: 'home', source: 'Set by your household', source_url: null, confidence: 'official', ...over });

  it('turns tomorrow\'s pickup into a push-worthy signal, and a hearing into a quiet line', () => {
    const sig = generateAddressCalendarSignals({ upcoming: [ev(), ev({ kind: 'council', title: 'Camas City Council meeting', days_until: 2, lead_days: 2 })] });
    expect(sig).toHaveLength(2);
    expect(sig[0]).toMatchObject({ kind: 'address_calendar', label: 'Garbage day tomorrow', urgency: 'medium' });
    expect(sig[0].score).toBeGreaterThan(0.6);
    expect(sig[1].score).toBeLessThan(0.4);
  });

  it('stays silent outside the lead window and never repeats a kind', () => {
    const sig = generateAddressCalendarSignals({ upcoming: [ev({ days_until: 5 }), ev({ rule_id: 'r2', days_until: 0 }), ev({ rule_id: 'r3', days_until: 1 })] });
    expect(sig).toHaveLength(1);
    expect(sig[0].label).toBe('Garbage day today');
  });

  it('hedges an unconfirmed city default in the detail', () => {
    const [sig] = generateAddressCalendarSignals({ upcoming: [ev({ scope: 'city', confidence: 'unverified', source: 'City of Camas' })] });
    expect(sig.detail).toMatch(/Unconfirmed/);
  });

  it('ranks with the rest of the briefing and carries a cost of inaction above the push bar', () => {
    const out = rankSignals({ weather: null, aqi: null, alerts: null, seasonal: null, internal: { bills_due: [], tasks_due: [], calendar_events: [], unread_mail_count: 0, urgent_mail_count: 0, active_gigs: [] }, timeOfDay: 'morning', isWeekend: false, addressCalendar: { upcoming: [ev({ kind: 'property_tax', title: 'Property tax — second half due', days_until: 3, lead_days: 14, scope: 'state' })] } });
    const sig = out.signals.find((x) => x.kind === 'address_calendar');
    expect(sig).toBeTruthy();
    expect(sig.cost_of_inaction).toBeGreaterThanOrEqual(0.6);
    expect(sig.label).toMatch(/Property tax/);
  });
});
