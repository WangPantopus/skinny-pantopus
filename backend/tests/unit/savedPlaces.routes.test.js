const express = require('express');
const request = require('supertest');
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
  expect(getTable('Home')).toHaveLength(1);
  for (const table of ['HomeOccupancy', 'HomeOwner', 'HomeResidencyClaim', 'HomeOwnershipClaim']) expect(getTable(table)).toHaveLength(0);
});

it('isolates list, save, and delete by authenticated account', async () => {
  const own = await request(app).post('/saved-places').set('x-test-user-id', 'u1').send(place);
  const other = await request(app).get('/saved-places').set('x-test-user-id', 'u2');
  expect(other.body.savedPlaces).toEqual([]);
  await request(app).delete(`/saved-places/${own.body.savedPlace.id}`).set('x-test-user-id', 'u2');
  expect(getTable('SavedPlace')).toHaveLength(1);
  const changed = await request(app).post('/saved-places').set('x-test-user-id', 'u2').send({ ...place, expectedUserId: 'u1' });
  expect(changed.status).toBe(409);
  expect(getTable('SavedPlace')).toHaveLength(1);
});

it.each([{ latitude: 91 }, { longitude: -181 }, { latitude: '45.5' }, { label: ' ' }])('rejects invalid private-place input %j', async (invalid) => {
  const res = await request(app).post('/saved-places').set('x-test-user-id', 'u1').send({ ...place, ...invalid });
  expect(res.status).toBe(400); expect(getTable('SavedPlace')).toEqual([]);
});
