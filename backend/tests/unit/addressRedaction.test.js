/**
 * utils/addressRedaction — the pure helpers behind the privacy promise
 * "Neighbors see a first name and a street at most. Never a house
 * number or unit."
 */
const {
  redactStreet,
  houseNumberOf,
  queryKnowsNumber,
  firstNameOnly,
} = require('../../utils/addressRedaction');

describe('redactStreet', () => {
  it.each([
    ['1214 NE Birch St', 'NE Birch St'],
    ['1214 NE Birch St Apt 3', 'NE Birch St'],
    ['1214 NE Birch St, Unit B', 'NE Birch St'],
    ['1214 NE Birch St #12', 'NE Birch St'],
    ['1214A NE Birch St Suite 200', 'NE Birch St'],
    ['1214-1216 NE Birch St', 'NE Birch St'],
    ['  1214   NE Birch  St  ', 'NE Birch St'],
    ['PO Box 88', 'PO Box'],
    ['P.O. Box 88', 'PO Box'],
    ['Old Mill House', 'Old Mill House'],
  ])('%s → %s', (input, expected) => {
    expect(redactStreet(input)).toBe(expected);
  });

  it('is null-safe', () => {
    expect(redactStreet(null)).toBeNull();
    expect(redactStreet('')).toBeNull();
    expect(redactStreet('   ')).toBeNull();
    expect(redactStreet(42)).toBeNull();
  });

  it('never leaves the house number in the output', () => {
    for (const addr of ['1 Main St', '99999 W 4th Ave Fl 2', '77b Elm Rd']) {
      const out = redactStreet(addr);
      expect(out).not.toMatch(/^\d/);
    }
  });
});

describe('houseNumberOf', () => {
  it('returns the lower-cased leading number token', () => {
    expect(houseNumberOf('1214 NE Birch St')).toBe('1214');
    expect(houseNumberOf('1214A NE Birch St')).toBe('1214a');
    expect(houseNumberOf('1214-1216 NE Birch St')).toBe('1214');
  });
  it('returns null for addresses without one', () => {
    expect(houseNumberOf('PO Box 88')).toBeNull();
    expect(houseNumberOf('Old Mill House')).toBeNull();
    expect(houseNumberOf(null)).toBeNull();
  });
});

describe('queryKnowsNumber (the discover knowledge proof)', () => {
  it('is true only when a search token equals the house number', () => {
    expect(queryKnowsNumber(['1214', 'ne', 'birch'], '1214 NE Birch St')).toBe(true);
    expect(queryKnowsNumber(['birch', 'st'], '1214 NE Birch St')).toBe(false);
    expect(queryKnowsNumber(['121'], '1214 NE Birch St')).toBe(false); // prefix is not knowledge
    expect(queryKnowsNumber(['1214a'], '1214A NE Birch St')).toBe(true);
  });
  it('is false for addresses without a number, and for bad input', () => {
    expect(queryKnowsNumber(['box'], 'PO Box 88')).toBe(false);
    expect(queryKnowsNumber(null, '1214 NE Birch St')).toBe(false);
  });
});

describe('firstNameOnly', () => {
  it('keeps the first token', () => {
    expect(firstNameOnly('Yingpeng Wang')).toBe('Yingpeng');
    expect(firstNameOnly('  Ada   Lovelace ')).toBe('Ada');
    expect(firstNameOnly('Prince')).toBe('Prince');
  });
  it('is null-safe', () => {
    expect(firstNameOnly(null)).toBeNull();
    expect(firstNameOnly('')).toBeNull();
  });
});
