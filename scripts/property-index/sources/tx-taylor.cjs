'use strict';
// Taylor County, Texas: the Taylor County Appraisal District's certified PACS export, on its download page. Its page calls its files developed for internal use and not for resale, as is. Nothing here resells them.

const { pacsCounty } = require('../lib/pacs-county.cjs');

module.exports = pacsCounty({
  fips: '48441',
  county: 'Taylor County',
  publisher: 'Taylor County Appraisal District',
  source: 'tx-taylor',
  page: 'https://taylor-cad.org/data-downloads/',
  pattern: String.raw`href="([^"]*Certified_Appr_Roll[^"]*\.zip)"`,
  bedrooms: ['Number of Bedrooms'],
  baths: ['Plumbing'],
  uses: { E3: 'other', E9: 'other', M2: 'other', M3: 'other', M4: 'other', M5: 'other', MZ: 'other' },
});
