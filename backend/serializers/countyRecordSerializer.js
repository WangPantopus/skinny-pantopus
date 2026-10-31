'use strict';
// ============================================================
// COUNTY RECORD SERIALIZER — a home's ATTOM record as labeled rows.
//
// Property details shows a verified owner what ATTOM told us about their
// home: the /property/detail record kept for the Home, and ATTOM's value
// estimate when one is already cached. This turns that vendor JSON into
// sections of { label, value } rows that web, iOS and Android draw as
// they come, so the three apps show the same words.
//
// ATTOM spells keys both ways (livingsize / livingSize) and leaves out
// what it doesn't know, but it also sends 0 and "TYPE UNKNOWN" for facts
// the county never recorded: those rows are dropped. A key with no label
// here still shows under a readable name, so a field ATTOM adds later
// isn't lost. Only ATTOM's plumbing (match codes, geo-ID lists, internal
// codes, coordinates) stays out; the map shows where the home is.
// ============================================================

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// A record is vendor data (and, for older Homes, whatever the app sent at
// setup), so its size is bounded before it reaches a screen.
const MAX_TEXT = 300;
const MAX_ROWS = 80;
const MAX_DEPTH = 4;
// ATTOM's words for "not recorded".
const UNKNOWN = new Set(['', 'TYPE UNKNOWN', 'UNKNOWN', 'UNK', 'N/A', 'NA', 'NOT AVAILABLE']);
// Abbreviations that stay capitalized when ATTOM's capitals are lowered.
const ACRONYMS = new Set(['AC', 'HVAC', 'SFR', 'MFR', 'PUD', 'HOA', 'REO', 'LPG', 'PVC', 'II', 'III', 'IV']);

const SECTIONS = [
  ['building', 'Building'],
  ['construction', 'Construction'],
  ['utilities', 'Heating, cooling & utilities'],
  ['parking', 'Parking'],
  ['lot', 'Lot'],
  ['records', 'Parcel & records'],
  ['assessment', 'Assessment & taxes'],
  ['sale', 'Last sale'],
];

