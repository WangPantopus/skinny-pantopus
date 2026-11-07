'use strict';
// Liberty County, Texas: the Liberty County Central Appraisal District's certified PACS export, on its download page. Its home page offers the certified roll with no limit stated. Its Plumbing attribute counts fixtures, not baths, so it is left out.

const { pacsCounty } = require('../lib/pacs-county.cjs');

module.exports = pacsCounty({
  fips: '48291',
  county: 'Liberty County',
  publisher: 'Liberty County Central Appraisal District',
  source: 'tx-liberty',
  page: 'https://libertycad.com/',
  pattern: String.raw`href="([^"]*CERTIFIED-APPRAISAL-ROLL-ALL-ENTITIES[^"]*\.zip)"`,
  bedrooms: ['Number of Bedrooms'],
  baths: [],
  uses: { A3: 'house', E: 'parcel', E3: 'house', M2: 'other', M3: 'other' },
});
