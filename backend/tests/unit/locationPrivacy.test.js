// ============================================================
// TEST: Location Privacy – applyLocationPrecision & resolveGigPrecision
//
// Pure-function unit tests. No DB or network mocking needed.
// ============================================================

const {
  applyLocationPrecision,
  resolveGigPrecision,
  precisionRank,
  leastPrecise,
} = require('../../utils/locationPrivacy');

// ── applyLocationPrecision ──────────────────────────────

describe('applyLocationPrecision', () => {
  const make = () => ({
    latitude: 45.515232,
    longitude: -122.678391,
    location_address: '123 Main St',
    exact_address: '123 Main St, Portland, OR',
    location_name: 'Downtown Portland',
  });

  it('returns exact coordinates + locationUnlocked:true for owner', () => {
    const obj = make();
    applyLocationPrecision(obj, 'approx_area', true);
    expect(obj.latitude).toBe(45.515232);
    expect(obj.longitude).toBe(-122.678391);
    expect(obj.locationUnlocked).toBe(true);
    expect(obj.location_address).toBe('123 Main St');
  });

  it('returns exact coordinates + locationUnlocked:true for exact_place', () => {
    const obj = make();
    applyLocationPrecision(obj, 'exact_place', false);
    expect(obj.latitude).toBe(45.515232);
    expect(obj.longitude).toBe(-122.678391);
    expect(obj.locationUnlocked).toBe(true);
  });

  it('jitters coordinates + locationUnlocked:false for approx_area', () => {
    const obj = make();
    applyLocationPrecision(obj, 'approx_area', false);
    expect(obj.latitude).not.toBe(45.515232);
    expect(obj.longitude).not.toBe(-122.678391);
    // Jitter should be within ~0.005 range
    expect(Math.abs(obj.latitude - 45.515232)).toBeLessThan(0.01);
    expect(Math.abs(obj.longitude - (-122.678391))).toBeLessThan(0.01);
    expect(obj.locationUnlocked).toBe(false);
    expect(obj.location_address).toBeNull();
    expect(obj.exact_address).toBeNull();
  });

  it('rounds coordinates for neighborhood_only', () => {
    const obj = make();
    applyLocationPrecision(obj, 'neighborhood_only', false);
    expect(obj.latitude).toBe(45.52);
    expect(obj.longitude).toBe(-122.68);
    expect(obj.locationUnlocked).toBe(false);
    expect(obj.location_address).toBeNull();
  });

  it('nulls everything for none', () => {
    const obj = make();
    applyLocationPrecision(obj, 'none', false);
    expect(obj.latitude).toBeNull();
    expect(obj.longitude).toBeNull();
    expect(obj.location_address).toBeNull();
    expect(obj.location_name).toBeNull();
    expect(obj.locationUnlocked).toBe(false);
  });

  it('handles unknown precision as approx_area', () => {
    const obj = make();
    applyLocationPrecision(obj, 'invalid_precision', false);
    expect(obj.latitude).not.toBe(45.515232);
    expect(obj.locationUnlocked).toBe(false);
    expect(obj.location_address).toBeNull();
  });

  it('is deterministic (same coords → same jitter)', () => {
    const a = make();
    const b = make();
    applyLocationPrecision(a, 'approx_area', false);
    applyLocationPrecision(b, 'approx_area', false);
    expect(a.latitude).toBe(b.latitude);
    expect(a.longitude).toBe(b.longitude);
  });

  it('does not set locationUnlocked when setUnlockedFlag is false', () => {
    const obj = make();
    applyLocationPrecision(obj, 'approx_area', false, { setUnlockedFlag: false });
    expect(obj.locationUnlocked).toBeUndefined();
  });

  it('preserves address when stripAddress is false', () => {
    const obj = make();
    applyLocationPrecision(obj, 'approx_area', false, { stripAddress: false });
    expect(obj.location_address).toBe('123 Main St');
  });

  it('handles null obj gracefully', () => {
    expect(applyLocationPrecision(null, 'approx_area', false)).toBeNull();
  });

  it('uses custom lat/lng field names', () => {
    const obj = { lat: 45.5, lng: -122.6, location_address: 'test' };
    applyLocationPrecision(obj, 'none', false, { latField: 'lat', lngField: 'lng' });
    expect(obj.lat).toBeNull();
    expect(obj.lng).toBeNull();
  });
});

// ── resolveGigPrecision ─────────────────────────────────

