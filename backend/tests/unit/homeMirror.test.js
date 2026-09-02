/**
 * The privacy mirror: a member sees their home exactly as an outsider
 * does — street and first name only — through the same serializer the
 * public-profile route uses. Non-members get nothing.
 */
jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../utils/homePermissions', () => ({
  checkHomePermission: jest.fn(async (homeId, userId) => ({ hasAccess: userId === 'member' })),
}));
const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');
const { loadHomeMirror } = require('../../services/homeMirror');
const { serializeHomeForViewer, serializeOwnerForViewer, HIDDEN_FROM_OUTSIDERS } = require('../../serializers/homeProfileSerializer');

const HOME = { id: 'h1', name: 'Home', address: '2518 NW Lacamas Dr', city: 'Camas', state: 'WA', zipcode: '98607', home_type: 'house', visibility: 'public_preview', owner_id: 'member', description: null, created_at: '2026-09-01T00:00:00Z' };
const USER = { id: 'member', username: 'yp', name: 'Yingpeng Wang', first_name: 'Yingpeng', last_name: 'Wang', profile_picture_url: null };

beforeEach(() => {
  resetTables();
  seedTable('Home', [HOME]);
  seedTable('User', [USER]);
  seedTable('HomeOwner', [{ home_id: 'h1', subject_type: 'user', subject_id: 'member', owner_status: 'verified', is_primary_owner: true }]);
});

it('shows a member the street and a first name — never the number, zip, or surname', async () => {
  const m = await loadHomeMirror({ homeId: 'h1', userId: 'member' });
  expect(m).toMatchObject({ surface: 'home', viewer: 'neighbor', discoverable: true });
  expect(m.home).toMatchObject({ address: 'NW Lacamas Dr', address_redacted: true, zipcode: null, city: 'Camas', state: 'WA' });
  expect(JSON.stringify(m)).not.toMatch(/2518|98607|Wang/);
  expect(m.owner).toMatchObject({ name: 'Yingpeng' });
  expect(m.hidden).toBe(HIDDEN_FROM_OUTSIDERS);
});

it('is exactly the projection the public-profile route gives an outsider', async () => {
  const m = await loadHomeMirror({ homeId: 'h1', userId: 'member' });
  expect(m.home).toEqual(serializeHomeForViewer(HOME, { reveal: false }));
  expect(m.owner).toEqual(serializeOwnerForViewer(USER, { reveal: false }));
});

it('refuses non-members and unknown homes', async () => {
  expect(await loadHomeMirror({ homeId: 'h1', userId: 'stranger' })).toBeNull();
  expect(await loadHomeMirror({ homeId: 'nope', userId: 'member' })).toBeNull();
});

it('the serializer reveals to insiders and every hidden item really is hidden from outsiders', () => {
  const inside = serializeHomeForViewer(HOME, { reveal: true });
  expect(inside).toMatchObject({ address: '2518 NW Lacamas Dr', zipcode: '98607', address_redacted: false });
  const outside = serializeHomeForViewer(HOME, { reveal: false });
  expect(outside.address).not.toMatch(/2518/);
  expect(outside.zipcode).toBeNull();
  expect(Object.keys(outside)).not.toEqual(expect.arrayContaining(['move_in_date', 'owner_id']));
  expect(HIDDEN_FROM_OUTSIDERS.map((h) => h.key)).toEqual(['house_number', 'zipcode', 'surname', 'household', 'documents', 'move_in']);
  expect(serializeOwnerForViewer({ id: 'u', username: 'x', first_name: 'Ada', last_name: 'Lovelace' }, { reveal: false }).name).toBe('Ada');
  // A generated username is never what a neighbor sees.
  expect(serializeOwnerForViewer({ id: 'u', username: 'review_c99a41', name: null, first_name: null }, { reveal: false }).name).toBeNull();
  expect(serializeOwnerForViewer({ id: 'u', username: 'review_c99a41', name: 'Ada Lovelace' }, { reveal: false }).name).toBe('Ada');
  expect(serializeOwnerForViewer({ id: 'u', username: 'review_c99a41', name: null }, { reveal: true }).name).toBe('review_c99a41');
  expect(serializeOwnerForViewer(null, { reveal: false })).toBeNull();
});