// [path, label, kind, group]. Rows sharing a label in one section are
// alternatives: the first one on file shows. Rows sharing a group show
// only when their values differ (ATTOM repeats one area under several
// names).
const FIELDS = {
  building: [
    ['summary.yearbuilt', 'Year built', 'year'],
    ['building.summary.yearbuilteffective', 'Effective year built', 'year'],
    ['building.size.livingsize', 'Living area', 'sqft', 'area'],
    ['building.size.bldgsize', 'Building area', 'sqft', 'area'],
    ['building.size.grosssize', 'Gross area', 'sqft', 'area'],
    ['building.size.grosssizeadjusted', 'Adjusted gross area', 'sqft', 'area'],
    ['building.size.universalsize', 'Standard area', 'sqft', 'area'],
    ['building.size.groundfloorsize', 'Ground floor area', 'sqft'],
    ['building.size.atticsize', 'Attic area', 'sqft'],
    ['building.summary.levels', 'Stories', 'count'],
    ['building.summary.storydesc', 'Story type', 'text'],
    ['building.rooms.roomstotal', 'Total rooms', 'count'],
    ['building.rooms.beds', 'Bedrooms', 'count'],
    ['building.rooms.bathstotal', 'Bathrooms', 'baths', 'baths'],
    ['building.rooms.bathscalc', 'Bathrooms (calculated)', 'baths', 'baths'],
    ['building.rooms.bathsfull', 'Full baths', 'count'],
    ['building.rooms.baths3qtr', 'Three-quarter baths', 'count'],
    ['building.rooms.bathshalf', 'Half baths', 'count'],
    ['building.rooms.baths1qtr', 'Quarter baths', 'count'],
    ['building.rooms.bathspartial', 'Partial baths', 'count'],
    ['building.rooms.bathfixtures', 'Bath fixtures', 'count'],
    ['building.interior.bsmttype', 'Basement', 'text'],
    ['building.interior.bsmtsize', 'Basement area', 'sqft'],
    ['building.interior.bsmtfinishedpercent', 'Basement finished', 'percent'],
    ['building.interior.fplccount', 'Fireplaces', 'count'],
    ['building.interior.fplcind', 'Fireplaces', 'flag'],
    ['building.interior.fplctype', 'Fireplace type', 'text'],
    ['building.summary.archstyle', 'Architectural style', 'text'],
    ['summary.archstyle', 'Architectural style', 'text'],
    ['building.summary.bldgtype', 'Building type', 'text'],
    ['building.summary.imprtype', 'Improvement type', 'text'],
    ['building.construction.condition', 'Condition', 'text'],
    ['building.summary.quality', 'Quality', 'text'],
    ['building.construction.quality', 'Quality', 'text'],
    ['building.summary.view', 'View', 'view', 'view'],
    ['area.loctype', 'Location', 'view', 'view'],
    ['building.summary.unitscount', 'Units', 'count'],
    ['building.summary.bldgsnum', 'Buildings on the parcel', 'count'],
    ['building.summary.mobilehome', 'Mobile home', 'flag'],
    ['building.summary.mobilehomeind', 'Mobile home', 'flag'],
  ],
  construction: [
    ['building.construction.constructiontype', 'Construction', 'text'],
    ['building.construction.frametype', 'Frame', 'text'],
    ['building.construction.foundationtype', 'Foundation', 'text'],
    ['building.construction.walltype', 'Exterior walls', 'text'],
    ['utilities.walltype', 'Exterior walls', 'text'],
    ['building.construction.roofcover', 'Roof cover', 'text'],
    ['building.construction.roofshape', 'Roof shape', 'text'],
  ],
  utilities: [
    ['utilities.heatingtype', 'Heating', 'text'],
    ['utilities.heatingfuel', 'Heating fuel', 'text'],
    ['utilities.coolingtype', 'Cooling', 'text'],
    ['utilities.energytype', 'Energy', 'text'],
    ['utilities.watertype', 'Water', 'text'],
    ['utilities.sewertype', 'Sewer', 'text'],
  ],
  parking: [
    ['building.parking.garagetype', 'Garage', 'text'],
    ['building.parking.prkgtype', 'Parking type', 'text'],
    ['building.parking.prkgspaces', 'Parking spaces', 'count'],
    ['building.parking.prkgsize', 'Parking area', 'sqft'],
  ],
  lot: [
    ['lot.lotsize1', 'Lot size', 'acres'],
    ['lot.lotsize2', 'Lot area', 'sqft'],
    ['lot.depth', 'Lot depth', 'feet'],
    ['lot.frontage', 'Lot frontage', 'feet'],
    ['lot.zoningtype', 'Zoning', 'text'],
    ['lot.sitezoningident', 'Zoning code', 'code'],
    ['lot.pooltype', 'Pool', 'text'],
    ['lot.poolind', 'Pool', 'flag'],
    ['lot.lotnum', 'Lot number', 'code'],
    ['area.blocknum', 'Block', 'code'],
  ],
  records: [
    ['identifier.apn', 'Parcel number (APN)', 'code', 'apn'],
    ['identifier.apnorig', 'Parcel number (county format)', 'code', 'apn'],
    ['area.countrysecsubd', 'County', 'name'],
    ['identifier.fips', 'County code (FIPS)', 'code'],
    ['area.munname', 'Municipality', 'name'],
    ['area.subdname', 'Subdivision', 'name'],
    ['area.taxcodearea', 'Tax code area', 'code'],
    ['area.censustractident', 'Census tract', 'code'],
    ['area.srvytownship', 'Survey township', 'code'],
    ['area.srvyrange', 'Survey range', 'code'],
    ['area.srvysection', 'Survey section', 'code'],
    ['summary.propertytype', 'Property type', 'text'],
    ['summary.proptype', 'Property type', 'text'],
    ['summary.propclass', 'Property class', 'text'],
    ['summary.propsubtype', 'Property subtype', 'text'],
    ['summary.proplanduse', 'Land use', 'text'],
    ['area.countyuse1', 'County use code', 'code'],
    ['summary.absenteeind', 'Occupancy', 'occupancy'],
    ['summary.legal1', 'Legal description', 'raw'],
    ['summary.reoflag', 'Bank-owned (REO)', 'flag'],
    ['summary.quitclaimflag', 'Last transfer by quitclaim deed', 'flag'],
    ['identifier.attomid', 'ATTOM ID', 'code'],
    ['identifier.id', 'ATTOM ID', 'code'],
    ['identifier.obpropid', 'ATTOM ID', 'code'],
  ],
  assessment: [
    ['assessment.assessed.assdttlvalue', 'Assessed value', 'money'],
    ['assessment.assessed.assdlandvalue', 'Assessed land value', 'money'],
    ['assessment.assessed.assdimprvalue', 'Assessed improvement value', 'money'],
    ['assessment.assessed.assdttlpersizeunit', 'Assessed value per sq ft', 'moneySqft'],
    ['assessment.assessed.assdlandpersizeunit', 'Assessed land value per sq ft', 'moneySqft'],
    ['assessment.assessed.assdimprpersizeunit', 'Assessed improvement value per sq ft', 'moneySqft'],
    ['assessment.market.mktttlvalue', 'County market value', 'money'],
    ['assessment.market.mktlandvalue', 'County market land value', 'money'],
    ['assessment.market.mktimprvalue', 'County market improvement value', 'money'],
    ['assessment.appraised.apprttlvalue', 'Appraised value', 'money'],
    ['assessment.appraised.apprlandvalue', 'Appraised land value', 'money'],
    ['assessment.appraised.apprimprvalue', 'Appraised improvement value', 'money'],
    ['assessment.tax.taxamt', 'Property tax', 'money'],
    ['assessment.tax.taxyear', 'Tax year', 'year'],
    ['assessment.tax.taxpersizeunit', 'Tax per sq ft', 'moneySqft'],
  ],
  sale: [
    ['sale.amount.saleamt', 'Sale price', 'money'],
    ['sale.saletransdate', 'Sale date', 'date'],
    ['sale.amount.salerecdate', 'Recorded', 'date'],
    ['sale.amount.saletranstype', 'Sale type', 'text'],
    ['sale.amount.saledocnum', 'Document number', 'code'],
    ['sale.calculation.pricepersizeunit', 'Price per sq ft', 'moneySqft'],
    ['sale.calculation.priceperbed', 'Price per bedroom', 'money'],
  ],
};

