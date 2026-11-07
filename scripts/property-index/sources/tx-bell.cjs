'use strict';
// Bell County, Texas: the Bell County Appraisal District's certified export, on its Data Portal page, which states no limit on use.

const { tabCounty } = require('../lib/tab-county.cjs');

module.exports = tabCounty({
  fips: '48027',
  county: 'Bell County',
  publisher: 'Bell County Appraisal District',
  source: 'tx-bell',
  page: 'https://bellcad.org/data-portal/',
  pattern: String.raw`href="([^"]*Bell-County-Certified-Export[^"]*\.zip)"`,
  uses: { A3: 'house', B2: 'multi_unit', C2: 'parcel', D2: 'other', E: 'parcel', E3: 'other', M1: 'mobile_home' },
});
