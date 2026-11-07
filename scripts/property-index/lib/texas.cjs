'use strict';
// What Texas's appraisal districts share: the Comptroller's property categories, and the owner column's marker for a
// protected person's account (Tax Code 25.025). A marked account carries no facts, so the answer looks like no record.
// The where clause lets a connector ask a service which accounts are marked without reading a single owner name.

const CATEGORY_WORDS = { A: 'Single-family residence', B: 'Multifamily residence', C: 'Vacant lot', D: 'Rural land', E: 'Farm or ranch improvements', F: 'Commercial or industrial', J: 'Utility', M: 'Mobile home', O: 'Residential inventory', S: 'Special inventory', X: 'Exempt' };
const PROTECTED_WORDS = ['CONFIDENTIAL', 'PROTECTED', 'WITHHELD', 'SUPPRESS', 'NOT DISPLAYED', '25.025'];
const protectedWhere = (column) => PROTECTED_WORDS.map((text) => `upper(${column}) like '%${text}%'`).join(' OR ');

// A builder's inventory is a home once a house stands on it.
function useOf(code, hasUnit, improved = false) {
  const c = String(code ?? '').toUpperCase();
  if (c === 'A2' || c.startsWith('M') || c === 'E2') return ['property', 'mobile_home'];
  if (c === 'A3' || c === 'A4') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c.startsWith('A') || c === 'E' || c === 'E1' || (c.startsWith('O') && improved)) return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === 'B2' || c === 'B3' || c === 'B4') return ['building', 'multi_unit'];
  if (c.startsWith('B')) return ['building', 'apartment'];
  if (c.startsWith('C') || c.startsWith('D') || c.startsWith('O') || c === 'E3' || c === 'E4' || !c) return ['parcel', null];
  return ['other', null];
}

module.exports = { CATEGORY_WORDS, protectedWhere, useOf };