const VALUE_FIELDS = [
  ['avm.amount.value', 'Estimated value', 'money'],
  ['avm.amount.scr', 'Confidence score', 'score'],
  ['avm.calculations.persizeunit', 'Value per sq ft', 'moneySqft'],
  ['avm.condition.avmpoorvalue', 'Value in poor condition', 'money'],
  ['avm.condition.avmgoodvalue', 'Value in good condition', 'money'],
  ['avm.condition.avmexcellentvalue', 'Value in excellent condition', 'money'],
  ['avm.eventdate', 'Estimate date', 'date'],
];

// Read into rows of their own (address, ZIP+4) or kept out on purpose.
const HIDDEN = new Set([
  'address.country', 'address.countrysubd', 'address.line1', 'address.line2', 'address.locality',
  'address.matchcode', 'address.oneline', 'address.postal1', 'address.postal2', 'address.postal3',
  'summary.propindicator', 'area.muncode', 'building.size.sizeind', 'building.summary.viewcode',
  'sale.salesearchdate', 'sale.amount.saledisclosuretype',
]);
// Coordinates and geo IDs (the map shows where the home is); the record's
// dates go in the footer.
const HIDDEN_BLOCKS = new Set(['location', 'vintage']);
const BLOCK_SECTIONS = {
  identifier: 'records', area: 'records', address: 'records', summary: 'records',
  lot: 'lot', utilities: 'utilities', assessment: 'assessment', sale: 'sale',
};
const MONO = new Set(['sqft', 'acres', 'feet', 'count', 'year', 'baths', 'money', 'moneySqft', 'percent', 'score', 'code']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// ATTOM spells keys both ways, so a lowercase path finds either.
function child(node, key) {
  if (!isObject(node)) return undefined;
  if (Object.hasOwn(node, key)) return node[key];
  const found = Object.keys(node).find((name) => name.toLowerCase() === key);
  return found === undefined ? undefined : node[found];
}

function at(root, path) {
  return path.split('.').reduce((node, key) => child(node, key), root);
}

function cleanText(value) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  return UNKNOWN.has(text.toUpperCase()) ? null : text;
}

const keepAcronyms = (text) => text.replace(/\b[A-Za-z]+\b/g, (word) => (ACRONYMS.has(word.toUpperCase()) ? word.toUpperCase() : word));