describe('resolveGigPrecision', () => {
  const OWNER = 'owner-id';
  const WORKER = 'worker-id';
  const ANON = null;
  const OTHER = 'other-id';

  const makeGig = (overrides = {}) => ({
    user_id: OWNER,
    accepted_by: WORKER,
    status: 'assigned',
    location_precision: 'approx_area',
    reveal_policy: 'after_assignment',
    ...overrides,
  });

  it('returns exact + locationUnlocked for gig owner', () => {
    const result = resolveGigPrecision(makeGig(), OWNER);
    expect(result.precision).toBe('exact_place');
    expect(result.isOwner).toBe(true);
    expect(result.locationUnlocked).toBe(true);
  });

  it('returns exact + locationUnlocked for beneficiary', () => {
    const result = resolveGigPrecision(makeGig({ beneficiary_user_id: 'ben-id' }), 'ben-id');
    expect(result.precision).toBe('exact_place');
    expect(result.isOwner).toBe(true);
    expect(result.locationUnlocked).toBe(true);
  });

  it('returns exact + locationUnlocked for assigned worker (status=assigned)', () => {
    const result = resolveGigPrecision(makeGig({ status: 'assigned' }), WORKER);
    expect(result.precision).toBe('exact_place');
    expect(result.isOwner).toBe(false);
    expect(result.locationUnlocked).toBe(true);
  });

  it('returns exact + locationUnlocked for worker (status=active)', () => {
    const result = resolveGigPrecision(makeGig({ status: 'active' }), WORKER);
    expect(result.precision).toBe('exact_place');
    expect(result.locationUnlocked).toBe(true);
  });

  it('returns exact + locationUnlocked for worker (status=in_progress)', () => {
    const result = resolveGigPrecision(makeGig({ status: 'in_progress' }), WORKER);
    expect(result.precision).toBe('exact_place');
    expect(result.locationUnlocked).toBe(true);
  });

  it('returns exact + locationUnlocked for worker (status=completed)', () => {
    const result = resolveGigPrecision(makeGig({ status: 'completed' }), WORKER);
    expect(result.precision).toBe('exact_place');
    expect(result.locationUnlocked).toBe(true);
  });

  it('does NOT unlock for worker when gig is still open', () => {
    const result = resolveGigPrecision(makeGig({ status: 'open' }), WORKER);
    expect(result.precision).toBe('approx_area');
    expect(result.locationUnlocked).toBe(false);
  });

  it('does NOT unlock for worker when gig is cancelled', () => {
    const result = resolveGigPrecision(makeGig({ status: 'cancelled' }), WORKER);
    expect(result.precision).toBe('approx_area');
    expect(result.locationUnlocked).toBe(false);
  });

  it('returns approx for anonymous viewer', () => {
    const result = resolveGigPrecision(makeGig(), ANON);
    expect(result.precision).toBe('approx_area');
    expect(result.isOwner).toBe(false);
    expect(result.locationUnlocked).toBe(false);
  });

  it('returns approx for random other viewer', () => {
    const result = resolveGigPrecision(makeGig(), OTHER);
    expect(result.precision).toBe('approx_area');
    expect(result.locationUnlocked).toBe(false);
  });

  it('enforces approx_area minimum for never_public policy', () => {
    const result = resolveGigPrecision(makeGig({
      reveal_policy: 'never_public',
      location_precision: 'exact_place',
    }), OTHER);
    // never_public should not return exact_place for non-owner
    expect(result.locationUnlocked).toBe(false);
  });

  it('respects stored precision for normal browsing', () => {
    const result = resolveGigPrecision(makeGig({
      location_precision: 'neighborhood_only',
    }), OTHER);
    expect(result.precision).toBe('neighborhood_only');
    expect(result.locationUnlocked).toBe(false);
  });

  it('defaults missing reveal_policy to after_assignment', () => {
    const result = resolveGigPrecision(makeGig({ reveal_policy: undefined }), OTHER);
    expect(result.precision).toBe('approx_area');
    expect(result.locationUnlocked).toBe(false);
  });
});

// ── Helper functions ────────────────────────────────────

describe('precisionRank', () => {
  it('ranks exact_place as most precise (0)', () => {
    expect(precisionRank('exact_place')).toBe(0);
  });

  it('ranks approx_area as 1', () => {
    expect(precisionRank('approx_area')).toBe(1);
  });

  it('ranks neighborhood_only as 2', () => {
    expect(precisionRank('neighborhood_only')).toBe(2);
  });

  it('ranks none as 3 (least precise)', () => {
    expect(precisionRank('none')).toBe(3);
  });

  it('defaults unknown to 1 (approx_area)', () => {
    expect(precisionRank('whatever')).toBe(1);
  });
});

describe('leastPrecise', () => {
  it('picks the less precise of two levels', () => {
    expect(leastPrecise('exact_place', 'approx_area')).toBe('approx_area');
    expect(leastPrecise('approx_area', 'exact_place')).toBe('approx_area');
    expect(leastPrecise('approx_area', 'neighborhood_only')).toBe('neighborhood_only');
    expect(leastPrecise('none', 'exact_place')).toBe('none');
  });

  it('returns same when equal', () => {
    expect(leastPrecise('approx_area', 'approx_area')).toBe('approx_area');
  });
});
