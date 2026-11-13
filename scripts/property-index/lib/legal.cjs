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

// lotNumber's six connectors keep its answers as they are (they're live). Run everywhere else, a lot also says nothing when:
// it's a government lot (a piece of a survey section, not of a plat); more than one lot or a range is named ("LOT 3, 4",
// "LOT 3 THRU 5"); a part of it is ("S HALF LOT 3", "PCL 2 OF LOT 3"); or the text may have been cut short, so an
// exception after the cut could be lost.
const GOVERNMENT_LOT = /\bGOV(?:'?T|ERNMENT)?\.?\s+LOTS?\b/;
const MORE_OR_LESS = /\bLOT\s+#?\d+[A-Z]?\s*[,;]\s*#?\d|\b(?:THRU|THROUGH|TO)\s+#?\d|\b(?:HALF|HLF|PORTION|PRT|PCL|PARCEL|STRIP|ADJ|ADJOINING|PLUS|INCL|UNDIV|INT|SUB\s+OF|RESUB\s+OF|REPLAT\s+OF)\b/;
const MAY_BE_CUT = 295;

// A survey section, township and range ("S12 T2N R1W", "SEC 12 T 2 N R 1 W"). Beside a plat's name it only says where the
// plat is; with no plat named, "LOT 3" of a section is a government lot, not a plat's.
const SURVEY = /\b(?:S|SEC|SECTION)\s*\d+\s*[-,]?\s*T(?:WP)?\s*\d+\s*[NS]\b\s*[-,]?\s*R(?:NG)?\s*\d+\s*[EW]\b/g;
const PLAT_WORD = /\b[A-Z][A-Z'&-]{2,}\b/g;
const NOT_A_NAME = new Set(['LOT', 'LOTS', 'BLK', 'BLOCK', 'THE', 'AND', 'ADD', 'ADDN', 'ADDITION', 'SUB', 'SUBD', 'SUBDIVISION', 'PLAT', 'UNIT', 'PHASE', 'SEC', 'SECTION']);

/** A legal description with a survey reference beside a plat's name taken out; null when no plat is named beside it. */
function withoutSurvey(text) {
  if (!SURVEY.test(text)) return text;
  SURVEY.lastIndex = 0;
  const rest = text.replace(SURVEY, ' ').replace(/\s+/g, ' ').trim();
  return (rest.match(PLAT_WORD) || []).some((word) => !NOT_A_NAME.has(word)) ? rest : null;
}

/** A whole lot, read from any county's legal description. */
function wholeLot(legal) {
  const raw = String(legal || '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (!raw || raw.length >= MAY_BE_CUT) return null;
  // "LT 12" is a lot too, where the description never also says "LOT".
  const text = withoutSurvey(/\bLOTS?\b/.test(raw) ? raw : raw.replace(/\bLT\b/g, 'LOT'));
  if (!text || GOVERNMENT_LOT.test(text) || MORE_OR_LESS.test(text)) return null;
  return lotNumber(text);
}

module.exports = { lotNumber, wholeLot, withoutSurvey, MAY_BE_CUT };
