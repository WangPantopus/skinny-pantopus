/**
 * How a homeowner asks for a county's value to be reviewed, by state: the small, deliberately conservative table
 * behind the Home Money Check's property tax card (services/placeIntelligenceService.js `ownerMoneyCards`).
 *
 * Honesty rules, as for data/homesteadPrograms.js:
 *   * every entry states only what its state's own page says (`source`), read on CHECKED_AT; where that page gives
 *     no deadline, the entry gives none;
 *   * a state missing here gets no appeal line at all, not a guess;
 *   * facts only: who takes the filing, what it is called and the state's own window. Never "you should appeal",
 *     never a saving.
 *
 * Refresh: once a year against each `source`, and whenever a state changes its rule.
 */

const CHECKED_AT = '2026-11-10';

const STATE_APPEALS = {
  FL: {
    note: 'In Florida, a petition about a property\'s value is filed with the Value Adjustment Board clerk in the county where the property is.',
    source: { name: 'Florida Department of Revenue', url: 'https://floridarevenue.com/property/Pages/VAB.aspx' },
  },
  TX: {
    note: 'In Texas, an owner files a notice of protest (Form 50-132) with the appraisal review board, usually by May 15 or 30 days after the appraisal district mails the notice of appraised value, whichever is later.',
    source: { name: 'Texas Comptroller', url: 'https://comptroller.texas.gov/taxes/property-tax/protests/' },
  },
  WA: {
    note: 'In Washington, an owner files a Taxpayer Petition for Review of Property Valuation Determination with the county\'s Board of Equalization, by July 1 of the assessment year or within 30 days of the assessor\'s Change of Value Notice, whichever is later. Some counties allow 60 days.',
    source: { name: 'Washington Department of Revenue', url: 'https://dor.wa.gov/taxes-rates/property-tax/appealing-your-property-assessment-county-board-equalization' },
  },
};

/** A state's entry, or null: no entry is no appeal line. */
const appealForState = (state) => STATE_APPEALS[String(state || '').trim().toUpperCase()] || null;

module.exports = { CHECKED_AT, STATE_APPEALS, appealForState };
