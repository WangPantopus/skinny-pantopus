/**
 * Address calendar (Wedge Phase 2, D6): scoped RRULE rules → the next two
 * weeks at an address; a household's pickup day beats the city default.
 */
const express = require('express');
const request = require('supertest');

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../utils/homePermissions', () => ({ checkHomePermission: jest.fn(async () => ({ hasAccess: true })) }));

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const { checkHomePermission } = require('../../utils/homePermissions');
const svc = require('../../services/addressCalendarService');
const router = require('../../routes/addressCalendar');

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

beforeEach(() => { resetTables(); jest.clearAllMocks(); checkHomePermission.mockResolvedValue({ hasAccess: true }); });

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
    const result = await svc.setPickupDay(home, { weekday: 'th', userId: 'u-1', now: NOW });
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
    await expect(svc.setPickupDay(home, { weekday: 'XX', now: NOW })).rejects.toThrow(/weekday/);
    getTable('AddressCalendarRule').push({ id: 'r-bad', scope_type: 'city', scope_key: 'WA:Camas', kind: 'other', title: 'Broken', rrule: 'NOT-A-RULE', dtstart: '2026-09-01', confidence: 'unverified' });
    const cal = await svc.composeForHome(home, { now: NOW });
    expect(cal.upcoming.some((e) => e.title === 'Broken')).toBe(false);
    expect(cal.upcoming.some((e) => e.kind === 'garbage')).toBe(true);
  });

  it('clearing the pickup day restores the city default', async () => {
    seedCamas();
    await svc.setPickupDay(home, { weekday: 'TH', now: NOW });
    await svc.clearPickupDay(home);
    const cal = await svc.composeForHome(home, { now: NOW });
    expect(cal.needs_pickup_day).toBe(true);
    expect(getTable('AddressCalendarRule').filter((r) => r.scope_type === 'home')).toHaveLength(0);
  });
});

describe('/api/homes/:id/calendar', () => {
  function app() { const a = express(); a.use(express.json()); a.use('/api/homes', router); return a; }

  it('GET returns the calendar to a member and 403 to a stranger', async () => {
    seedCamas();
    const ok = await request(app()).get(`/api/homes/${HOME}/calendar`);
    expect(ok.status).toBe(200);
    expect(ok.body.calendar.upcoming.length).toBeGreaterThan(0);
    checkHomePermission.mockResolvedValue({ hasAccess: false });
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
