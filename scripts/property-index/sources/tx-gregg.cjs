'use strict';
// Gregg County, Texas: the Gregg Appraisal District's certified real property data, on its downloads page: for information, not a survey; no limit on use stated.

const { tabCounty } = require('../lib/tab-county.cjs');

module.exports = tabCounty({
  fips: '48183',
  county: 'Gregg County',
  publisher: 'Gregg Appraisal District',
  source: 'tx-gregg',
  page: 'https://gcad.org/downloads/',
  pattern: String.raw`href="([^"]*Certified-Real-Appraisal-Data[^"]*\.zip)"`,
  uses: { A3: 'house', A4: 'condo', A5: 'other', A72: 'multi_unit', B1: 'apartment', E2: 'house', E3: 'other', EL: 'parcel', M1: 'other', M3: 'mobile_home' },
});
