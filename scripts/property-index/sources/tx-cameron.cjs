'use strict';
// Cameron County, Texas: the Cameron Appraisal District's certified PACS export, on its download page. Its page: "considered in the public domain", no warranty.

const { pacsCounty } = require('../lib/pacs-county.cjs');

module.exports = pacsCounty({
  fips: '48061',
  county: 'Cameron County',
  publisher: 'Cameron Appraisal District',
  source: 'tx-cameron',
  page: 'https://www.cameroncad.org/Pages/Data',
  pattern: String.raw`href="([^"]*certified-appraisal-export[^"]*\.zip)"`,
  bedrooms: ['Number of Bedrooms'],
  baths: ['Number of Bathrooms', 'Plumbing'],
});
