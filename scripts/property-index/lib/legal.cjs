'use strict';
// Reading a legal description for the one thing a screen shows from it.

const PART_OF_A_LOT = /\b(?:PTN|PORT|POR|PT|PART|FT|EX|EXC|EXCEPT|LESS|TGW|TOG|AND|OF\s+LOT)\b|&|\d\/\d/;

/**
 * A legal description's lot, only when it plainly names one whole lot: not "LOTS 3 & 4", "PTN LOT 3", "E 1/2 LOT 3",
 * "S 5 FT OF LOT 3" or "LOT 3 EX THE N 5 FT". `short` also reads a county's "L 3".
 */
function lotNumber(legal, { short = false } = {}) {
  const text = String(legal || '').toUpperCase();
  if (PART_OF_A_LOT.test(text) || /\bLOTS\b/.test(text)) return null;
  const pattern = short ? /\b(?:LOT|L)\s+#?(\d+[A-Z]?)(?![\w/-])/g : /\bLOT\s+#?(\d+[A-Z]?)(?![\w/-])/g;
  const named = [...text.matchAll(pattern)];
  return named.length === 1 && (short || (text.match(/\bLOT\b/g) || []).length === 1) ? named[0][1] : null;
}

module.exports = { lotNumber };
