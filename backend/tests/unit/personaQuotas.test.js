// P1.3 — pure quota math.
//
// Audience Profile v2 §7.3: quota remaining = tier.limit - count(non-reverted
// PersonaQuotaUsage rows in current period). The serializer-side rendering
// of that count is in computeQuotaRemaining; this file pins its exact
// semantics so future serializer edits can rely on it.

const { computeQuotaRemaining } = require('../../utils/personaQuotas');

describe('computeQuotaRemaining', () => {
  test('returns null when tierLimit is null (capability unavailable)', () => {
    expect(computeQuotaRemaining(null, 0)).toBeNull();
    expect(computeQuotaRemaining(null, 999)).toBeNull();
    expect(computeQuotaRemaining(undefined, 0)).toBeNull();
  });

  test('returns -1 when tierLimit is negative (reserved)', () => {
    expect(computeQuotaRemaining(-1, 0)).toBe(-1);
    expect(computeQuotaRemaining(-1, 5)).toBe(-1);
    expect(computeQuotaRemaining(-100, 5)).toBe(-1);
  });

  test('returns the remaining quota for normal cases', () => {
    expect(computeQuotaRemaining(5, 0)).toBe(5);
    expect(computeQuotaRemaining(5, 1)).toBe(4);
    expect(computeQuotaRemaining(5, 3)).toBe(2);
    expect(computeQuotaRemaining(5, 5)).toBe(0);
    expect(computeQuotaRemaining(25, 7)).toBe(18);
  });

  test('clamps at 0 when used exceeds limit', () => {
    expect(computeQuotaRemaining(5, 10)).toBe(0);
    expect(computeQuotaRemaining(1, 999)).toBe(0);
  });

  test('treats negative usage counts as 0', () => {
    // A negative count would only happen via a programming error, but the
    // helper is defensive: it must never report MORE quota than tier allows.
    expect(computeQuotaRemaining(5, -3)).toBe(5);
  });

  test('coerces non-integer usage counts via | 0', () => {
    expect(computeQuotaRemaining(5, 2.7)).toBe(3);
    expect(computeQuotaRemaining(5, '4')).toBe(1);
    expect(computeQuotaRemaining(5, NaN)).toBe(5);
  });
});
