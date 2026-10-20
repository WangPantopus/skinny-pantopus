'use strict';

/** Small text helpers the Plans and Nearby nudges share. Titles are at most 60 characters, bodies 160 (contract §3.2). */

/** At most `max` characters, cut at a word. */
function fit(text, max) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[,.;:]$/, '')}…`;
}

const capitalized = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text);

/** "a", "a and b", "a, b and c". */
const listText = (parts) => (parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

module.exports = { fit, capitalized, listText };
