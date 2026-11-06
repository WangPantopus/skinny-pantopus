'use strict';
// Reading a street line in a state file, and the small cleanups every statewide file needs.

const { parse } = require('../../../backend/services/propertyRecords/addressKey');

/**
 * A number that spans a building, "12-14" or "12 14", as the numbers it holds: mail goes to either. A connector asks
 * for this only where the file means a range: in Queens "12-14" is one number.
 */
function houseNumbers(number) {
  const text = String(number ?? '').trim().toUpperCase();
  const range = /^(\d+)\s*(?:-|\s)\s*(\d+)$/.exec(text);
  if (!range) return [text];
  const [first, last] = [Number(range[1]), Number(range[2])];
  return last > first && last - first <= 40 && (last - first) % 2 === 0 ? [range[1], range[2]] : [text];
}

/** One parsed address per number the record's line holds. Empty when the line can't be read. */
function readAddresses(numbers, street, unit = '') {
  const found = [];
  for (const number of numbers) {
    const parsed = parse(`${number} ${street}`, unit);
    if (parsed) found.push(parsed);
  }
  return found;
}

const year = (text, thisYear = new Date().getFullYear()) => {
  const value = Number(text);
  return Number.isInteger(value) && value >= 1600 && value <= thisYear + 1 ? value : null;
};

/** "20261103" or "2026-11-03T00:00" or an ArcGIS time as an ISO date, or null. */
function isoDate(value) {
  if (typeof value === 'number') return value > 0 ? new Date(value).toISOString().slice(0, 10) : null;
  const text = String(value ?? '').trim();
  const american = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (american) return isoDate(`${american[3]}-${american[1].padStart(2, '0')}-${american[2].padStart(2, '0')}`);
  const match = /^(\d{4})[-.]?(\d{2})[-.]?(\d{2})/.exec(text);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  return y >= 1700 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** Five digits, restoring a leading zero a numeric column lost ("1001" in Massachusetts). */
function zipCode(value) {
  const text = String(value ?? '').trim();
  if (/^\d{5}/.test(text)) return text.slice(0, 5);
  return /^\d{4}$/.test(text) ? `0${text}` : '';
}

module.exports = { houseNumbers, readAddresses, year, isoDate, zipCode };
