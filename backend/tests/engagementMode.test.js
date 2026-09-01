/**
 * Tests for engagement mode inference logic.
 *
 * The inferEngagementMode() function determines how a gig transitions
 * from 'open' to 'assigned' based on category + schedule_type,
 * with user override taking precedence.
 */

const {
  inferEngagementMode,
  PRO_CATEGORIES,
} = require('../services/offerScoringService');

describe('inferEngagementMode', () => {
  // ── instant_accept inference ──

  test('should infer instant_accept for ASAP + non-pro category', () => {
    expect(inferEngagementMode('Moving', 'asap', null)).toBe('instant_accept');
  });

  test('should infer instant_accept for ASAP + Cleaning', () => {
    expect(inferEngagementMode('Cleaning', 'asap', null)).toBe('instant_accept');
  });

  // ── quotes inference (pro categories) ──

  test.each(PRO_CATEGORIES)(
    'should infer quotes for pro category: %s',
    (category) => {
      expect(inferEngagementMode(category, 'asap', null)).toBe('quotes');
      expect(inferEngagementMode(category, 'scheduled', null)).toBe('quotes');
      expect(inferEngagementMode(category, null, null)).toBe('quotes');
    }
  );

  // ── curated_offers inference ──

  test('should infer curated_offers for scheduled + non-pro category', () => {
    expect(inferEngagementMode('Cleaning', 'scheduled', null)).toBe('curated_offers');
  });

  test('should infer curated_offers for flexible schedule', () => {
    expect(inferEngagementMode('Gardening', 'flexible', null)).toBe('curated_offers');
  });

  test('should infer curated_offers for today schedule', () => {
    expect(inferEngagementMode('Pet Care', 'today', null)).toBe('curated_offers');
  });

  // ── user override ──

  test('should respect user override over ASAP inference', () => {
    expect(inferEngagementMode('Moving', 'asap', 'curated_offers')).toBe('curated_offers');
  });

  test('should respect user override over pro category inference', () => {
    expect(inferEngagementMode('Plumbing', 'scheduled', 'instant_accept')).toBe('instant_accept');
  });

  test('should respect user override to quotes', () => {
    expect(inferEngagementMode('Moving', 'asap', 'quotes')).toBe('quotes');
  });

  // ── unknown / null / edge cases ──

  test('should default to curated_offers for unknown category', () => {
    expect(inferEngagementMode('Other', 'scheduled', null)).toBe('curated_offers');
  });

  test('should default to curated_offers for totally unknown category', () => {
    expect(inferEngagementMode('Basket Weaving', null, null)).toBe('curated_offers');
  });

  test('should handle null schedule_type gracefully', () => {
    expect(inferEngagementMode('Moving', null, null)).toBe('curated_offers');
  });

  test('should handle undefined schedule_type gracefully', () => {
    expect(inferEngagementMode('Moving', undefined, null)).toBe('curated_offers');
  });

  test('should handle null category gracefully', () => {
    expect(inferEngagementMode(null, 'asap', null)).toBe('instant_accept');
  });

  test('should handle undefined category gracefully', () => {
    expect(inferEngagementMode(undefined, 'asap', null)).toBe('instant_accept');
  });

  test('should handle both null category and schedule_type', () => {
    expect(inferEngagementMode(null, null, null)).toBe('curated_offers');
  });
});
