/**
 * Tests for Pacific Northwest Seasonal Intelligence Engine.
 *
 * Covers seasonal calendar correctness, overlap handling, home-specific
 * tips, first-action nudges, and edge cases.
 */
const { getSeasonalContext, SEASONS } = require('../services/ai/seasonalEngine');

// ── Helpers ────────────────────────────────────────────────────────────────

/** Create a Date for a specific month/day in 2026. Month is 1-indexed for readability. */
function dateOf(month, day) {
  return new Date(2026, month - 1, day);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SeasonalEngine', () => {
  describe('active seasons per month', () => {
    const cases = [
      { month: 1,  day: 15, label: 'January',   expected: ['winter_ice'] },
      { month: 2,  day: 15, label: 'February',  expected: ['winter_ice'] },
      { month: 3,  day: 15, label: 'March',     expected: ['spring_cleanup'] },
      { month: 4,  day: 15, label: 'April',     expected: ['spring_cleanup'] },
      { month: 5,  day: 15, label: 'May',       expected: ['early_summer'] },
      { month: 6,  day: 15, label: 'June',      expected: ['early_summer'] },
      { month: 7,  day: 15, label: 'July',      expected: ['summer_dry', 'smoke_season'] },
      { month: 8,  day: 15, label: 'August',    expected: ['summer_dry', 'smoke_season'] },
      { month: 9,  day: 15, label: 'September', expected: ['smoke_season', 'fall_prep'] },
      { month: 10, day: 15, label: 'October',   expected: ['fall_prep'] },
      { month: 11, day: 15, label: 'November',  expected: ['fall_prep', 'holiday_season'] },
      { month: 12, day: 15, label: 'December',  expected: ['winter_ice', 'holiday_season'] },
    ];

    for (const { month, day, label, expected } of cases) {
      it(`${label} (${month}/${day}) returns ${expected.join(', ')}`, () => {
        const ctx = getSeasonalContext({ date: dateOf(month, day) });
        expect(ctx.active_seasons.sort()).toEqual(expected.sort());
      });
    }
  });

  describe('overlap periods', () => {
    it('November returns both fall_prep and holiday_season', () => {
      const ctx = getSeasonalContext({ date: dateOf(11, 1) });
      expect(ctx.active_seasons).toContain('fall_prep');
      expect(ctx.active_seasons).toContain('holiday_season');
    });

    it('December 15 returns winter_ice and holiday_season', () => {
      const ctx = getSeasonalContext({ date: dateOf(12, 15) });
      expect(ctx.active_seasons).toContain('winter_ice');
      expect(ctx.active_seasons).toContain('holiday_season');
    });

    it('July 20 returns summer_dry and smoke_season', () => {
      const ctx = getSeasonalContext({ date: dateOf(7, 20) });
      expect(ctx.active_seasons).toContain('summer_dry');
      expect(ctx.active_seasons).toContain('smoke_season');
    });

    it('September returns smoke_season and fall_prep', () => {
      const ctx = getSeasonalContext({ date: dateOf(9, 15) });
      expect(ctx.active_seasons).toContain('smoke_season');
      expect(ctx.active_seasons).toContain('fall_prep');
    });
  });

  describe('primary season selection', () => {
    it('smoke_season takes priority over summer_dry in July', () => {
      const ctx = getSeasonalContext({ date: dateOf(7, 20) });
      expect(ctx.primary_season).toBe('smoke_season');
    });

    it('smoke_season takes priority over fall_prep in September', () => {
      const ctx = getSeasonalContext({ date: dateOf(9, 15) });
      expect(ctx.primary_season).toBe('smoke_season');
    });

    it('winter_ice takes priority over holiday_season in December', () => {
      const ctx = getSeasonalContext({ date: dateOf(12, 15) });
      expect(ctx.primary_season).toBe('winter_ice');
    });

    it('fall_prep takes priority over holiday_season in November', () => {
      const ctx = getSeasonalContext({ date: dateOf(11, 15) });
      expect(ctx.primary_season).toBe('fall_prep');
    });
  });

  describe('home-specific tips based on homeYearBuilt', () => {
    it('pre-1990 home gets age-specific tip in fall_prep', () => {
      const ctx = getSeasonalContext({
        date: dateOf(10, 15),
        homeYearBuilt: 1978,
      });
      expect(ctx.home_specific_tip).toBeDefined();
      expect(ctx.home_specific_tip).not.toBeNull();
      expect(ctx.home_specific_tip).toContain('1978');
    });

    it('post-2010 home gets newer-home tip in fall_prep', () => {
      const ctx = getSeasonalContext({
        date: dateOf(10, 15),
        homeYearBuilt: 2020,
      });
      expect(ctx.home_specific_tip).toBeDefined();
      expect(ctx.home_specific_tip).toContain('newer');
    });

    it('pre-1990 home gets pipe-specific tip in winter_ice', () => {
      const ctx = getSeasonalContext({
        date: dateOf(1, 15),
        homeYearBuilt: 1975,
      });
      expect(ctx.home_specific_tip).toContain('1975');
      expect(ctx.seasonal_tip).toContain('before 1990');
    });

    it('pre-2000 home gets smoke-specific tip in smoke_season', () => {
      const ctx = getSeasonalContext({
        date: dateOf(8, 15),
        homeYearBuilt: 1995,
      });
      expect(ctx.home_specific_tip).toContain('1995');
    });

    it('post-2010 home gets newer-home smoke tip', () => {
      const ctx = getSeasonalContext({
        date: dateOf(8, 15),
        homeYearBuilt: 2022,
      });
      expect(ctx.home_specific_tip).toContain('newer');
    });
  });

  describe('null homeYearBuilt returns valid generic tip', () => {
    it('returns a seasonal_tip without homeYearBuilt', () => {
      const ctx = getSeasonalContext({ date: dateOf(10, 15) });
      expect(ctx.seasonal_tip).toBeDefined();
      expect(typeof ctx.seasonal_tip).toBe('string');
      expect(ctx.seasonal_tip.length).toBeGreaterThan(0);
    });

    it('returns null home_specific_tip when no homeYearBuilt', () => {
      const ctx = getSeasonalContext({ date: dateOf(10, 15) });
      expect(ctx.home_specific_tip).toBeNull();
    });

    it('still returns valid first_action_nudge without homeYearBuilt', () => {
      const ctx = getSeasonalContext({ date: dateOf(10, 15) });
      expect(ctx.first_action_nudge).toBeDefined();
      expect(ctx.first_action_nudge.prompt).toBeDefined();
      expect(ctx.first_action_nudge.gig_category).toBeDefined();
    });
  });

  describe('first_action_nudge per season', () => {
    const nudgeCases = [
      { season: 'winter_ice',    month: 1,  gig_category: 'Handyman' },
      { season: 'spring_cleanup', month: 3,  gig_category: 'Cleaning' },
      { season: 'early_summer',  month: 5,  gig_category: 'Gardening' },
      { season: 'smoke_season',  month: 8,  gig_category: 'Handyman' },
      { season: 'fall_prep',     month: 10, gig_category: 'Handyman' },
    ];

    for (const { season, month, gig_category } of nudgeCases) {
      it(`${season} suggests "${gig_category}" gig category`, () => {
        const ctx = getSeasonalContext({ date: dateOf(month, 15) });
        expect(ctx.first_action_nudge.gig_category).toBe(gig_category);
        expect(ctx.first_action_nudge.prompt).toContain('Post a gig');
        expect(ctx.first_action_nudge.gig_title_suggestion).toBeDefined();
        expect(ctx.first_action_nudge.gig_title_suggestion.length).toBeGreaterThan(0);
      });
    }
  });

  describe('suggested_gig_categories', () => {
    it('returns an array of categories', () => {
      const ctx = getSeasonalContext({ date: dateOf(10, 15) });
      expect(Array.isArray(ctx.suggested_gig_categories)).toBe(true);
      expect(ctx.suggested_gig_categories.length).toBeGreaterThan(0);
    });

    it('fall_prep includes Gardening and Handyman', () => {
      const ctx = getSeasonalContext({ date: dateOf(10, 15) });
      expect(ctx.suggested_gig_categories).toContain('Gardening');
      expect(ctx.suggested_gig_categories).toContain('Handyman');
    });
  });

  describe('urgency levels', () => {
    it('winter_ice has high urgency', () => {
      const ctx = getSeasonalContext({ date: dateOf(1, 15) });
      expect(ctx.urgency).toBe('high');
    });

    it('smoke_season has high urgency', () => {
      const ctx = getSeasonalContext({ date: dateOf(8, 15) });
      expect(ctx.urgency).toBe('high');
    });

    it('spring_cleanup has moderate urgency', () => {
      const ctx = getSeasonalContext({ date: dateOf(3, 15) });
      expect(ctx.urgency).toBe('moderate');
    });

    it('early_summer has low urgency', () => {
      const ctx = getSeasonalContext({ date: dateOf(5, 15) });
      expect(ctx.urgency).toBe('low');
    });
  });

  describe('return shape', () => {
    it('has all required fields', () => {
      const ctx = getSeasonalContext({ date: dateOf(10, 15) });
      expect(ctx).toHaveProperty('active_seasons');
      expect(ctx).toHaveProperty('primary_season');
      expect(ctx).toHaveProperty('seasonal_tip');
      expect(ctx).toHaveProperty('suggested_gig_categories');
      expect(ctx).toHaveProperty('home_specific_tip');
      expect(ctx).toHaveProperty('urgency');
      expect(ctx).toHaveProperty('first_action_nudge');
      expect(ctx.first_action_nudge).toHaveProperty('prompt');
      expect(ctx.first_action_nudge).toHaveProperty('gig_category');
      expect(ctx.first_action_nudge).toHaveProperty('gig_title_suggestion');
    });
  });

  describe('defaults', () => {
    it('uses current date when no date provided', () => {
      const ctx = getSeasonalContext();
      expect(ctx.active_seasons.length).toBeGreaterThan(0);
      expect(ctx.primary_season).toBeDefined();
    });
  });

  describe('homePropertyType', () => {
    it('condo in winter gets condo-specific tip', () => {
      const ctx = getSeasonalContext({
        date: dateOf(1, 15),
        homePropertyType: 'condo',
      });
      expect(ctx.seasonal_tip).toContain('walkway');
    });
  });
});
