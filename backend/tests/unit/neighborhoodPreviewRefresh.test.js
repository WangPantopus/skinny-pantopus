/**
 * The density refresh job: counts distinct verified occupants per
 * geohash-6 cell, and announces the neighborhood UNLOCK as a door opening
 * (not a round number) when a cell crosses the threshold.
 */
jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../services/notificationService', () => ({ createBulkNotifications: jest.fn(async () => ({})) }));
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const notificationService = require('../../services/notificationService');
const { encodeGeohash6 } = require('../../utils/geohash');
const job = require('../../jobs/neighborhoodPreviewRefresh');

const CAMAS = { lat: 45.5871, lng: -122.4034 };
const CELL = encodeGeohash6(CAMAS.lat, CAMAS.lng);

function seedCell(households) {
  const homes = Array.from({ length: households }, (_, i) => ({ id: `h${i}`, map_center_lat: CAMAS.lat + i * 0.00001, map_center_lng: CAMAS.lng }));
  seedTable('Home', homes);
  seedTable('HomeOccupancy', homes.map((h, i) => ({ home_id: h.id, user_id: `u${i}`, is_active: true })));
}

beforeEach(() => { resetTables(); jest.clearAllMocks(); delete process.env.NEIGHBORHOOD_UNLOCK_THRESHOLD; });

it('the unlock threshold is always a milestone and carries the door-opening copy', async () => {
  process.env.NEIGHBORHOOD_UNLOCK_THRESHOLD = '24';
  expect(job.milestones()).toEqual([500, 200, 100, 50, 25, 24, 10]);
  seedCell(24);
  await job();
  const row = getTable('NeighborhoodPreview').find((r) => r.geohash === CELL);
  expect(row.verified_users_count).toBe(24);
  expect(row.last_milestone_notified).toBe(24);
  const sent = notificationService.createBulkNotifications.mock.calls[0][0];
  expect(sent).toHaveLength(24);
  expect(sent[0]).toMatchObject({ type: 'density_milestone', title: 'Your neighborhood is open', link: '/app/nearby', metadata: { milestone: 24, unlocked: true } });
  expect(sent[0].body).toMatch(/24 households/);
});

it('a plain milestone keeps the milestone copy, and below the first milestone nothing is sent', async () => {
  expect(job.milestoneCopy(50, 24).title).toMatch(/milestone/i);
  seedCell(5);
  await job();
  expect(notificationService.createBulkNotifications).not.toHaveBeenCalled();
  expect(getTable('NeighborhoodPreview').find((r) => r.geohash === CELL).verified_users_count).toBe(5);
});
