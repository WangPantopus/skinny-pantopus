'use strict';
// Bastrop County, Texas: the Bastrop Central Appraisal District's real property export, on its exports page; no limit on use stated.

const { tabCounty } = require('../lib/tab-county.cjs');

module.exports = tabCounty({
  fips: '48021',
  county: 'Bastrop County',
  publisher: 'Bastrop Central Appraisal District',
  source: 'tx-bastrop',
  page: 'https://bastropcad.org/exports-valuation-reports/',
  pattern: String.raw`href="([^"]*RE-PUBLIC-D[^"]*\.zip)"`,
  uses: { A3: 'other', E2: 'other', E3: 'mobile_home', E4: 'parcel', M3: 'mobile_home' },
});
