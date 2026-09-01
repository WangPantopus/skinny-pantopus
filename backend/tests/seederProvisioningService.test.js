const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const {
  ensureRegionCoverage,
  provisionInstantRegion,
  hasUsableCoordinates,
} = require('../services/seederProvisioningService');

jest.mock('../config/supabaseAdmin', () => ({
  from: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

function makeChain(result) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    single: jest.fn(async () => result),
    upsert: jest.fn(async () => result),
  };
  return chain;
}

describe('seederProvisioningService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('hasUsableCoordinates rejects null island', () => {
    expect(hasUsableCoordinates(45.5, -122.6)).toBe(true);
    expect(hasUsableCoordinates(0, 0)).toBe(false);
    expect(hasUsableCoordinates(null, -122.6)).toBe(false);
  });

  test('ensureRegionCoverage ignores null-island coordinates', async () => {
    await ensureRegionCoverage({
      latitude: 0,
      longitude: 0,
      city: 'Camas',
      state: 'WA',
      userId: 'user-1',
    });

    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  test('provisionInstantRegion ignores null-island coordinates', async () => {
    await provisionInstantRegion({
      latitude: 0,
      longitude: 0,
      city: 'Camas',
      state: 'WA',
    });

    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('provisionInstantRegion creates rows for valid coordinates', async () => {
    const configChain = makeChain({ data: null, error: null });
    const userChain = makeChain({ data: { id: 'curator-1' }, error: null });
    const sourceChain = makeChain({ error: null });

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'seeder_config') return configChain;
      if (table === 'User') return userChain;
      if (table === 'seeder_sources') return sourceChain;
      throw new Error(`Unexpected table ${table}`);
    });

    await provisionInstantRegion({
      latitude: 45.59,
      longitude: -122.4,
      city: 'Camas',
      state: 'WA',
    });

    expect(supabaseAdmin.from).toHaveBeenCalledWith('seeder_config');
    expect(configChain.upsert).toHaveBeenCalled();
    expect(sourceChain.upsert).toHaveBeenCalled();
  });
});
