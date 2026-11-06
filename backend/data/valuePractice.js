/**
 * What a state's public records can say about a home's value: the small,
 * deliberately conservative table behind the value card (services/homeValueCard.js)
 * and the appeal comparison (services/exemptionCheckService.js).
 *
 * Honesty rules:
 *   * a fractional or capped assessment never reads as market value, in any state;
 *     a state missing here gets the plain line that says so, not a guess;
 *   * a row is the state's own law or its long-standing practice, checked on
 *     CHECKED_AT; a share that varies by town or county has no row;
 *   * "not public" only ever explains a missing price: a record that holds a price shows it.
 */

const CHECKED_AT = '2026-11-06';

// Where a sale's price isn't public record, in the words the card uses. A county
// that does publish one (a few in Missouri) shows it, because the record holds it.
const SALE_PRICES_NOT_PUBLIC = {
  AK: 'Alaska',
  ID: 'Idaho',
  KS: 'Kansas',
  LA: 'Louisiana',
  MO: 'most of Missouri',
  MS: 'Mississippi',
  MT: 'Montana',
  ND: 'North Dakota',
  NM: 'New Mexico',
  TX: 'Texas',
  UT: 'Utah',
  WY: 'Wyoming',
};

// One fixed share of value set by state law, for homes.
const ASSESSMENT_SHARE = {
  CT: 'Connecticut assesses homes at 70% of fair market value.',
  WA: 'Washington assesses homes at 100% of market value.',
  WV: 'West Virginia assesses homes at 60% of appraised value.',
};

const ASSESSED_VALUE_NOTE = 'Assessed value is what the county uses to figure property tax, not what the home would sell for.';

// Where the law means assessed value to equal market value with no fraction or
// cap, so comparing the two says something. Elsewhere a gap is the law working.
const ASSESSED_AT_FULL_VALUE = new Set(['KY', 'MA', 'VA', 'WA']);

module.exports = { CHECKED_AT, SALE_PRICES_NOT_PUBLIC, ASSESSMENT_SHARE, ASSESSED_VALUE_NOTE, ASSESSED_AT_FULL_VALUE };
