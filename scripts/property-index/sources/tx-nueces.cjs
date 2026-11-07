'use strict';
// Nueces County, Texas: the Nueces County Appraisal District's certified PACS export, on its download page. Its download page states no limit on use. Its Plumbing attribute holds other notes, so baths come only from Number of Bathrooms.

const { pacsCounty } = require('../lib/pacs-county.cjs');

module.exports = pacsCounty({
  fips: '48355',
  county: 'Nueces County',
  publisher: 'Nueces County Appraisal District',
  source: 'tx-nueces',
  page: 'https://nuecescad.net/downloads-reports/',
  pattern: String.raw`href="([^"]*Certified-Public-Export[^"]*\.zip)"`,
  bedrooms: ['Number of Bedrooms'],
  baths: ['Number of Bathrooms'],
  uses: { A3: 'other', A4: 'condo', A6: 'condo', E1M: 'mobile_home', E2: 'parcel', E5: 'parcel', E5M: 'mobile_home', E5R: 'house', M2: 'other', M3: 'other' },
});
