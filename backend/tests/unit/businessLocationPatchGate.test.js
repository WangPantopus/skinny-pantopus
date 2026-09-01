/**
 * CRIT-01, the edit half. Creating a BusinessLocation ran the address decision
 * engine — household conflict included — but PATCH persisted whatever address
 * it was handed. Create a storefront at your own address, then edit it to a
 * stranger's verified home: two requests, no probe, and their address
 * published with an exact map pin. The PATCH route now takes the same gate.
 */

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

jest.setTimeout(15000);

jest.mock('../../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

jest.mock('../../services/businessAddressService', () => ({
  validateBusinessAddress: jest.fn(),
}));

jest.mock('../../utils/businessPermissions', () => {
  const actual = jest.requireActual('../../utils/businessPermissions');
  return {
    ...actual,
    checkBusinessPermission: jest.fn().mockResolvedValue({ hasAccess: true, role: 'owner' }),
  };
});

jest.mock('../../utils/geocoding', () => ({
  geocodeAddress: jest.fn().mockResolvedValue(null),
}));

const { validateBusinessAddress } = require('../../services/businessAddressService');

const BIZ_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LOC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/businesses', require('../../routes/businesses'));
  return app;
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  seedTable('BusinessLocation', [{
    id: LOC_ID,
    business_user_id: BIZ_ID,
    address: '500 Commerce Way',
    address2: null,
    city: 'Portland',
    state: 'OR',
    zipcode: '97209',
    geocode_mode: 'permanent',
    is_active: true,
  }]);
});

test('editing the address to a conflicting one is refused with 409', async () => {
  validateBusinessAddress.mockResolvedValue({
    decision: { status: 'conflict', reasons: ['residential_household_at_address'] },
  });

  const res = await request(createApp())
    .patch(`/api/businesses/${BIZ_ID}/locations/${LOC_ID}`)
    .send({ address: '123 Main St', city: 'Portland', state: 'OR', zipcode: '97201' });

  expect(res.status).toBe(409);
  expect(res.body.code).toBe('ADDRESS_CONFLICT');
  // Nothing persisted.
  const loc = getTable('BusinessLocation').find((l) => l.id === LOC_ID);
  expect(loc.address).toBe('500 Commerce Way');
});

test('an address the engine rejects outright is refused with 422', async () => {
  validateBusinessAddress.mockResolvedValue({
    decision: { status: 'po_box', reasons: ['PO_BOX'] },
  });

  const res = await request(createApp())
    .patch(`/api/businesses/${BIZ_ID}/locations/${LOC_ID}`)
    .send({ address: 'PO Box 42' });

  expect(res.status).toBe(422);
  expect(res.body.code).toBe('ADDRESS_REJECTED');
});

test('a clean address edit passes the gate and persists', async () => {
  validateBusinessAddress.mockResolvedValue({
    decision: { status: 'ok', reasons: [] },
  });

  const res = await request(createApp())
    .patch(`/api/businesses/${BIZ_ID}/locations/${LOC_ID}`)
    .send({ address: '600 Commerce Way' });

  expect(res.status).toBe(200);
  expect(validateBusinessAddress).toHaveBeenCalledTimes(1);
  const loc = getTable('BusinessLocation').find((l) => l.id === LOC_ID);
  expect(loc.address).toBe('600 Commerce Way');
});

test('a non-address edit does not invoke the engine at all', async () => {
  const res = await request(createApp())
    .patch(`/api/businesses/${BIZ_ID}/locations/${LOC_ID}`)
    .send({ is_primary: true });

  expect(res.status).toBe(200);
  expect(validateBusinessAddress).not.toHaveBeenCalled();
});
