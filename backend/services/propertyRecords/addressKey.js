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
 *
 * Not every American address is a number on a street. parse() says which `form`
 * a line has: 'street', 'rural_route' (RR 2 BOX 152, HC 1 BOX 23), 'po_box',
 * 'military' (PSC 3 BOX 1234) or 'kilometer' (CARR 123 KM 5.2, in Puerto Rico).
 * A Puerto Rico line also carries its urbanizacion, which is part of the address:
 * the same number and street exist in several urbanizaciones of one ZIP.
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
  BSMT: 'BSMT', BASEMENT: 'BSMT', FRNT: 'FRNT', FRONT: 'FRNT', LOWR: 'LOWR', LOWER: 'LOWR', DOWNSTAIRS: 'LOWR', UPPR: 'UPPR', UPPER: 'UPPR', UPSTAIRS: 'UPPR',
  REAR: 'REAR', SIDE: 'SIDE', LBBY: 'LBBY', LOBBY: 'LBBY', PH: 'PH', PENTHOUSE: 'PH', OFC: 'OFC', OFFICE: 'OFC',
  // Puerto Rico.
  APTO: 'APT', APARTAMENTO: 'APT', EDIF: 'BLDG', EDIFICIO: 'BLDG', TORRE: 'BLDG', PISO: 'FL', LOCAL: 'STE', OFIC: 'OFC', OFICINA: 'OFC',
}));
// Words that are a whole secondary with no number after them.
const BARE_UNIT_WORDS = new Set(['BSMT', 'FRNT', 'LOWR', 'UPPR', 'REAR', 'SIDE', 'LBBY', 'PH', 'OFC']);

// Roads whose number belongs to their name, so what follows the type is not a unit: HIGHWAY 99, ROUTE 9.
const ROAD_TYPES = new Set(['HWY', 'RTE', 'EXPY', 'FWY', 'TPKE', 'BYP', 'SKWY', 'MTWY', 'PIKE']);
// COUNTY RD 12, TOWNSHIP RD 12: the same for an ordinary street type after one of these.
const NUMBERED_ROADS = new Set(['COUNTY', 'CO', 'CNTY', 'CR', 'STATE', 'TOWNSHIP', 'TWP', 'FOREST', 'FS', 'FARM', 'RANCH', 'BIA', 'INDIAN', 'NAVAJO', 'US', 'PR', 'PARISH', 'PRIVATE', 'PVT']);
const ORDINAL_WORDS = new Map(['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH', 'ELEVENTH', 'TWELFTH', 'THIRTEENTH',
  'FOURTEENTH', 'FIFTEENTH', 'SIXTEENTH', 'SEVENTEENTH', 'EIGHTEENTH', 'NINETEENTH', 'TWENTIETH'].map((word, i) => [word, String(i + 1)]));

// Words a county may spell out or not at the start of a street name.
const NAME_STARTS = new Map(Object.entries({ ST: 'SAINT', STE: 'SAINTE', MT: 'MOUNT', FT: 'FORT', AVENUE: 'AVE', AVENIDA: 'AVE', CARRETERA: 'CARR', BULEVAR: 'BLVD' }));
// The same road under different words: "HWY 99", "HIGHWAY 99", "STATE HIGHWAY 99".
const ROAD_NAMES = [
  [/^(STATE|ST)\s+(HIGHWAY|ROUTE|RTE|RT|RD|ROAD)\s+/, 'SR '],
  [/^SR\s+/, 'SR '],
  [/^(US|U S|US HIGHWAY|U S HIGHWAY|US ROUTE|US RTE)\s+(?=\d)/, 'US '],
  [/^(COUNTY|CNTY|CO)\s+(HIGHWAY|ROAD|RD|ROUTE|RTE)\s+/, 'CR '],
  [/^CR\s+/, 'CR '],
  [/^(FARM TO MKT|FARM TO MARKET|FARM RD|FM RD)\s+(?=\d)/, 'FM '],
  [/^RNCH RD\s+(?=\d)/, 'RR RD '],
  [/^(RURAL ROUTE|RURAL RTE|RFD|R F D|R R)\s*(?=\d)/, 'RR '],
  [/^(HIGHWAY CONTRACT ROUTE|HIGHWAY CONTRACT|HCR|H C R|STAR ROUTE)\s*(?=\d)/, 'HC '],
  [/^(INTERSTATE|IH)\s+(?=\d)/, 'I '],
  [/^(RTE|RT|ROUTE)\s+(?=\d)/, 'ROUTE '],
  [/^(DR )?(MARTIN LUTHER KING|MARTIN L KING|M L KING|MLK)( JR| JUNIOR)?$/, 'MLK'],
];

