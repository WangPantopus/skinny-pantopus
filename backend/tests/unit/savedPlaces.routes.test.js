const express = require('express');
const request = require('supertest');
jest.mock('../../services/context/providerOrchestrator', () => ({ clearHubTodayCache: jest.fn() }));
jest.mock('../../services/context/weatherProvider', () => ({ fetchWeather: jest.fn(async () => ({ source: 'error' })) }));
jest.mock('../../services/context/aqiProvider', () => ({ fetchAQI: jest.fn(async () => ({ aqi: null, source: 'unavailable' })) }));
jest.mock('../../services/context/alertsProvider', () => ({ fetchAlerts: jest.fn(async () => ({ source: 'error' })) }));
jest.mock('../../services/placeSectionAdapters', () => ({ composeSunriseSunset: jest.fn(async () => []) }));
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const router = require('../../routes/savedPlaces');
const app = express();
app.use(express.json()); app.use('/saved-places', router);
const place = { label: '120 Example St', latitude: 45.5, longitude: -122.6, city: 'Portland', state: 'OR' };
beforeEach(() => { resetTables(); });

it('upserts once per account and never creates a household, claim, or membership', async () => {
  seedTable('Home', [{ id: 'existing-home', address: place.label, owner_id: 'someone-else' }]);
  for (let i = 0; i < 2; i++) {
    const response = await request(app).post('/saved-places').set('x-test-user-id', 'u1').send({ ...place, expectedUserId: 'u1' });
    expect(response.status).toBe(201);
  }
  expect(getTable('SavedPlace')).toHaveLength(1);
  expect(getTable('UserNotificationPreferences')).toEqual([expect.objectContaining({user_id:'u1',daily_briefing_enabled:false,evening_briefing_enabled:false})]);
  const preference = {...getTable('UserNotificationPreferences')[0], daily_briefing_enabled:true, evening_briefing_enabled:true, daily_briefing_timezone:'Asia/Tokyo'};
  seedTable('UserNotificationPreferences', [preference]);
  expect((await request(app).post('/saved-places').set('x-test-user-id','u1').send(place)).status).toBe(201);
  expect(getTable('UserNotificationPreferences')).toEqual([preference]);
  // The shared in-memory adapter generates non-UUID ids; bind its saved row
  // to the real route's UUID contract before exercising the persisted reader.
  const id = '11111111-1111-4111-8111-111111111111';
  getTable('SavedPlace')[0].id = id;
  seedTable('UserNotificationPreferences', [{ user_id: 'u1', daily_briefing_enabled: false, evening_briefing_enabled: false }]);
  seedTable('AddressCalendarRule', [
    { id: 'public-rule', scope_type: 'city', scope_key: 'OR:Portland', kind: 'council', title: 'Public council date',
      rrule: 'FREQ=DAILY', dtstart: '2026-01-01', all_day: true, lead_days: 1, confidence: 'verified' },
    { id: 'private-rule', scope_type: 'home', scope_key: 'existing-home', kind: 'garbage', title: 'Private pickup',
      rrule: 'FREQ=DAILY', dtstart: '2026-01-01', all_day: true, lead_days: 1, confidence: 'verified' },
  ]);
  const stored = JSON.stringify(getTable('SavedPlace'));
  const queries = jest.spyOn(require('../../config/supabaseAdmin'), 'from');
  queries.mockClear();
  for (let read = 0; read < 2; read++) {
    const today = await request(app).get(`/saved-places/${id}/today`).set('x-test-user-id', 'u1');
    expect(today.status).toBe(200);
    expect(today.headers['cache-control']).toBe('private, no-store');
    expect(today.body.tier).toBe('T1');
    expect(today.body.groups.map((group) => group.group)).toEqual(['today']);
    // A saved place shows weather, air, alerts and daylight only: no address
    // calendar, so no city pickup, tax or council dates (brief WP2, section 13).
    expect(today.body.groups[0].sections.find((section) => section.id === 'address_calendar')).toBeUndefined();
    expect(JSON.stringify(today.body)).not.toContain('private-rule');
    expect(JSON.stringify(today.body)).not.toContain('public-rule');
    expect(today.body.groups[0].sections.find((section) => section.id === 'alerts').status).toBe('unavailable');
  }
  expect(queries.mock.calls.every(([table]) => table === 'SavedPlace')).toBe(true);
  queries.mockRestore();
  expect(JSON.stringify(getTable('SavedPlace'))).toBe(stored);
  expect(getTable('UserNotificationPreferences')[0]).toEqual({ user_id: 'u1', daily_briefing_enabled: false, evening_briefing_enabled: false });
  expect(require('../../services/context/providerOrchestrator').clearHubTodayCache).toHaveBeenCalledWith('u1');
  expect(getTable('Home')).toHaveLength(1);
  for (const table of ['HomeOccupancy', 'HomeOwner', 'HomeResidencyClaim', 'HomeOwnershipClaim']) expect(getTable(table)).toHaveLength(0);
});

it('isolates list, save, and delete by authenticated account', async () => {
  const own = await request(app).post('/saved-places').set('x-test-user-id', 'u1').send(place);
  const id = '11111111-1111-4111-8111-111111111111';
  getTable('SavedPlace')[0].id = id;
  const other = await request(app).get('/saved-places').set('x-test-user-id', 'u2');
  expect(other.body.savedPlaces).toEqual([]);
  await request(app).delete(`/saved-places/${id}`).set('x-test-user-id', 'u2');
  expect(getTable('SavedPlace')).toHaveLength(1);
  expect((await request(app).get(`/saved-places/${id}/today`).set('x-test-user-id', 'u2')).status).toBe(404);
  expect((await request(app).get('/saved-places/not-a-uuid/today').set('x-test-user-id', 'u1')).status).toBe(400);
  const changed = await request(app).post('/saved-places').set('x-test-user-id', 'u2').send({ ...place, expectedUserId: 'u1' });
  expect(changed.status).toBe(409);
  expect(getTable('SavedPlace')).toHaveLength(1);
  const removed = await request(app).delete(`/saved-places/${id}`).set('x-test-user-id', 'u1');
  expect(removed.status).toBe(200);
  expect((await request(app).get(`/saved-places/${id}/today`).set('x-test-user-id', 'u1')).status).toBe(404);
  expect(getTable('SavedPlace')).toHaveLength(0);
  expect(require('../../services/context/providerOrchestrator').clearHubTodayCache).toHaveBeenCalledWith('u1');
});

it.each([{ latitude: 91 }, { longitude: -181 }, { latitude: '45.5' }, { label: ' ' }])('rejects invalid private-place input %j', async (invalid) => {
  const res = await request(app).post('/saved-places').set('x-test-user-id', 'u1').send({ ...place, ...invalid });
  expect(res.status).toBe(400); expect(getTable('SavedPlace')).toEqual([]);
});