// "COMPOSITION SHINGLE" → "Composition shingle", "CENTRAL AC" → "Central AC";
// words ATTOM already cased stay as they are.
function sentenceCase(text) {
  if (/[a-z]/.test(text)) return text;
  const lower = keepAcronyms(text.toLowerCase());
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// "WOODLAND MANOR PH II" → "Woodland Manor Ph II".
function titleCase(text) {
  if (/[a-z]/.test(text)) return text;
  return keepAcronyms(text.toLowerCase().replace(/(^|[\s\-/(.])([a-z])/g, (_, before, letter) => before + letter.toUpperCase()));
}

function positive(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const grouped = (n, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits });
const money = (n) => `$${grouped(n)}`;

// ATTOM dates are "2016-12-7" or ISO timestamps; a date alone needs no time zone.
function isoDate(value) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateLabel(value) {
  const iso = isoDate(value);
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function flag(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  const text = cleanText(value);
  if (!text) return null;
  if (['Y', 'YES', 'TRUE'].includes(text.toUpperCase())) return 'Yes';
  if (['N', 'NO', 'FALSE'].includes(text.toUpperCase())) return 'No';
  return sentenceCase(text);
}

function format(kind, value) {
  switch (kind) {
    case 'text': {
      if (typeof value === 'number') return positive(value) === null ? null : String(value);
      const text = cleanText(value);
      return text && sentenceCase(text);
    }
    case 'name': {
      const text = cleanText(value);
      return text && titleCase(text);
    }
    case 'raw':
      return cleanText(value);
    case 'view': {
      // "VIEW - NONE" → "None".
      const text = cleanText(value);
      const view = text && cleanText(text.replace(/^VIEW\s*-\s*/i, ''));
      return view && sentenceCase(view);
    }
    case 'occupancy': {
      // "ABSENTEE(MAIL AND SITUS NOT =)" → "Absentee".
      const text = cleanText(value);
      const occupancy = text && cleanText(text.replace(/\s*\(.*\)\s*$/, ''));
      return occupancy && sentenceCase(occupancy);
    }
    case 'code': {
      if (typeof value === 'number') return positive(value) === null ? null : String(value);
      const text = cleanText(value);
      return text && text !== '0' ? text : null;
    }
    case 'flag':
      return flag(value);
    case 'date':
      return dateLabel(value);
    default:
      break;
  }
  const n = positive(value);
  if (n === null) return null;
  switch (kind) {
    case 'sqft': return `${grouped(Math.round(n))} sq ft`;
    case 'acres': return `${grouped(n, 2)} ${n === 1 ? 'acre' : 'acres'}`;
    case 'feet': return `${grouped(Math.round(n))} ft`;
    case 'count': return grouped(Math.round(n));
    case 'year': return n >= 1000 && n <= 2200 ? String(Math.round(n)) : null;
    case 'baths': return grouped(n, 2);
    case 'money': return money(Math.round(n));
    case 'moneySqft': return `$${n >= 10 ? grouped(Math.round(n)) : grouped(n, 2)} per sq ft`;
    case 'percent': return `${grouped(n, 1)}%`;
    case 'score': return `${Math.round(n)} out of 100`;
    default: return null;
  }
}

// A field with no label of ours: booleans, numbers and text as they come.
function formatLoose(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return positive(value) === null ? null : String(value);
  if (Array.isArray(value)) {
    const parts = value.map((item) => (typeof item === 'object' ? null : formatLoose(item))).filter(Boolean);
    return parts.length ? parts.join(', ').slice(0, MAX_TEXT) : null;
  }
  const text = cleanText(value);
  return text && text !== '0' ? sentenceCase(text) : null;
}

// "censusBlockGroup" → "Census block group".
function humanize(key) {
  const words = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-.\s]+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 60);
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
}

class Section {
  constructor(id, title) {
    this.id = id;
    this.title = title;
    this.rows = [];
    this.groups = new Map();
    this.note = null;
  }

  add(id, label, value, mono, group) {
    if (!value || !label || this.rows.length >= MAX_ROWS) return false;
    if (this.rows.some((row) => row.label === label)) return false;
    if (group) {
      const shown = this.groups.get(group) || new Set();
      if (shown.has(value)) return false;
      shown.add(value);
      this.groups.set(group, shown);
    }
    this.rows.push({ id, label, value, mono });
    return true;
  }
}

function addFields(section, root, fields, used) {
  for (const [path, label, kind, group] of fields) {
    const raw = at(root, path);
    used.add(path);
    if (raw === undefined || raw === null) continue;
    section.add(path, label, format(kind, raw), MONO.has(kind), group);
  }
}

function leaves(node, path, depth, out) {
  for (const [key, value] of Object.entries(node)) {
    const next = [...path, key];
    if (isObject(value)) {
      if (depth < MAX_DEPTH) leaves(value, next, depth + 1, out);
    } else {
      out.push([next, value]);
    }
  }
  return out;
}

function propertyFrom(attomPayload) {
  if (!isObject(attomPayload)) return null;
  const first = attomPayload.full_response?.property?.[0];
  if (isObject(first)) return first;
  return isObject(attomPayload.property) ? attomPayload.property : null;
}

function recordSections(property) {
  const sections = new Map(SECTIONS.map(([id, title]) => [id, new Section(id, title)]));
  const used = new Set();

  // The address as the county has it, which can read differently from
  // the Home's ("4529 WINONA CT" for "4529 Winona Court").
  const address = cleanText(at(property, 'address.oneline'))
    || [at(property, 'address.line1'), at(property, 'address.line2')].map(cleanText).filter(Boolean).join(', ');
  sections.get('records').add('address.oneline', 'Address on record', address, false);
  const zip = format('code', at(property, 'address.postal1'));
  const plus4 = format('code', at(property, 'address.postal2'));
  if (zip && plus4) sections.get('records').add('address.zip4', 'ZIP+4', `${zip}-${plus4}`, true);

  for (const [id, fields] of Object.entries(FIELDS)) addFields(sections.get(id), property, fields, used);

  // Everything else ATTOM sent, under its own name.
  for (const [path, value] of leaves(property, [], 1, [])) {
    const lowered = path.map((key) => key.toLowerCase());
    const key = lowered.join('.');
    if (used.has(key) || HIDDEN.has(key) || HIDDEN_BLOCKS.has(lowered[0])) continue;
    // A block we have no section for gets its own, after ours.
    let id = BLOCK_SECTIONS[lowered[0]] || `block.${lowered[0]}`;
    let base = 1;
    if (path.length === 1) {
      id = 'records';
      base = 0;
    } else if (lowered[0] === 'building') {
      id = path.length > 2 ? { construction: 'construction', parking: 'parking' }[lowered[1]] || 'building' : 'building';
      base = path.length > 2 ? 2 : 1;
    }
    if (!sections.has(id)) sections.set(id, new Section(id, humanize(path[0])));
    const label = path.slice(base).map(humanize).filter(Boolean).join(' · ');
    sections.get(id).add(key, label, formatLoose(value), false);
  }

  return [...sections.values()];
}

function valueSection(avm) {
  const section = new Section('value', 'Value');
  if (!isObject(avm)) return section;
  const root = { avm };
  const [estimate, ...rest] = VALUE_FIELDS;
  addFields(section, root, [estimate], new Set());
  const low = positive(at(root, 'avm.amount.low'));
  const high = positive(at(root, 'avm.amount.high'));
  if (low && high && high >= low) section.add('avm.range', 'Estimate range', `${money(Math.round(low))} – ${money(Math.round(high))}`, true);
  addFields(section, root, rest.slice(0, 2), new Set());
  // Last month's change, when ATTOM measured one: "+$1,200 (+0.4%)".
  const change = Number(at(root, 'avm.calculations.monthlychgvalue'));
  const percent = Number(at(root, 'avm.calculations.monthlychgpct'));
  if (Number.isFinite(change) && change !== 0) {
    const sign = change > 0 ? '+' : '−';
    const share = Number.isFinite(percent) && percent !== 0 ? ` (${sign}${grouped(Math.abs(percent), 1)}%)` : '';
    section.add('avm.monthly', 'Change in the last month', `${sign}${money(Math.round(Math.abs(change)))}${share}`, true);
  }
  addFields(section, root, rest.slice(2), new Set());
  section.note = 'ATTOM’s automated estimate from public records and recent sales. It isn’t an appraisal.';
  return section;
}

/**
 * A verified owner's county record for Property details: the ATTOM
 * record kept for the Home and ATTOM's cached value estimate, as labeled
 * sections. Null when ATTOM told us nothing about this home.
 *
 * @param {object|null} attomPayload  The stored bundle ({ property, full_response, fetched_at })
 * @param {object|null} avm           /attomavm/detail property[0].avm, from the cache
 * @returns {{ sections: object[], footer: string|null, as_of: string|null }|null}
 */
function serializeCountyRecord(attomPayload, avm = null) {
  const property = propertyFrom(attomPayload);
  const sections = [...(property ? recordSections(property) : []), valueSection(avm)]
    .filter((section) => section.rows.length > 0)
    .map(({ id, title, rows, note }) => ({ id, title, rows, note }));
  if (!sections.length) return null;
  const asOf = property
    ? isoDate(at(property, 'vintage.lastmodified')) || isoDate(at(property, 'vintage.pubdate'))
      || isoDate(attomPayload.fetched_at)
    : null;
  let footer = null;
  if (property) footer = asOf ? `From county records via ATTOM · updated ${dateLabel(asOf)}` : 'From county records via ATTOM';
  return { sections, footer, as_of: asOf };
}

module.exports = { serializeCountyRecord };
