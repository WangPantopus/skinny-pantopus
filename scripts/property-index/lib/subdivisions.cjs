'use strict';
// A home's subdivision from its legal description, only when the description plainly names one plat and one whole lot in
// it: "OAK HILLS PH 2 LOT 12 BLK 3", "LT 12 BLK 3 OAK HILLS SEC 2", "OAK HILLS, BLOCK 3, LOT 12". A name counts only when
// enough of the county's other lots name it too (a plat has many lots; a misread doesn't recur), and never when the text is
// a survey description (section, township, range), a part of a lot, or more than one lot.

const { wholeLot, withoutSurvey } = require('./legal.cjs');

// Plat book and page references and the like that follow a name and aren't part of it.
const AFTER_NAME = /\s*(?:P\/?B|PLAT\s*BOOK|PLAT\s*BK|OR\s*BK|ORB|BK|BOOK|VOL|CAB|SLIDE|DOC|INST|AFN)\s*#?\s*\d.*$/;
// Words run together where a county's lines were joined without a space ("RANCHESSEC 2"): such a name isn't shown.
const RUN_TOGETHER = /[A-Z]{3}(?:SEC|UNIT|PHASE|BLK|LOT)\s*\d|\b(?:BLK|BLOCK|BL|LOTS?|LT)\b/;
// A name holds letters, digits and a few marks; anything else ("^", "%") is a county's own markup around it. Survey bits
// ("T2 R1 S12", "SW1/4", "NE4") aren't a plat's name either.
const NOT_IN_A_NAME = /[^A-Z0-9 '&#\/-]|\b[TRS]\d+\b|\b[NS][EW]\s*\d|\b[NS][EW]\s*1\/4|\b(?:TIF|SF|CONT|BM\d+|MP\s*\d|MAP\s+\d)\b|^[^A-Z]/;
const NOT_A_PLAT = /\b(?:T\s*\d+\s*[NS]\b|R\s*\d+\s*[EW]\b|TWP|RNG|RANGE|BEG|BEGIN|COM(?:M)?\s+AT|THENCE|TH\s+[NSEW]|FT|FEET|ACRES?|AC\b|PTN|PT\b|PART|PORTION|POR\b|EXC?\b|EXCEPT|LESS|UNDIV|INT\b|CONDO|CONDOMINIUM|UNIT\s+\d|APT|BLDG|SHORT\s+PLAT|SP\s*\d|S\/P|CSM|CERTIFIED\s+SURVEY|SURVEY|METES|DLC|DONATION|GOV|GOVT|GOVERNMENT|HOMESTEAD|TRACT\s+[A-Z]\b|PARCEL|PCL|STRIP|UNPLATTED|UNRECORDED|UNREC|BINDING\s+SITE|BSP)\b/;
const GENERIC = new Set(['ADDITION', 'ADD', 'ADDN', 'SUBDIVISION', 'SUB', 'SUBD', 'ESTATES', 'PLAT', 'REPLAT', 'RESUB', 'RESUBDIVISION', 'THE', 'OF', 'TOWN', 'CITY',
  'ORIGINAL', 'ORIG', 'TOWNSITE', 'PHASE', 'PH', 'SECTION', 'SEC', 'UNIT', 'NO', 'BLOCK', 'BLK', 'LOT', 'LT', 'MAP', 'AMENDED', 'AMD', 'REVISED', 'REV', 'FIRST', 'SECOND', 'THIRD']);
const LOT_WORD = /\b(?:LOTS?|LT)\b/;
const BLOCK = /\b(?:BLK|BLOCK|BL)\s+#?[A-Z0-9]{1,4}\b/g;
const LOT = /\b(?:LOT|LT)\s+#?\d+[A-Z]?\b/g;

function clean(legal) {
  return String(legal || '').toUpperCase().replace(/[.;:"]/g, ' ').replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The plat a legal description names, or null. Reads the description alone (the county check is subdivisionReader). */
function readName(legal) {
  const whole = clean(legal);
  const text = whole && withoutSurvey(whole);
  if (!text || !wholeLot(legal) || NOT_A_PLAT.test(text)) return null;
  const lots = text.match(LOT) || [];
  if (lots.length !== 1 || (text.match(LOT_WORD) || []).length !== 1) return null;
  const at = text.indexOf(lots[0]);
  // The name is on one side of the lot (and its block): both sides holding words is a description this doesn't read.
  const before = text.slice(0, at).replace(BLOCK, ' ').trim();
  const after = text.slice(at + lots[0].length).replace(BLOCK, ' ').trim();
  if (Boolean(before) === Boolean(after)) return null;
  const name = (before || after).replace(AFTER_NAME, '').replace(/^\/+|\/+$/g, '').replace(/^PLAT\s+(?:OF|FOR)\s+(?:THE\s+)?/, '').replace(/\s+/g, ' ').trim();
  if (RUN_TOGETHER.test(name) || NOT_IN_A_NAME.test(name)) return null;
  const words = name.split(' ');
  if (!words.some((word) => /^[A-Z][A-Z'&-]{2,}$/.test(word) && !GENERIC.has(word))) return null;
  if (name.length < 4 || name.length > 60 || /^\d/.test(name)) return null;
  return name;
}

/** The same plat, however the county writes it: punctuation, "SUBDIVISION" or "SUB", "PHASE" or "PH". */
function key(name) {
  return clean(name).replace(/\b(?:SUBDIVISION|SUBD|SUB|ADDITION|ADDN|ADD|ESTATES|EST|THE|REVISED|REV|REPLAT|RESUB|AMENDED|AMD|PLAT|MAP|OF|TO)\b/g, ' ')
    .replace(/\b(?:PHASE|PH|SECTION|SEC|UNIT|NUMBER|NO|FILING|FLG)\s*#?\s*[A-Z0-9-]{0,4}\b/g, ' ').replace(/#/g, ' ').replace(/[^A-Z0-9]/g, '');
}
const sameName = (a, b) => key(a) === key(b);
/** The same plat or a numbered part of it: "SUMMIT COVE SUB # 3" names a filing of the county's "SUMMIT COVE SUB". */
const samePlat = (a, b) => { const [x, y] = [key(a), key(b)]; return Boolean(x && y) && (x === y || x.replace(/\d+$/, '') === y.replace(/\d+$/, '')); };

// A name is a plat's only when at least this many of the county's legal descriptions name it.
const LOTS_IN_A_PLAT = 5;
// The states where the reader was checked (VXDERIVE sample, Nov 13): where counties state a subdivision too, the reader named
// the same plat (or a numbered filing of it) for 98.7% of Texas homes, 96.5% Florida, 98.6% Oklahoma, 95.8% Missouri, 93.7%
// Minnesota and 91.2% Montana; Colorado's and Washington's misses were the county's own suffixes ("- LG", a section and
// quarter); California, Idaho, Tennessee and New Mexico, where no county states one, read cleanly by eye. North Carolina,
// Ohio (Franklin's descriptions start with the street), South Carolina, Virginia and Nebraska didn't, so they get none.
const CHECKED_STATES = new Set(['TX', 'FL', 'OK', 'MO', 'MN', 'MT', 'CO', 'WA', 'CA', 'ID', 'TN', 'NM']);

/** For one county: the reader, or null when no legal description names a plat or its state isn't checked. */
function subdivisionReader(records, county = {}) {
  if (!CHECKED_STATES.has(county.state)) return null;
  const named = new Map();
  for (const record of records) {
    const legal = !record.restricted && record.facts?.legal_description;
    const name = legal && readName(legal);
    if (name) named.set(key(name), (named.get(key(name)) || 0) + 1);
  }
  if (!named.size) return null;
  return (legal) => {
    const name = readName(legal);
    return name && named.get(key(name)) >= LOTS_IN_A_PLAT ? name : null;
  };
}

module.exports = { subdivisionReader, readName, sameName, samePlat, key };
