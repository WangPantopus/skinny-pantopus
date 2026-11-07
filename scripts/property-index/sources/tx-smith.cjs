'use strict';
// Smith County, Texas: the Smith County Appraisal District's certified real property roll, on its Downloads page: "available for users to import into other applications".
// The roll's use codes come with no words, so what stands on an account comes from its improvement type.

const { tabCounty } = require('../lib/tab-county.cjs');

function useOfRow(code, row, unit) {
  const type = String(row['IMPROVEMENT TYPE'] || '').toUpperCase();
  if (/^(C|D|O01)/.test(code)) return ['parcel', null];
  if (/^(F|J|X|OPR)/.test(code)) return ['other', null];
  if (code === 'B70') return ['building', 'apartment'];
  if (code.startsWith('B')) return ['building', 'multi_unit'];
  if (type === 'MOBILE HOME' || code === 'M10') return ['property', 'mobile_home'];
  if (type === 'RESIDENCE') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (code.startsWith('E')) return ['parcel', null];
  return ['other', null];
}

module.exports = tabCounty({
  fips: '48423',
  county: 'Smith County',
  publisher: 'Smith County Appraisal District',
  source: 'tx-smith',
  page: 'https://www.smithcad.org/downloads.html',
  pattern: String.raw`href="([^"]*Real_Property_Certifled_AppraisalRoll[^"]*\.zip)"`,
  table: 'Extract1.csv',
  delimiter: ',',
  columns: { account: 'ACCOUNT NUM', number: 'STREET_NUMBER', pre: 'STREET_DIRECTION', street: 'STREET_NAME', suffix: 'STREET_SUFFIX', unit: null, city: null, use: 'USE CODE', useWords: 'IMPROVEMENT TYPE', landSqft: null, acres: 'ACREAGE', living: 'HEATED AREA', built: 'YEAR_BUILT', market: 'MKT VAL', landValue: 'LAND MKT VALUE', building: 'TOTAL BUILDING VALUE' },
  useOfRow,
});