/**
 * Upper case without marks or punctuation: "Muñoz", "Ka'ahumanu" and "N.E." read as MUNOZ, KAAHUMANU and NE, the way
 * most publishers write them. A dot between digits stays: 1.5 MILE is not 15 MILE.
 */
function clean(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/['`‘’ʻ"]/g, '')
    .replace(/(?<!\d)\.|\.(?!\d)/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Numbered streets compare without their ordinals: "45TH", "45" and "FORTY" don't all, but "1ST" and "FIRST" do. */
function nameWord(word) {
  const ordinal = /^(\d+)(ST|ND|RD|TH)$/.exec(word);
  if (ordinal) return ordinal[1];
  if (ORDINAL_WORDS.has(word)) return ORDINAL_WORDS.get(word);
  return word === 'HWY' ? 'HIGHWAY' : word;
}

function normalName(words) {
  // A street type inside the name reads one way too: MOUNTAIN VIEW and MTN VW are one street.
  let name = words.flatMap((word) => word.split('-').filter(Boolean)).map((word, i, all) => {
    const read = nameWord(word);
    if (i === 0 && (all.length === 1 || NAME_STARTS.has(read))) return read;
    return SUFFIXES.has(read) && read !== 'HIGHWAY' ? SUFFIXES.get(read) : read;
  }).join(' ');
  for (const [pattern, replacement] of ROAD_NAMES) {
    if (pattern.test(name)) {
      name = name.replace(pattern, replacement);
      break;
    }
  }
  const [first, ...rest] = name.split(' ');
  return rest.length && NAME_STARTS.has(first) ? [NAME_STARTS.get(first), ...rest].join(' ') : name;
}

/**
 * The characters that tell one unit from another: "#4-B", "APT 4 B" and "4b" are one unit; 012 stays 012. A floor stays
 * a floor (FL2), so the second floor of a two-flat doesn't read as apartment 2.
 */
function unitKey(unit) {
  const text = clean(unit).replace(/#/g, ' ').trim();
  let words = text.split(' ').filter(Boolean);
  const ordinalFloor = words.length === 2 && UNIT_WORDS.get(words[1]) === 'FL' ? nameWord(words[0]) : null;
  if (ordinalFloor) return `FL${ordinalFloor}`;
  const isFloor = words.length > 1 && UNIT_WORDS.get(words[0]) === 'FL';
  while (words.length > 1 && (UNIT_WORDS.has(words[0]) || words[0] === 'NO' || words[0] === 'NUM' || words[0] === 'NUMBER')) words.shift();
  if (words.length === 1 && UNIT_WORDS.has(words[0])) {
    const word = UNIT_WORDS.get(words[0]);
    return BARE_UNIT_WORDS.has(word) ? word : '';
  }
  words = words.join('').replace(/[^A-Z0-9/]/g, '');
  return isFloor && words ? `FL${nameWord(words)}` : words;
}

/** A house number as one word: "123-45" and "12345" are one number in Queens and Hawaii; "123-A" and "123A" too. */
function houseNumber(text) {
  return clean(text).replace(/\s+/g, '').replace(/(?<=\d)-(?=[\dA-Z])/g, '');
}

/** A house number's sort position: the leading digits padded, so numbers sort numerically; then the rest ("12A", "121/2"). */
function numberSort(number) {
  const match = /^(\d+)(.*)$/.exec(number || '');
  return match ? `${match[1].padStart(9, '0')}${match[2]}` : `~${number || ''}`;
}

/**
 * A street's words into direction, name and type, wherever they sit. A word only counts as a direction or a type while
 * something is left to be the name: WEST ST is a street called West, AVENUE B one called Avenue B.
 */
function readStreet(streetWords) {
  const words = [...streetWords];
  let pre = '';
  let post = '';
  let suffix = '';
  const isName = (word) => !SUFFIXES.has(word) && !DIRECTIONS.has(word);
  // AVENUE N and E AVENUE K are streets called Avenue; PARK AVE S is Park Avenue South.
  const lettered = words.length > 1 && SUFFIXES.has(words[words.length - 2]) && words.slice(0, -2).every((word) => DIRECTIONS.has(word));
  if (words.length > 1 && DIRECTIONS.has(words[words.length - 1]) && !lettered) post = DIRECTIONS.get(words.pop());
  if (words.length > 1 && SUFFIXES.has(words[words.length - 1])) suffix = SUFFIXES.get(words.pop());
  if (words.length > 1 && DIRECTIONS.has(words[0]) && (suffix || post || words.length > 2 || words.slice(1).some(isName))) pre = DIRECTIONS.get(words.shift());
  return { pre, name: normalName(words), suffix, post };
}

/**
 * A street line's parts from what a county's columns say. Direction and type
 * are read wherever the county put them; empty columns stay empty.
 */
function parts({ number, numberSuffix = '', pre = '', name = '', suffix = '', post = '', unit = '', building = '', urbanization = '' }) {
  const read = readStreet(clean(name).split(' ').filter(Boolean));
  const street = read.name;
  const house = `${houseNumber(number)}${houseNumber(numberSuffix)}`;
  if (!house || !street) return null;
  const secondary = splitSecondary(clean(unit));
  return {
    number: house,
    pre: DIRECTIONS.get(clean(pre)) || read.pre,
    name: street,
    suffix: SUFFIXES.get(clean(suffix)) || read.suffix,
    post: DIRECTIONS.get(clean(post)) || read.post,
    unit: unitKey(secondary.unit),
    building: unitKey(building) || unitKey(secondary.building),
    ...(clean(urbanization) ? { urbanization: clean(urbanization) } : {}),
  };
}

/** A secondary's text into its building and its unit: "BLDG 2 UNIT 12", "12 BLDG 2", "EDIF 5 APT 20". */
function splitSecondary(text) {
  const words = text.split(' ').filter(Boolean);
  const at = words.findIndex((word) => UNIT_WORDS.get(word) === 'BLDG');
  if (at < 0 || at + 1 >= words.length) return { unit: text, building: '' };
  return { unit: [...words.slice(0, at), ...words.slice(at + 2)].join(' '), building: words[at + 1] };
}

/**
 * Where a street line's secondary starts, or -1. tokens[0] is the house number, and a street name has to stay in front
 * of it, so 123 FRONT ST and 123 KEY WEST AVE keep their names.
 */
function secondaryStart(tokens) {
  for (let i = 2; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith('#')) return i;
    if (!UNIT_WORDS.has(token) || !tokens.slice(1, i).some((word) => !DIRECTIONS.has(word))) continue;
    const next = tokens[i + 1];
    const followed = next && !SUFFIXES.has(next.replace(/^#/, ''));
    if (BARE_UNIT_WORDS.has(UNIT_WORDS.get(token))) {
      // FRONT, REAR, UPPER at the end of a line that already has its street type; PH 12 with a number.
      if (i === tokens.length - 1 ? SUFFIXES.has(tokens[i - 1]) || DIRECTIONS.has(tokens[i - 1]) || /\d/.test(tokens[i - 1]) : followed && /\d/.test(next)) return i;
    } else if (followed && (/\d/.test(next) || next.replace(/^#/, '').length <= 3)) return i;
    // 123 EXAMPLE ST APT, with the number left off: nothing to keep, and not part of the street.
    else if (i === tokens.length - 1 && (SUFFIXES.has(tokens[i - 1]) || DIRECTIONS.has(tokens[i - 1]) || /\d/.test(tokens[i - 1]))) return i;
  }
  // 123 MAIN ST 4B: something unit-like right after the street type. HIGHWAY 99 keeps its number.
  const last = tokens[tokens.length - 1];
  const before = tokens[tokens.length - 2];
  const named = tokens.slice(1, -2);
  if (tokens.length >= 4 && SUFFIXES.has(before) && !ROAD_TYPES.has(SUFFIXES.get(before)) && !DIRECTIONS.has(last) && !SUFFIXES.has(last)
    && (/\d/.test(last) || last.length === 1) && named.some((word) => !DIRECTIONS.has(word)) && !NUMBERED_ROADS.has(named[named.length - 1])) return tokens.length - 1;
  return -1;
}

const URBANIZATION_START = /^(?:URB|URBANIZACION)\s+(.+)$/;
const URBANIZATION_AFTER = /^(.+?)\s+(?:URB|URBANIZACION)\s+(.+)$/;
// Spanish order, number last: CALLE 4 #123, AVE PONCE DE LEON 1500.
const SPANISH_LAST = /^((?:CALLE|AVE|AVENIDA|BLVD|BULEVAR|PASEO|CAMINO|VIA)\s+.+?)\s+(?:#\s*|NUM\s+|NO\s+)?(\d+[A-Z]?)$/;
// A block and a lot, or a lettered house: A1, A-1, D 14, BLQ 5 12.
const LETTERED_HOUSE = /^(?:BLOQUE\s+|BLQ\s+)?([A-Z]{1,2})-?\s?(\d+[A-Z]?)\s+(.+)$/;
const BLOCK_HOUSE = /^(?:BLOQUE|BLQ)\s+(\d+)\s*[-#]?\s*(\d+[A-Z]?)\s+(.+)$/;
// A road and its kilometer: CARR 123 KM 5.2, CARR 123 KM 5 HM 2.
const KILOMETER = /^((?:CARR|CARRETERA|RD|ROUTE|PR)\s*-?\s*\d+[A-Z]?(?:\s+R\d+)?)\s+(?:KM|K)\s*([\d.]+)(?:\s+(?:HM|H)\s*(\d+))?$/;
// The house number and any half: "123", "123 1/2", "123A", "12-34"; Wisconsin's grid: "N89W16785".
const HOUSE = /^(\d+[A-Z]?(?:-\d+[A-Z]?)?|[NSEW]\d+\s?[NSEW]\d+)(?:\s+(\d\/\d))?\s+(.+)$/;
const POST_OFFICE_BOX = /^(?:P ?O ?BOX|POST OFFICE BOX|POB|BOX|APARTADO|APDO)\s*#?\s*([A-Z0-9-]+)$/;
const ROUTE_BOX = /^((?:RR|R R|RURAL ROUTE|RURAL RTE|RFD|R F D|RT|RTE|ROUTE|HC|HCR|H C R|HIGHWAY CONTRACT ROUTE|HIGHWAY CONTRACT|STAR ROUTE))\s*(\d+)\s+(?:BOX|BX)\s*#?\s*([A-Z0-9-]+(?:\s[A-Z])?)$/;
// PSC 3 BOX 1234, CMR 450 BOX 123, UNIT 2050 BOX 4190, OMC 1 BOX 3.
const MILITARY = /^(PSC|CMR|OMC|UMR|UNIT)\s*#?\s*(\d+[A-Z]?)\s+BOX\s*#?\s*([A-Z0-9-]+)$/;
const MILITARY_SHIP = /^(?:USS|USNS|USCGC)\s+(.+)$/;
const MILITARY_STATES = new Set(['AA', 'AE', 'AP']);

const empty = { pre: '', suffix: '', post: '', building: '' };

/** The lines with no house on a street. */
function postalForm(text, state) {
  const box = POST_OFFICE_BOX.exec(text);
  if (box) return { form: 'po_box', ...empty, number: houseNumber(box[1]), name: 'PO BOX', unit: '' };
  const military = MILITARY.exec(text);
  if (military) return { form: 'military', ...empty, number: houseNumber(military[3]), name: `${military[1]} ${military[2]}`, unit: '' };
  const ship = MILITARY_SHIP.exec(text);
  if (ship && MILITARY_STATES.has(state)) return { form: 'military', ...empty, number: '0', name: text, unit: '' };
  const route = ROUTE_BOX.exec(text);
  if (route) {
    const contract = /^(HC|HCR|H C R|HIGHWAY|STAR)/.test(route[1]);
    return { form: 'rural_route', ...empty, number: houseNumber(route[3]), name: `${contract ? 'HC' : 'RR'} ${route[2]}`, unit: '' };
  }
  const road = KILOMETER.exec(text);
  if (road) {
    return { form: 'kilometer', ...empty, number: `KM${road[2]}${road[3] ? `.${road[3]}` : ''}`, name: normalName(road[1].replace(/-/g, ' ').split(' ').filter(Boolean)), unit: '' };
  }
  return null;
}

/** Takes the urbanizacion out of a line's comma-separated pieces and the person's second line. */
function takeUrbanization(pieces, unit) {
  let urbanization = '';
  let secondary = unit;
  const street = [];
  const start = URBANIZATION_START.exec(secondary);
  if (start) {
    urbanization = start[1];
    secondary = '';
  }
  for (const piece of pieces) {
    const lead = URBANIZATION_START.exec(piece);
    const after = !lead && URBANIZATION_AFTER.exec(piece);
    if (lead) {
      // URB LAS GLADIOLAS 150 CALLE A: the name runs up to the house.
      const words = lead[1].split(' ');
      const at = words.findIndex((word, i) => i > 0 && /^[A-Z]{0,2}-?\d/.test(word));
      urbanization ||= (at > 0 ? words.slice(0, at) : words).join(' ');
      if (at > 0) street.push(words.slice(at).join(' '));
    } else if (after) {
      urbanization ||= after[2];
      street.push(after[1]);
    } else street.push(piece);
  }
  return { urbanization, secondary, text: street[0] || '' };
}

/**
 * A person's street line read into the same parts. `unit` is what the person's
 * address holds apart from the line (Home.address2, HomeAddress.address_line2_norm).
 * Null when the line can't be read as any form of address.
 * @param {string} line
 * @param {string} [unit]
 * @param {object} [where]  { state, zip }: Puerto Rico's lettered houses and Spanish word order are only read there
 */
function parse(line, unit = '', { state = '', zip = '' } = {}) {
  const code = stateCode(state);
  const pieces = String(line ?? '').split(',').map(clean).filter(Boolean);
  const { urbanization, secondary: given, text: taken } = takeUrbanization(pieces, clean(unit));
  const urb = urbanization ? { urbanization } : {};
  const postal = postalForm(taken, code);
  if (postal) return { ...postal, ...urb, unit: unitKey(given) };

  const inPuertoRico = code === 'PR' || /^00[679]/.test(String(zip ?? '')) || Boolean(urbanization);
  let text = taken;
  let secondary = given;
  // APT 4B 123 MAIN ST.
  const leading = /^(\S+)\s+(#?[A-Z0-9/-]+)\s+(\d.*)$/.exec(text);
  if (leading && UNIT_WORDS.has(leading[1]) && !BARE_UNIT_WORDS.has(UNIT_WORDS.get(leading[1]))) {
    text = leading[3];
    if (!secondary) secondary = `${leading[1]} ${leading[2]}`;
  }
  let house = HOUSE.exec(text);
  if (!house && inPuertoRico) {
    const spanish = SPANISH_LAST.exec(text);
    const lettered = LETTERED_HOUSE.exec(text);
    const block = BLOCK_HOUSE.exec(text);
    if (spanish) house = [text, spanish[2], '', spanish[1]];
    else if (block) house = [text, `${block[1]}-${block[2]}`, '', block[3]];
    else if (lettered) house = [text, `${lettered[1]}${lettered[2]}`, '', lettered[3]];
  }
  if (!house) return null;
  const tokens = [house[1], ...house[3].split(' ').filter(Boolean)];
  const at = secondaryStart(tokens);
  const streetWords = at < 0 ? tokens.slice(1) : tokens.slice(1, at);
  if (at >= 0 && !secondary) secondary = tokens.slice(at).join(' ');
  if (!streetWords.length) return null;
  const { unit: unitText, building } = splitSecondary(secondary);
  return {
    form: 'street',
    number: `${houseNumber(house[1])}${house[2] || ''}`,
    ...readStreet(streetWords),
    unit: unitKey(unitText),
    building: unitKey(building),
    ...urb,
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
// Armed Forces mail has state codes and no county.
const MILITARY_NAMES = { AA: 'ARMED FORCES AMERICAS', AE: 'ARMED FORCES EUROPE', AP: 'ARMED FORCES PACIFIC' };
const CODE_BY_NAME = new Map(Object.entries(STATES).map(([code, [name]]) => [name, code]));
const CODE_BY_FIPS = new Map(Object.entries(STATES).map(([code, [, fips]]) => [fips, code]));

/** The two-letter code from what a Home's state column holds ("WA" or "Washington"), or ''. */
function stateCode(value) {
  const text = clean(value);
  if (STATES[text] || MILITARY_NAMES[text]) return text;
  return CODE_BY_NAME.get(text) || Object.keys(MILITARY_NAMES).find((code) => MILITARY_NAMES[code] === text) || '';
}

/** A county FIPS code's state. */
const stateOfCounty = (fips) => CODE_BY_FIPS.get(String(fips).slice(0, 2)) || '';

module.exports = { parts, parse, sortKey, unitKey, houseNumber, zip5, city, stateCode, stateOfCounty };
