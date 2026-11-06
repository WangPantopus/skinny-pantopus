'use strict';

/**
 * How an address is compared with a county's record: the same rules for the
 * county's columns (scripts/property-index reads them with parts()) and for
 * what a person's Home holds (parse()). No dependencies, so the index build
 * runs without the backend's packages.
 *
 * Directions and street types read the way USPS abbreviates them, numbered
 * streets lose their "TH", and a unit keeps every character that could tell it
 * from another (leading zeros: unit 012 is not unit 12). Nothing is guessed: a
 * street line this can't read has no key, and a lookup answers that it found no
 * record. Home.address_hash (utils/normalizeAddress.js) is a different thing:
 * it decides whether two Homes are the same place.
 */

const DIRECTIONS = new Map(Object.entries({
  N: 'N', NORTH: 'N', S: 'S', SOUTH: 'S', E: 'E', EAST: 'E', W: 'W', WEST: 'W',
  NE: 'NE', NORTHEAST: 'NE', NW: 'NW', NORTHWEST: 'NW', SE: 'SE', SOUTHEAST: 'SE', SW: 'SW', SOUTHWEST: 'SW',
}));

// USPS Publication 28's street suffixes, in the spellings counties and Google use.
const SUFFIX_FORMS = {
  ALY: ['ALLEY', 'ALLY', 'ALY'], ANX: ['ANNEX', 'ANX'], ARC: ['ARCADE', 'ARC'], AVE: ['AVENUE', 'AVE', 'AV', 'AVEN', 'AVENU', 'AVN'],
  BCH: ['BEACH', 'BCH'], BND: ['BEND', 'BND'], BLF: ['BLUFF', 'BLF'], BLVD: ['BOULEVARD', 'BLVD', 'BOUL', 'BOULV'], BR: ['BRANCH', 'BR', 'BRNCH'],
  BRG: ['BRIDGE', 'BRG', 'BRDGE'], BRK: ['BROOK', 'BRK'], BYP: ['BYPASS', 'BYP', 'BYPA', 'BYPAS'], CYN: ['CANYON', 'CYN', 'CANYN'],
  CP: ['CAMP', 'CP'], CTR: ['CENTER', 'CTR', 'CENTRE', 'CENT'], CIR: ['CIRCLE', 'CIR', 'CIRC', 'CRCL', 'CRCLE'], CLF: ['CLIFF', 'CLF'],
  CLB: ['CLUB', 'CLB'], CMN: ['COMMON', 'CMN'], COR: ['CORNER', 'COR'], CRSE: ['COURSE', 'CRSE'], CT: ['COURT', 'CT', 'CRT'],
  CTS: ['COURTS', 'CTS'], CV: ['COVE', 'CV'], CRK: ['CREEK', 'CRK'], CRES: ['CRESCENT', 'CRES', 'CRSENT', 'CRSNT'], CRST: ['CREST', 'CRST'],
  XING: ['CROSSING', 'XING', 'CRSSNG'], DL: ['DALE', 'DL'], DM: ['DAM', 'DM'], DV: ['DIVIDE', 'DV', 'DVD'], DR: ['DRIVE', 'DR', 'DRIV', 'DRV'],
  EST: ['ESTATE', 'EST'], ESTS: ['ESTATES', 'ESTS'], EXPY: ['EXPRESSWAY', 'EXPY', 'EXPR', 'EXPRESS', 'EXPW'], EXT: ['EXTENSION', 'EXT', 'EXTN'],
  FLS: ['FALLS', 'FLS'], FRY: ['FERRY', 'FRY', 'FERRY'], FLD: ['FIELD', 'FLD'], FLDS: ['FIELDS', 'FLDS'], FLT: ['FLAT', 'FLT'], FRD: ['FORD', 'FRD'],
  FRST: ['FOREST', 'FRST', 'FORESTS'], FRG: ['FORGE', 'FRG'], FRK: ['FORK', 'FRK'], FT: ['FORT', 'FT', 'FRT'], FWY: ['FREEWAY', 'FWY', 'FREEWY', 'FRWY'],
  GDN: ['GARDEN', 'GDN', 'GRDN'], GDNS: ['GARDENS', 'GDNS', 'GRDNS'], GTWY: ['GATEWAY', 'GTWY', 'GATEWY'], GLN: ['GLEN', 'GLN'], GRN: ['GREEN', 'GRN'],
  GRV: ['GROVE', 'GRV', 'GROV'], HBR: ['HARBOR', 'HBR', 'HARB'], HVN: ['HAVEN', 'HVN'], HTS: ['HEIGHTS', 'HTS', 'HT'], HWY: ['HIGHWAY', 'HWY', 'HIWAY', 'HIWY', 'HWAY'],
  HL: ['HILL', 'HL'], HLS: ['HILLS', 'HLS'], HOLW: ['HOLLOW', 'HOLW', 'HLLW', 'HOLWS'], INLT: ['INLET', 'INLT'], IS: ['ISLAND', 'IS', 'ISLND'],
  ISLE: ['ISLE', 'ISLES'], JCT: ['JUNCTION', 'JCT', 'JCTN'], KY: ['KEY', 'KY'], KNL: ['KNOLL', 'KNL', 'KNOL'], LK: ['LAKE', 'LK'], LKS: ['LAKES', 'LKS'],
  LNDG: ['LANDING', 'LNDG', 'LNDNG'], LN: ['LANE', 'LN'], LGT: ['LIGHT', 'LGT'], LOOP: ['LOOP', 'LOOPS', 'LP'], MALL: ['MALL'], MNR: ['MANOR', 'MNR'],
  MDW: ['MEADOW', 'MDW'], MDWS: ['MEADOWS', 'MDWS'], MEWS: ['MEWS'], ML: ['MILL', 'ML'], MTWY: ['MOTORWAY', 'MTWY'], MT: ['MOUNT', 'MT'], MTN: ['MOUNTAIN', 'MTN'],
  ORCH: ['ORCHARD', 'ORCH'], OVAL: ['OVAL'], OPAS: ['OVERPASS', 'OPAS'], PARK: ['PARK', 'PRK'], PKWY: ['PARKWAY', 'PKWY', 'PKY', 'PARKWY'], PASS: ['PASS'],
  PATH: ['PATH', 'PATHS'], PIKE: ['PIKE', 'PIKES'], PNES: ['PINES', 'PNES'], PL: ['PLACE', 'PL'], PLN: ['PLAIN', 'PLN'], PLZ: ['PLAZA', 'PLZ'], PT: ['POINT', 'PT'],
  PTS: ['POINTS', 'PTS'], PRT: ['PORT', 'PRT'], PR: ['PRAIRIE', 'PR'], RADL: ['RADIAL', 'RADL'], RAMP: ['RAMP'], RNCH: ['RANCH', 'RNCH', 'RANCHES'], RDG: ['RIDGE', 'RDG'],
  RIV: ['RIVER', 'RIV'], RD: ['ROAD', 'RD'], RDS: ['ROADS', 'RDS'], RTE: ['ROUTE', 'RTE', 'RT'], ROW: ['ROW'], RUE: ['RUE'], RUN: ['RUN'], SHR: ['SHORE', 'SHR'],
  SHRS: ['SHORES', 'SHRS'], SKWY: ['SKYWAY', 'SKWY'], SPG: ['SPRING', 'SPG'], SPGS: ['SPRINGS', 'SPGS'], SPUR: ['SPUR', 'SPURS'], SQ: ['SQUARE', 'SQ', 'SQR'],
  STA: ['STATION', 'STA'], ST: ['STREET', 'ST', 'STR', 'STRT'], SMT: ['SUMMIT', 'SMT'], TER: ['TERRACE', 'TER', 'TERR'], TRCE: ['TRACE', 'TRCE', 'TRCES'], TRAK: ['TRACK', 'TRAK'],
  TRFY: ['TRAFFICWAY', 'TRFY'], TRL: ['TRAIL', 'TRL', 'TR', 'TRLS'], TRLR: ['TRAILER', 'TRLR'], TUNL: ['TUNNEL', 'TUNL'], TPKE: ['TURNPIKE', 'TPKE', 'TPK'], UPAS: ['UNDERPASS', 'UPAS'],
  UN: ['UNION', 'UN'], VLY: ['VALLEY', 'VLY'], VIA: ['VIADUCT', 'VIA'], VW: ['VIEW', 'VW'], VLG: ['VILLAGE', 'VLG', 'VILL'], VL: ['VILLE', 'VL'], VIS: ['VISTA', 'VIS', 'VST'],
  WALK: ['WALK', 'WLK'], WALL: ['WALL'], WAY: ['WAY', 'WY'], WL: ['WELL', 'WL'], WLS: ['WELLS', 'WLS'],
};
const SUFFIXES = new Map(Object.entries(SUFFIX_FORMS).flatMap(([usps, forms]) => forms.map((form) => [form, usps])));

