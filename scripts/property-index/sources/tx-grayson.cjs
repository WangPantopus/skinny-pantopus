'use strict';
// Grayson County, Texas: the Grayson Central Appraisal District's certified PACS export, on its download page. Its public information page offers the export; informational, no warranty.

const { pacsCounty } = require('../lib/pacs-county.cjs');

module.exports = pacsCounty({
  fips: '48181',
  county: 'Grayson County',
  publisher: 'Grayson Central Appraisal District',
  source: 'tx-grayson',
  page: 'https://graysonappraisal.org/public-information/',
  pattern: String.raw`href="([^"]*GCAD_Export[^"]*\.zip)"`,
  bedrooms: [],
  baths: ['Plumbing'],
  uses: { A3: 'house', A4: 'other', B1: 'multi_unit', B2: 'apartment' },
});
