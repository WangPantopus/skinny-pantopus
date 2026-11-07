'use strict';
// Atascosa County, Texas: the Atascosa Central Appraisal District's certified PACS export, on its download page. Its data export page offers the file with no limit stated.

const { pacsCounty } = require('../lib/pacs-county.cjs');

module.exports = pacsCounty({
  fips: '48013',
  county: 'Atascosa County',
  publisher: 'Atascosa Central Appraisal District',
  source: 'tx-atascosa',
  page: 'https://atascosacad.com/data-export/',
  pattern: String.raw`href="([^"]*CERTIFIED-EXPORT[^"]*\.zip)"`,
  bedrooms: [],
  baths: ['Plumbing'],
  uses: { A3: 'other', A4: 'mobile_home', A6: 'condo', E3: 'other', E4: 'mobile_home', E5: 'parcel', M1: 'other', M2: 'other', M3: 'mobile_home' },
});