// What marks the secondary part of a street line, and what USPS calls it.
const UNIT_WORDS = new Map(Object.entries({
  APT: 'APT', APARTMENT: 'APT', UNIT: 'UNIT', STE: 'STE', SUITE: 'STE', BLDG: 'BLDG', BUILDING: 'BLDG', FL: 'FL', FLOOR: 'FL', RM: 'RM', ROOM: 'RM',
  TRLR: 'TRLR', TRAILER: 'TRLR', LOT: 'LOT', SPC: 'SPC', SPACE: 'SPC', DEPT: 'DEPT', STOP: 'STOP', SLIP: 'SLIP', HNGR: 'HNGR', PIER: 'PIER', KEY: 'KEY',
  BSMT: 'BSMT', FRNT: 'FRNT', LOWR: 'LOWR', UPPR: 'UPPR', REAR: 'REAR', SIDE: 'SIDE', LBBY: 'LBBY', PH: 'PH', OFC: 'OFC',
}));
// Words that are a whole secondary with no number after them.
const BARE_UNIT_WORDS = new Set(['BSMT', 'FRNT', 'LOWR', 'UPPR', 'REAR', 'SIDE', 'LBBY', 'PH', 'OFC']);

// Words a county may spell out or not at the start of a street name.
const NAME_STARTS = new Map(Object.entries({ ST: 'SAINT', STE: 'SAINTE', MT: 'MOUNT', FT: 'FORT' }));
// The same road under different words: "HWY 99", "HIGHWAY 99", "STATE HIGHWAY 99".
const ROAD_NAMES = [
  [/^(STATE|ST)\s+(HWY|HIGHWAY|ROUTE|RTE|RT|RD|ROAD)\s+/, 'SR '],
  [/^SR\s+/, 'SR '],
  [/^(US|U S|US HWY|U S HWY|US HIGHWAY|US ROUTE|US RTE)\s+(?=\d)/, 'US '],
  [/^(COUNTY|CNTY)\s+(HWY|HIGHWAY|ROAD|RD|ROUTE|RTE)\s+/, 'CR '],
  [/^CR\s+/, 'CR '],
  [/^(HWY|HIGHWAY)\s+/, 'HIGHWAY '],
  [/^(RTE|RT|ROUTE)\s+(?=\d)/, 'ROUTE '],
];

