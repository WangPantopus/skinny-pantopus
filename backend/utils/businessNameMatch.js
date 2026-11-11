'use strict';

/**
 * Do two business names read as the same business?
 *
 * Used where a name must not be taken twice at one address: a business Pantopus has verified keeps its name
 * there (services/businessAddressService.js). It leans toward "same": "Meta", "Meta Inc.", "The Meta Company",
 * "Meta Platforms" and "M3ta" all match "Meta", and "Starbuks Coffee" matches "Starbucks Coffee". Two different
 * businesses that share an address almost never share a name this closely, and the one refused is told how to
 * reach support.
 */

// Words that say what kind of company it is, not which one.
const FILLER_WORDS = new Set([
  'the', 'llc', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'lp', 'llp',
  'pllc', 'pc', 'plc',
]);

// Characters typed to look like a letter ("M3ta", "G00gle").
const LOOKALIKES = { 0: 'o', 1: 'l', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

/** The words of a name that tell it from other names: lowercase, no accents or punctuation, no filler words. */
function nameWords(name) {
  const words = String(name == null ? '' : name)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    // "L.L.C." and "Joe's" stay one word each.
    .replace(/[.'’]/g, '')
    .replace(/[^\p{L}\p{N}@$]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const telling = words.filter((word) => !FILLER_WORDS.has(word));
  // "The Company" is all filler; its words are then all it has.
  return telling.length ? telling : words;
}

const withoutLookalikes = (text) => text.replace(/[013457@$]/g, (c) => LOOKALIKES[c]);
const lettersOnly = (text) => text.replace(/[@$]/g, '');

/** How many single-character edits turn `a` into `b`, counted only up to `most` (more returns most + 1). */
function editDistance(a, b, most) {
  if (Math.abs(a.length - b.length) > most) return most + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let least = i;
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      least = Math.min(least, row[j]);
    }
    if (least > most) return most + 1;
    previous = row;
  }
  return previous[b.length];
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean} true when the two names read as one business
 */
function sameBusinessName(a, b) {
  const wordsA = nameWords(a);
  const wordsB = nameWords(b);
  // A name with no letters or digits at all is compared as typed.
  if (!wordsA.length || !wordsB.length) {
    const typedA = String(a == null ? '' : a).trim().toLowerCase();
    return typedA !== '' && typedA === String(b == null ? '' : b).trim().toLowerCase();
  }

  const joinedA = lettersOnly(wordsA.join(''));
  const joinedB = lettersOnly(wordsB.join(''));
  if (joinedA === joinedB) return true;
  if (withoutLookalikes(wordsA.join('')) === withoutLookalikes(wordsB.join(''))) return true;

  // One name is the other with words added: "Meta" and "Meta Platforms".
  const [fewer, more] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  const moreSet = new Set(more);
  if (fewer.every((word) => moreSet.has(word))) return true;

  // A letter or two off: "Gogle", "Starbuks Coffee". Short names get no slack, or "Cafe" would match "Care"; two
  // letters only in a long name, or "Nail Salon" would match "Hair Salon".
  const shorter = Math.min(joinedA.length, joinedB.length);
  if (shorter >= 12) return editDistance(joinedA, joinedB, 2) <= 2;
  if (shorter >= 5) return editDistance(joinedA, joinedB, 1) <= 1;
  return false;
}

module.exports = { sameBusinessName, nameWords };
