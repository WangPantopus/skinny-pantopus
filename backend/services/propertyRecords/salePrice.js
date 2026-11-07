'use strict';

/**
 * Whether a record's sale price is for this home. Above this many times the county's market value, a deed's price is
 * for more than the home: some towns list a whole condo building's sale on every unit. The value card and Property
 * details keep the sale's date and say why the price isn't shown.
 */

const MOST_SALE_TIMES_VALUE = 8;

const coversMoreThanHome = (facts) => facts.market_value > 0 && facts.sale_price > MOST_SALE_TIMES_VALUE * facts.market_value;

const COVERS_MORE_NOTE = 'The recorded price for this sale covers more than this home, so it isn\'t shown.';

module.exports = { coversMoreThanHome, COVERS_MORE_NOTE };
