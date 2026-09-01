// ============================================================
// TEST: Business Profile Completeness Calculator
// Validates the 0-100 scoring rubric across all 10 factors.
// ============================================================

const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');
const { calculateProfileCompleteness } = require('../utils/businessCompleteness');

beforeEach(() => resetTables());

const BIZ_ID = 'biz-completeness-1';

// Helper: seed minimal profile (name only — always exists at creation)
function seedMinimalProfile(overrides = {}) {
  seedTable('BusinessProfile', [{
    business_user_id: BIZ_ID,
    description: null,
    logo_file_id: null,
    banner_file_id: null,
    categories: [],
    public_phone: null,
    public_email: null,
    website: null,
    social_links: null,
    ...overrides,
  }]);
}

function seedUser(overrides = {}) {
  seedTable('User', [{ id: BIZ_ID, tagline: null, ...overrides }]);
}

// ── Score = 5 for brand-new business ───────────────────────
describe('calculateProfileCompleteness', () => {
  test('returns 5 for brand new business (name only)', async () => {
    seedMinimalProfile();
    seedTable('BusinessLocation', []);
    seedTable('BusinessCatalogItem', []);
    seedUser();

    const score = await calculateProfileCompleteness(BIZ_ID);
    expect(score).toBe(5);
  });

  // ── Score = 100 for fully complete profile ──────────────────
  test('returns 100 for fully complete profile', async () => {
    seedMinimalProfile({
      description: 'A'.repeat(60), // 60 chars ≥ 50
      logo_file_id: 'file-logo-1',
      banner_file_id: 'file-banner-1',
      categories: ['plumbing'],
      public_phone: '555-1234',
      website: 'https://example.com',
      social_links: { instagram: '@foo' },
      verification_status: 'government_verified',
    });
    seedTable('BusinessLocation', [{
      id: 'loc-1',
      business_user_id: BIZ_ID,
      location: 'POINT(-122 45)',
      is_active: true,
    }]);
    seedTable('BusinessCatalogItem', [{
      id: 'item-1',
      business_user_id: BIZ_ID,
      status: 'active',
    }]);
    seedTable('BusinessHours', [{
      id: 'hour-1',
      location_id: 'loc-1',
    }]);
    seedUser({ tagline: 'Best plumber in town' });

    const score = await calculateProfileCompleteness(BIZ_ID);
    // 5+15+9+8+15+10+10+10+5+5+3+15 = 110, clamped to 100
    expect(score).toBe(100);
  });

  // ── Description scoring ─────────────────────────────────────
  test('scores description correctly — too short gets 0', async () => {
    // Short description (< 50 chars) — no points
    seedMinimalProfile({ description: 'Short' });
    seedTable('BusinessLocation', []);
    seedTable('BusinessCatalogItem', []);
    seedUser();

    const shortScore = await calculateProfileCompleteness(BIZ_ID);
    expect(shortScore).toBe(5); // name only

    // 60-char description — gets +15
    resetTables();
    seedMinimalProfile({ description: 'A'.repeat(60) });
    seedTable('BusinessLocation', []);
    seedTable('BusinessCatalogItem', []);
    seedUser();

    const longScore = await calculateProfileCompleteness(BIZ_ID);
    expect(longScore).toBe(20); // 5 (name) + 15 (description)
  });

  // ── Location requires non-null PostGIS column ───────────────
  test('location requires non-null PostGIS column', async () => {
    // Location with null coordinates — no points
    seedMinimalProfile();
    seedTable('BusinessLocation', [{
      id: 'loc-1',
      business_user_id: BIZ_ID,
      location: null,
      is_active: true,
    }]);
    seedTable('BusinessCatalogItem', []);
    seedUser();

    const nullScore = await calculateProfileCompleteness(BIZ_ID);
    expect(nullScore).toBe(5); // name only, no location credit

    // Location with coordinates — gets +15
    resetTables();
    seedMinimalProfile();
    seedTable('BusinessLocation', [{
      id: 'loc-1',
      business_user_id: BIZ_ID,
      location: 'POINT(-122 45)',
      is_active: true,
    }]);
    seedTable('BusinessCatalogItem', []);
    seedUser();

    const coordScore = await calculateProfileCompleteness(BIZ_ID);
    expect(coordScore).toBe(20); // 5 (name) + 15 (location)
  });

  // ── Catalog item must be active ─────────────────────────────
  test('catalog item must be active', async () => {
    // Archived item — no points
    seedMinimalProfile();
    seedTable('BusinessLocation', []);
    seedTable('BusinessCatalogItem', [{
      id: 'item-1',
      business_user_id: BIZ_ID,
      status: 'archived',
    }]);
    seedUser();

    const archivedScore = await calculateProfileCompleteness(BIZ_ID);
    expect(archivedScore).toBe(5); // name only

    // Active item — gets +10
    resetTables();
    seedMinimalProfile();
    seedTable('BusinessLocation', []);
    seedTable('BusinessCatalogItem', [{
      id: 'item-1',
      business_user_id: BIZ_ID,
      status: 'active',
    }]);
    seedUser();

    const activeScore = await calculateProfileCompleteness(BIZ_ID);
    expect(activeScore).toBe(15); // 5 (name) + 10 (catalog)
  });
});