function clean(text) {
  return String(text ?? '').toUpperCase().replace(/[.,'"`]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Numbered streets compare without their ordinals: "45TH" and "45" are one street. */
function nameWord(word) {
  const ordinal = /^(\d+)(ST|ND|RD|TH)$/.exec(word);
  return ordinal ? ordinal[1] : word;
}

function normalName(words) {
  let name = words.map(nameWord).join(' ');
  for (const [pattern, replacement] of ROAD_NAMES) {
    if (pattern.test(name)) {
      name = name.replace(pattern, replacement);
      break;
    }
  }
  const [first, ...rest] = name.split(' ');
  return rest.length && NAME_STARTS.has(first) ? [NAME_STARTS.get(first), ...rest].join(' ') : name;
}

/** The characters that tell one unit from another: "#4-B", "APT 4 B" and "4b" are one unit; 012 stays 012. */
function unitKey(unit) {
  const text = clean(unit).replace(/^#\s*/, '');
  const words = text.split(' ').filter(Boolean);
  while (words.length > 1 && UNIT_WORDS.has(words[0])) words.shift();
  if (words.length === 1 && UNIT_WORDS.has(words[0]) && !BARE_UNIT_WORDS.has(UNIT_WORDS.get(words[0]))) return '';
  return words.join('').replace(/[^A-Z0-9/]/g, '');
}

/** A house number's sort position: the leading digits padded, so numbers sort numerically; then the rest ("12A", "12-1/2"). */
function numberSort(number) {
  const match = /^(\d+)(.*)$/.exec(number || '');
  return match ? `${match[1].padStart(9, '0')}${match[2]}` : `~${number || ''}`;
}

/**
 * A street line's parts from what a county's columns say. Direction and type
 * are read wherever the county put them; empty columns stay empty.
 */
function parts({ number, numberSuffix = '', pre = '', name = '', suffix = '', post = '', unit = '', building = '' }) {
  const nameWords = clean(name).split(' ').filter(Boolean);
  let preDir = DIRECTIONS.get(clean(pre)) || '';
  let postDir = DIRECTIONS.get(clean(post)) || '';
  let type = SUFFIXES.get(clean(suffix)) || '';
  // A county that keeps it all in the name column: "NE 45TH AVE".
  if (!preDir && nameWords.length > 1 && DIRECTIONS.has(nameWords[0])) preDir = DIRECTIONS.get(nameWords.shift());
  if (!postDir && nameWords.length > 1 && DIRECTIONS.has(nameWords[nameWords.length - 1])) postDir = DIRECTIONS.get(nameWords.pop());
  if (!type && nameWords.length > 1 && SUFFIXES.has(nameWords[nameWords.length - 1])) type = SUFFIXES.get(nameWords.pop());
  const street = normalName(nameWords);
  const house = `${clean(number).replace(/\s+/g, '')}${clean(numberSuffix).replace(/\s+/g, '')}`;
  if (!house || !street) return null;
  return { number: house, pre: preDir, name: street, suffix: type, post: postDir, unit: unitKey(unit), building: unitKey(building) };
}

// The house number and any half: "123", "123 1/2", "123A", "12-34".
const HOUSE = /^(\d+[A-Z]?(?:-\d+[A-Z]?)?)(?:\s+(\d\/\d))?\s+(.+)$/;
// A secondary at the end of a line: "APT 4B", "# 4B", "BLDG 2 UNIT 12".
const SECONDARY = new RegExp(`\\s+(?:#\\s*([A-Z0-9/-]+)|((?:${[...UNIT_WORDS.keys()].join('|')})(?:\\s+[A-Z0-9/-]+)?(?:\\s+(?:${[...UNIT_WORDS.keys()].join('|')})\\s*[A-Z0-9/-]*)?))$`);

/**
 * A person's street line read into the same parts. `unit` is what the person's
 * address holds apart from the line (Home.address2, HomeAddress.address_line2_norm).
 * Null when the line doesn't start with a house number.
 */
function parse(line, unit = '') {
  let text = clean(String(line ?? '').split(',')[0]);
  let secondary = clean(unit);
  const inline = SECONDARY.exec(text);
  if (inline) {
    text = text.slice(0, inline.index).trim();
    if (!secondary) secondary = inline[1] || inline[2];
  }
  const house = HOUSE.exec(text);
  if (!house) return null;
  const words = house[3].split(' ').filter(Boolean);
  let pre = '';
  let post = '';
  let suffix = '';
  if (words.length > 1 && DIRECTIONS.has(words[0])) pre = DIRECTIONS.get(words.shift());
  if (words.length > 1 && DIRECTIONS.has(words[words.length - 1])) post = DIRECTIONS.get(words.pop());
  if (words.length > 1 && SUFFIXES.has(words[words.length - 1])) suffix = SUFFIXES.get(words.pop());
  // "BLDG 2 UNIT 12" keeps both.
  const inBuilding = /^(?:BLDG|BUILDING)\s+(\S+)\s+(?:APT|APARTMENT|UNIT|STE|SUITE|#)?\s*(\S+)$/.exec(secondary);
  return {
    number: `${house[1]}${house[2] || ''}`,
    pre,
    name: normalName(words),
    suffix,
    post,
    unit: unitKey(inBuilding ? inBuilding[2] : secondary),
    building: inBuilding ? unitKey(inBuilding[1]) : '',
  };
}

/** Where an address sorts in a county's release: all of one name and house number sit together, whatever their direction or type. */
function sortKey(address) {
  return `${address.name}\u0000${numberSort(address.number)}`;
}

/** The five-digit ZIP, or ''. */
function zip5(zip) {
  const match = /^(\d{5})/.exec(String(zip ?? '').trim());
  return match ? match[1] : '';
}

const city = (value) => clean(value);

const STATES = {
  AL: ['ALABAMA', '01'], AK: ['ALASKA', '02'], AZ: ['ARIZONA', '04'], AR: ['ARKANSAS', '05'], CA: ['CALIFORNIA', '06'], CO: ['COLORADO', '08'],
  CT: ['CONNECTICUT', '09'], DE: ['DELAWARE', '10'], DC: ['DISTRICT OF COLUMBIA', '11'], FL: ['FLORIDA', '12'], GA: ['GEORGIA', '13'], HI: ['HAWAII', '15'],
  ID: ['IDAHO', '16'], IL: ['ILLINOIS', '17'], IN: ['INDIANA', '18'], IA: ['IOWA', '19'], KS: ['KANSAS', '20'], KY: ['KENTUCKY', '21'], LA: ['LOUISIANA', '22'],
  ME: ['MAINE', '23'], MD: ['MARYLAND', '24'], MA: ['MASSACHUSETTS', '25'], MI: ['MICHIGAN', '26'], MN: ['MINNESOTA', '27'], MS: ['MISSISSIPPI', '28'],
  MO: ['MISSOURI', '29'], MT: ['MONTANA', '30'], NE: ['NEBRASKA', '31'], NV: ['NEVADA', '32'], NH: ['NEW HAMPSHIRE', '33'], NJ: ['NEW JERSEY', '34'],
  NM: ['NEW MEXICO', '35'], NY: ['NEW YORK', '36'], NC: ['NORTH CAROLINA', '37'], ND: ['NORTH DAKOTA', '38'], OH: ['OHIO', '39'], OK: ['OKLAHOMA', '40'],
  OR: ['OREGON', '41'], PA: ['PENNSYLVANIA', '42'], RI: ['RHODE ISLAND', '44'], SC: ['SOUTH CAROLINA', '45'], SD: ['SOUTH DAKOTA', '46'], TN: ['TENNESSEE', '47'],
  TX: ['TEXAS', '48'], UT: ['UTAH', '49'], VT: ['VERMONT', '50'], VA: ['VIRGINIA', '51'], WA: ['WASHINGTON', '53'], WV: ['WEST VIRGINIA', '54'], WI: ['WISCONSIN', '55'],
  WY: ['WYOMING', '56'], PR: ['PUERTO RICO', '72'], VI: ['VIRGIN ISLANDS', '78'], GU: ['GUAM', '66'], AS: ['AMERICAN SAMOA', '60'], MP: ['NORTHERN MARIANA ISLANDS', '69'],
};
const CODE_BY_NAME = new Map(Object.entries(STATES).map(([code, [name]]) => [name, code]));
const CODE_BY_FIPS = new Map(Object.entries(STATES).map(([code, [, fips]]) => [fips, code]));

/** The two-letter code from what a Home's state column holds ("WA" or "Washington"), or ''. */
function stateCode(value) {
  const text = clean(value);
  if (STATES[text]) return text;
  return CODE_BY_NAME.get(text) || '';
}

/** A county FIPS code's state. */
const stateOfCounty = (fips) => CODE_BY_FIPS.get(String(fips).slice(0, 2)) || '';

module.exports = { parts, parse, sortKey, unitKey, zip5, city, stateCode, stateOfCounty };
