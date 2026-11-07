'use strict';
// Johnson County, Texas: the Johnson Central Appraisal District's certified records, on its Downloads page: as certified, no warranty, no limit on use stated.

const { tabCounty } = require('../lib/tab-county.cjs');

module.exports = tabCounty({
  fips: '48251',
  county: 'Johnson County',
  publisher: 'Johnson Central Appraisal District',
  source: 'tx-johnson',
  page: 'https://johnsoncad.com/downloads',
  pattern: String.raw`href="([^"]*\.zip)"[^>]*>\s*20\d\d Certified Records`,
  columns: { account: 'ACCOUNT' },
  // ACCOUNT is R000000128 where the other tables say 128.
  keyOf: (account) => account.replace(/^[A-Z]0*/, ''),
  uses: { A3: 'house', A4: 'condo', B4: 'multi_unit', E3: 'other', M3: 'mobile_home' },
});
