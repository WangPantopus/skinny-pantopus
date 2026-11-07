'use strict';
// Kaufman County, Texas: the Kaufman Central Appraisal District's certified PACS export, on its download page. Its public information page offers the export with no limit stated.

const { pacsCounty } = require('../lib/pacs-county.cjs');

module.exports = pacsCounty({
  fips: '48257',
  county: 'Kaufman County',
  publisher: 'Kaufman Central Appraisal District',
  source: 'tx-kaufman',
  page: 'https://kaufman-cad.org/public-info/',
  pattern: String.raw`href="([^"]*Certified-Export-Files[^"]*\.zip)"`,
  bedrooms: ['Number of Bedrooms'],
  baths: ['Plumbing'],
  uses: { A3: 'condo', A4: 'other', A5: 'house', A6: 'house', A9: 'house', B4: 'other', E10: 'other', E3: 'other', E4: 'house', E5: 'parcel', E6: 'parcel', E7: 'parcel', E8: 'parcel', E9: 'house', M2: 'other', M3: 'other' },
});
