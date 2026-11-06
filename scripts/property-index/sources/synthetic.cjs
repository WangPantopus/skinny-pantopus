'use strict';
// A made-up county for checking the build on a pull request, whose logs and runs are public: every street here is
// fictional. check-synthetic.cjs reads the release back and prints what each kind of address answers.

const { parts } = require('../../../backend/services/propertyRecords/addressKey');

const FIPS = '00001';
const home = (kind, homeType, id, address, facts, extra = {}) => ({
  id: `pp:${kind}:${FIPS}:${id}`,
  kind,
  home_type: homeType,
  address: { ...parts(address), city: 'EXAMPLEVILLE', zip: '00001' },
  facts: { parcel_number: id, county: 'Example County', fips: FIPS, ...facts },
  ...extra,
});
const interior = { year_built: 1998, living_sqft: 1120, bedrooms: 2, bathrooms: 2, full_baths: 2, stories: 3, market_value: 412000, value_year: 2026 };

function build() {
  const records = [];
  for (let i = 1; i <= 2000; i += 1) {
    records.push(home('property', 'house', `H${i}`, { number: String(100 + i), pre: 'NE', name: `${(i % 40) + 1}TH`, suffix: 'AVE' },
      { year_built: 1950 + (i % 70), living_sqft: 900 + i, bedrooms: 2 + (i % 4), bathrooms: 1 + (i % 3), lot_sqft: 5000 + i, market_value: 300000 + i * 10, value_year: 2026 }));
  }
  const condo = 'pp:building:00001:C1';
  for (const unit of ['101', '102', '012']) {
    records.push(home('unit', 'condo', `U${unit}`, { number: '500', name: 'EXAMPLE TRUST', suffix: 'LN', unit }, interior, { parent: condo }));
  }
  records.push({ ...home('building', 'condo', 'C1', { number: '500', name: 'EXAMPLE TRUST', suffix: 'LN' }, { year_built: 1998, units_in_condominium: 3, stories: 3 }), id: condo, roster: ['012', '101', '102'] });
  records.push(home('building', 'apartment', 'T1', { number: '700', name: 'EXAMPLE TRUST', suffix: 'LN' }, { year_built: 2016, units: 240, stories: 12 }, { roster: ['1201', '1202'] }));
  records.push(home('parcel', null, 'L1', { number: '900', name: 'EXAMPLE TRUST', suffix: 'LN' }, { lot_acres: 1.2 }));
  // One address, two records.
  records.push(home('property', 'house', 'A1', { number: '1000', name: 'EXAMPLE TRUST', suffix: 'LN' }, { year_built: 1970 }));
  records.push(home('property', 'house', 'A2', { number: '1000', name: 'EXAMPLE TRUST', suffix: 'LN' }, { year_built: 1980 }));
  // Same street line in two ZIPs.
  records.push({ ...home('property', 'house', 'Z1', { number: '1100', name: 'EXAMPLE TRUST', suffix: 'LN' }, { year_built: 1971 }) });
  records.at(-1).address.zip = '00002';
  // A record the source marks as protected.
  records.push({ ...home('property', 'house', 'P1', { number: '1200', name: 'EXAMPLE TRUST', suffix: 'LN' }, {}), facts: {}, restricted: true });
  return [{
    fips: FIPS, state: 'ZZ', name: 'Example County', publisher: 'Example County Assessor', dataset: 'test file', method: 'county', source: 'synthetic',
    as_of: '2026-11-03', stale_after_days: 90, records,
  }];
}

module.exports = { build };
