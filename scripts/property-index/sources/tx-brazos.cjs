'use strict';
// Brazos County, Texas: the Brazos Central Appraisal District's certified PACS export, on its Certified Data Downloads page; no limit on use stated.

const { pacsCounty } = require('../lib/pacs-county.cjs');

module.exports = pacsCounty({
  fips: '48041',
  county: 'Brazos County',
  publisher: 'Brazos Central Appraisal District',
  source: 'tx-brazos',
  page: 'https://brazoscad.org/certified-data-downloads/',
  pattern: String.raw`href="([^"]*CERTIFI[^"]*\.zip)"`,
  bedrooms: ['Number of Bedrooms'],
  baths: ['Plumbing'],
  uses: { A3: 'multi_unit', A4: 'multi_unit', A5: 'multi_unit', A6: 'condo', A7: 'condo', A8: 'house', A9: 'multi_unit', B10: 'other', E4: 'parcel', EA2: 'mobile_home', EB1: 'apartment', EB2: 'multi_unit', EB3: 'multi_unit', EB4: 'multi_unit', M2: 'other', M3: 'other' },
});
