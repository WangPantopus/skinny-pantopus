'use strict';

/**
 * Facts a household's own report states about its home, found by rules in the report's text (pdfText.js). Nothing
 * is guessed: a fact is suggested only where the report says it in words these rules know, and the household checks
 * every one before anything is saved (services/householdDocuments/index.js).
 *
 *   - A system's year comes from a year the report states, or from an age it states ("about 8 years old") counted
 *     back from the report's own date. A report without a date gives no year from an age, and a range ("10-15
 *     years") gives none.
 *   - A described fact (roof, walls, heating) becomes one of the words the household's editor offers only when the
 *     report's words point to exactly one of them.
 *   - Bedrooms, baths and size are read from labeled lines ("Bedrooms: 4"); "4 Bedrooms" counts only in an appraisal
 *     or a listing sheet, whose subject comes before any other home. An inspection report's two different answers
 *     for one fact give no answer.
 *   - Only a report that names this home's street address is used at all.
 */

const KINDS = {
  appraisal: { title: 'Appraisal', source: 'your appraisal' },
  inspection: { title: 'Inspection report', source: 'your inspection report' },
  listing: { title: 'Listing sheet', source: 'your listing sheet' },
  document: { title: 'Document', source: 'your document' },
};

const SYSTEMS = {
  roof: { label: 'Roof installed', subject: /\broof(?:ing)?\b/i, missing: 'roof age' },
  hvac: { label: 'Heating & cooling installed', subject: /\b(?:furnace|heating|heat pump|hvac|air handler|boiler)\b/i, missing: 'furnace year' },
  water_heater: { label: 'Water heater installed', subject: /\b(?:water heater|hot water (?:heater|tank))\b/i, missing: 'water heater year' },
  electrical_panel: { label: 'Electrical panel installed', subject: /\b(?:(?:main |electrical |service |breaker |distribution )panel|load center|panel ?box|service equipment)\b/i, missing: null },
};
const SUBJECTS = Object.values(SYSTEMS).map((system) => system.subject);

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DATE = String.raw`(\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2})|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})`;
const DATE_LABELS = {
  inspection: [String.raw`(?:inspection date|date of inspection|date inspected|inspected on|inspection performed)`],
  appraisal: [String.raw`effective date of (?:the )?appraisal`, String.raw`date of (?:the )?(?:appraisal|report|inspection)`],
  listing: [String.raw`(?:list(?:ing)? date|date listed|on market date)`],
  document: [],
};
const ANY_DATE_LABEL = String.raw`(?:report date|date of report|date)`;

const AGE_YEARS = 80;
const STANDARD_AMPS = new Set([60, 100, 125, 150, 200, 225, 250, 300, 320, 400]);

// Words a report uses, to the words the household's editor offers (householdFacts.js CATALOG). Earlier words win when
// a report names two (a heat pump is also forced air).
const WORDS = {
  roof_cover: [
    ['Composition shingle', /asphalt|composition|\bcomp\b|fib(?:er|re)glass|architectural|3[- ]tab|laminated|dimensional/i],
    ['Metal', /metal|steel|standing seam|alumin(?:um|ium)/i],
    ['Tile', /\btiles?\b|clay|concrete tile/i],
    ['Wood shake', /shake|wood shingle|cedar shingle/i],
    ['Membrane', /membrane|\btpo\b|epdm|built[- ]up|modified bitumen|rolled roofing|roll roofing|torch[- ]down/i],
    ['Slate', /slate/i],
  ],
  exterior_walls: [
    ['Vinyl siding', /vinyl/i],
    ['Fiber cement', /fib(?:er|re) cement|hardi|cement board|cementitious/i],
    ['Brick', /brick/i],
    ['Stucco', /stucco/i],
    ['Stone', /\bstone\b/i],
    ['Wood siding', /\bwood\b|cedar|t1-11|lp smart|engineered wood|board and batten/i],
  ],
  foundation: [
    ['Slab', /slab/i],
    ['Crawl space', /crawl/i],
    ['Basement', /basement/i],
    ['Pier and beam', /pier|post and beam/i],
  ],
  heating: [
    ['Heat pump', /heat pump/i],
    ['Forced air', /forced[- ]air|\bfwa\b|furnace/i],
    ['Baseboard', /baseboard|\bhwbb\b/i],
    ['Radiant', /radiant|boiler|hydronic|radiator|hot water heat/i],
    ['Wall heater', /wall (?:heater|furnace|unit)|cadet/i],
  ],
  heating_fuel: [
    ['Natural gas', /natural gas|\bgas\b|\bng\b/i],
    ['Electric', /electric/i],
    ['Oil', /\boil\b/i],
    ['Propane', /propane|\blp\b|\blpg\b/i],
    ['Wood', /\bwood\b/i],
  ],
  cooling: [
    ['Heat pump', /heat pump/i],
    ['Mini-split', /mini[- ]?split|ductless/i],
    ['Central air', /central/i],
    ['Window units', /window/i],
    ['None', /^\s*none\b/i],
  ],
  water_source: [
    ['Public', /public|municipal|city|community|utility/i],
    ['Well', /\bwell\b|private/i],
  ],
  sewer: [
    ['Public', /public|municipal|city|community|utility/i],
    ['Septic', /septic|private/i],
  ],
  garage: [
    ['Attached', /attached|built[- ]in/i],
    ['Detached', /detached/i],
    ['Carport', /carport/i],
    ['None', /^\s*none\b/i],
  ],
  pool: [
    ['In-ground', /in[- ]?ground/i],
    ['Above-ground', /above[- ]?ground/i],
    ['None', /^\s*none\b/i],
  ],
  plumbing: [
    ['Copper', /copper/i],
    ['PEX', /\bpex\b/i],
    ['CPVC', /\bcpvc\b/i],
    ['Galvanized steel', /galvani[sz]ed/i],
    ['Polybutylene', /polybutylene|\bpoly-b\b|\bpb\b/i],
  ],
};

// A described fact's label, and the words after it ("Roof Covering: Asphalt shingle"). The value runs to the end of
// its piece of the line.
const LABELS = {
  roof_cover: /\broof(?:ing)?(?:\s*(?:covering|cover|material|surface|type)s?\b\s*[:\-–]?|\s*:)\s*(.+)/i,
  exterior_walls: /\b(?:(?:exterior walls?|siding(?: material)?|wall cladding|exterior (?:finish|covering|wall covering))\b\s*[:\-–]?|exterior\s*:)\s*(.+)/i,
  foundation: /\bfoundation(?: type)?\b\s*[:\-–]?\s*(.+)/i,
  heating: /\b(?:heating(?: type| system| method| equipment)?|heat(?:ing)? source|type of heat|heat type)\b\s*[:\-–]\s*(.+)/i,
  heating_fuel: /\b(?:heating fuel|fuel(?: type| source)?|energy source)\b\s*[:\-–]?\s*(.+)/i,
  cooling: /\b(?:cooling(?: type| system| method| equipment)?|air conditioning(?: type)?|a\/c(?: type)?)\b\s*[:\-–]\s*(.+)/i,
  water_source: /\b(?:water source|water supply(?! (?:material|pipe|piping|line))|water service|domestic water(?: source)?|water)\s*[:\-–]\s*(.+)/i,
  sewer: /\b(?:sewer|sewage|waste disposal|sewage disposal)(?: type| system)?\b\s*[:\-–]\s*(.+)/i,
  garage: /\b(?:garage(?: type)?|car storage|parking(?: type)?)\b\s*[:\-–]\s*(.+)/i,
  pool: /\bpool(?: type)?\b\s*[:\-–]\s*(.+)/i,
  plumbing: /\b(?:(?:water )?(?:supply|distribution)(?: pipe| piping| lines?)?(?: material| type)?|plumbing (?:supply|material|piping|pipes?)(?: material| type)?|water (?:pipes?|lines?|piping)(?: material| type)?|supply piping)\b\s*[:\-–]\s*(.+)/i,
};
// Where a fuel or a system belongs: a fuel read under the water heater isn't the heating's.
const UNDER = { heating_fuel: 'hvac' };

const clean = (text) => text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const number = (text) => Number(String(text).replace(/,/g, ''));

/** The line's pieces split where a wide gap separates them: two label and value pairs side by side read apart. */
function segmentsOf(pieces) {
  const segments = [];
  let current = [];
  let end = null;
  for (const piece of pieces) {
    if (end !== null && piece.x - end > 24) {
      segments.push(current.join(' '));
      current = [];
    }
    current.push(piece.text);
    end = piece.end;
  }
  if (current.length) segments.push(current.join(' '));
  return segments.map(clean).filter(Boolean);
}

function linesOf(pages) {
  const lines = [];
  pages.forEach((page, index) => {
    for (const pieces of page) {
      const text = clean(pieces.map((piece) => piece.text).join(' '));
      if (text) lines.push({ page: index + 1, text, segments: segmentsOf(pieces) });
    }
  });
  return lines;
}

function kindOf(text) {
  const head = text.slice(0, 20000);
  if (/uniform residential appraisal report|individual condominium unit appraisal|residential appraisal report|appraisal report/i.test(head)) return 'appraisal';
  if (/home inspection|inspection report|property inspection|inspection agreement|home inspector|inspected by/i.test(head)) return 'inspection';
  if (/\bmls\s*(?:#|no\.?|number|id)|\blist(?:ing)? price\b|\blisting (?:id|number|agent|office)\b/i.test(head)) return 'listing';
  return 'document';
}

function parseDate(raw, today) {
  const text = raw.toLowerCase().replace(/(\d)(st|nd|rd|th)/, '$1');
  let year;
  let month;
  let day;
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) [, year, month, day] = match.map(Number);
  else if ((match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/))) {
    [, month, day, year] = match.map(Number);
    if (year < 100) year += 2000;
  } else if ((match = text.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/))) {
    month = MONTHS.findIndex((name) => name.startsWith(match[1].slice(0, 3))) + 1;
    day = Number(match[2]);
    year = Number(match[3]);
  } else return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime()) || date.getUTCMonth() !== month - 1 || year < 1950 || date > today) return null;
  return date.toISOString().slice(0, 10);
}

function reportDate(lines, kind, today) {
  const labels = [...DATE_LABELS[kind], ...DATE_LABELS.inspection, ...DATE_LABELS.appraisal];
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:\\-–]?\\s*(?:\\w+day,?\\s*)?${DATE}`, 'i');
    for (const line of lines) {
      const match = line.text.match(pattern);
      const day = match && parseDate(match[1], today);
      if (day) return day;
    }
  }
  const pattern = new RegExp(`\\b${ANY_DATE_LABEL}\\s*[:\\-–]\\s*${DATE}`, 'i');
  for (const line of lines.filter((candidate) => candidate.page === 1)) {
    const match = line.text.match(pattern);
    const day = match && parseDate(match[1], today);
    if (day) return day;
  }
  return null;
}

const STREET_WORDS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest',
  'st', 'street', 'ave', 'avenue', 'rd', 'road', 'dr', 'drive', 'ln', 'lane', 'ct', 'court', 'blvd', 'boulevard', 'way', 'pl', 'place', 'cir', 'circle',
  'ter', 'terrace', 'pkwy', 'parkway', 'hwy', 'highway', 'loop', 'trl', 'trail', 'apt', 'unit', 'ste', 'suite']);
const words = (text) => text.toLowerCase().replace(/[^a-z0-9#]+/g, ' ').trim().split(' ').filter(Boolean);

/** Whether the report names this home's street address: its house number, then its street's name. */
function namesAddress(text, address) {
  const parts = words(String(address || '').split(',')[0]);
  const house = parts[0];
  if (!house || !/^\d+[a-z]?$/.test(house)) return false;
  const street = parts.slice(1).find((word) => !STREET_WORDS.has(word) && !word.startsWith('#'));
  if (!street) return false;
  const all = words(text);
  for (let i = 0; i < all.length; i += 1) {
    if (all[i] !== house) continue;
    if (all.slice(i + 1, i + 4).some((word) => word === street || (street.length > 3 && word.startsWith(street)))) return true;
  }
  return false;
}

/** The first answer, or none when an inspection report gives two different ones. */
function settle(found, kind) {
  if (!found.length) return null;
  if (kind === 'inspection' || kind === 'document') {
    const values = new Set(found.map((item) => JSON.stringify(item.value)));
    if (values.size > 1) return null;
  }
  return found[0];
}

function quoteOf(line, index = 0) {
  const text = line.text;
  if (text.length <= 100) return text;
  const start = Math.max(0, Math.min(index - 30, text.length - 100));
  return `${start ? '…' : ''}${text.slice(start, start + 100).trim()}…`;
}

// Two words where one is the narrower: a heat pump blows forced air, and it is a central system.
const NARROWER = { heating: [['Heat pump', 'Forced air']], cooling: [['Heat pump', 'Central air']] };

/**
 * The one editor word the report's words point to. None, or two that aren't a narrower pair, give null: a form
 * that prints every choice ("[ ] Public [ ] Private") says nothing these rules can read.
 */
function wordFor(key, text) {
  const hits = WORDS[key].filter(([, pattern]) => pattern.test(text)).map(([word]) => word);
  if (hits.length === 1) return hits[0];
  const pair = hits.length === 2 && (NARROWER[key] || []).find(([narrow, wide]) => hits.includes(narrow) && hits.includes(wide));
  return pair ? pair[0] : null;
}

/** Each line's nearest system above it, within a few lines, for facts that belong under one. */
function systemsAbove(lines) {
  let current = null;
  let since = 0;
  return lines.map((line) => {
    const named = Object.entries(SYSTEMS).find(([, system]) => system.subject.test(line.text));
    if (named) {
      current = named[0];
      since = 0;
    } else if ((since += 1) > 8) current = null;
    return current;
  });
}

function described(lines, kind) {
  const under = systemsAbove(lines);
  const facts = {};
  const fuels = [];
  for (const key of Object.keys(LABELS)) {
    const found = [];
    lines.forEach((line, index) => {
      if (UNDER[key] && under[index] !== UNDER[key]) return;
      line.segments.forEach((segment, at) => {
        // The words after the label in its own piece, or in the next piece when a form prints them in a column apart.
        for (const text of [segment, line.segments[at + 1] ? `${segment} ${line.segments[at + 1]}` : null]) {
          const match = text && text.match(LABELS[key]);
          if (!match) continue;
          const said = match[1].slice(0, 80);
          let value;
          if (key === 'plumbing') {
            const all = WORDS.plumbing.filter(([, pattern]) => pattern.test(said)).map(([word]) => word);
            value = all.length ? all.join(' and ') : null;
          } else value = wordFor(key, said);
          // "Heating: Forced air, gas" names the fuel too.
          const fuel = key === 'heating' && wordFor('heating_fuel', said);
          if (fuel) fuels.push({ value: fuel, page: line.page, quote: quoteOf(line, line.text.indexOf(segment)) });
          if (!value) continue;
          found.push({ value, page: line.page, quote: quoteOf(line, line.text.indexOf(segment)) });
          break;
        }
      });
    });
    const pick = settle(found, kind);
    if (pick) facts[key] = pick;
  }
  if (!facts.heating_fuel) {
    const fuel = settle(fuels, kind);
    if (fuel) facts.heating_fuel = fuel;
  }
  return facts;
}

// Counts and sizes, read three ways: a label alone in its piece of the line with the number in the next ("Beds" | "4");
// a labeled line anywhere ("Bedrooms: 4"); and, only in an appraisal or a listing sheet, a number before its label
// ("4 Bedrooms", the appraisal form's own wording) or, in a listing sheet, a label before its number ("Beds 4").
const COUNTS = {
  year_built: { label: 'year built|yr\\.? built', strict: [/\b(?:year built|yr\.? built|built in|year of construction|year constructed)\s*[:\-–]?\s*((?:17|18|19|20)\d{2})\b/i] },
  stories: { label: '# of stories|number of stories|stories|levels', strict: [/\b(?:# of stories|number of stories|no\.? of stories|stories|levels)\s*[:\-–#]\s*(\d(?:\.\d)?)\b/i, /\b(?:# of stories|number of stories)\s*(\d(?:\.\d)?)\b/i] },
  bedrooms: {
    label: 'bedrooms|beds|bdrms?|br',
    strict: [/\b(?:bedrooms|beds|bdrms?|br)\s*(?::|#|count|total)\s*(\d{1,2})(?![.\d])/i],
    after: [/\b(\d{1,2})\s*(?:bedrooms|beds|bdrms?|br)\b/i],
    before: [/\b(?:bedrooms|beds|bdrms?)\s+(\d{1,2})(?![.\d])/i],
  },
  bathrooms: {
    label: 'bathrooms|baths|bath\\(s\\)|ba',
    strict: [/\b(?:bathrooms|baths|bath\(s\)|ba)\s*(?::|#|count|total)\s*(\d{1,2}(?:\.\d{1,2})?)(?![\d/])/i],
    after: [/\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:bath\(s\)|(?:baths|bathrooms|ba)\b)/i],
    before: [/\b(?:bathrooms|baths)\s+(\d{1,2}(?:\.\d{1,2})?)(?![\d/])/i],
  },
  full_baths: { label: 'full baths?', strict: [/\bfull baths?\s*[:\-–#]\s*(\d)\b/i, /\b(\d)\s*full baths?\b/i] },
  half_baths: { label: '(?:half|partial) baths?', strict: [/\b(?:half|partial) baths?\s*[:\-–#]\s*(\d)\b/i, /\b(\d)\s*(?:half|partial) baths?\b/i] },
  rooms: { label: 'total rooms|room count', strict: [/\b(?:total rooms|room count)\s*[:\-–#]?\s*(\d{1,2})\b/i], after: [/\b(\d{1,2})\s*rooms\b/i] },
  fireplaces: { label: 'fireplaces?(?:\\s*\\(s\\))?(?:\\s*#)?', strict: [/\bfireplaces?(?:\s*\(s\))?\s*(?:#|count|number|qty|:)\s*[:\-–]?\s*(\d)\b/i] },
  parking_spaces: { label: 'garage spaces|garage stalls|# of cars', strict: [/\b(\d)\s*[- ]?car\s+(?:attached |detached |built[- ]in )?garage\b/i, /\bgarage(?: spaces| stalls| # of cars| capacity)\s*[:\-–#]?\s*(\d)\b/i, /\b# of cars\s*[:\-–]?\s*(\d)\b/i] },
  living_sqft: {
    label: 'gross living area|living area|sq\\.? ?ft\\.?|sqft|square feet|finished area|living sq\\.? ?ft\\.?',
    strict: [
      /\b(?:gross living area|living area|living sq\.? ?ft\.?|finished (?:sq\.? ?ft\.?|square feet|area)|above grade finished(?: area)?|total finished(?: area)?|approx(?:imate|\.)? (?:sq(?:uare)?\.? ?f(?:ee)?t\.?|living area)|square footage|interior sq\.? ?ft\.?|sq\.? ?ft\.?|sqft)\s*(?:\([^)]*\))?\s*[:\-–]?\s*(?:approx(?:imately|\.)?\s*)?([\d,]{3,6})\b/i,
      /\b([\d,]{3,6})\s*(?:square feet|sq\.? ?ft\.?)\s*(?:of\s*)?(?:gross\s*)?living area\b/i,
    ],
  },
  lot_sqft: { strict: [/\b(?:lot size|lot area|site area|lot)\s*[:\-–]?\s*([\d,]+(?:\.\d+)?)\s*(sq\.? ?ft\.?|square feet|sf|acres?|ac\.?)(?=\W|$)/i] },
};
// Right before a number, any count's label: in a listing sheet that number is that label's ("Beds 4 Baths 2.5").
const LABEL_BEFORE = new RegExp(`\\b(?:${Object.values(COUNTS).filter((rule) => rule.label).map((rule) => rule.label).join('|')})\\s*[:#]?\\s*$`, 'i');
const NOT_LIVING = /\b(?:lot|garage|basement|deck|porch|patio|carport|land|site)\b/i;
const BOUNDS = {
  year_built: [1700, 2100], stories: [1, 9], bedrooms: [0, 20], bathrooms: [0.5, 20], full_baths: [0, 20], half_baths: [0, 10], rooms: [1, 60],
  fireplaces: [0, 9], parking_spaces: [0, 9], living_sqft: [200, 30000], lot_sqft: [500, 50000000],
};

/** The first way the line states this count, as { raw, unit, index }; null when it doesn't. */
function countIn(line, rule, kind) {
  if (rule.label) {
    const alone = new RegExp(`^(?:${rule.label})\\s*[:#]?$`, 'i');
    for (let at = 0; at + 1 < line.segments.length; at += 1) {
      const next = alone.test(line.segments[at]) && line.segments[at + 1].match(/^([\d,]+(?:\.\d+)?)(?![\d/])/);
      if (next) return { raw: next[1], index: line.text.indexOf(line.segments[at]) };
    }
  }
  for (const pattern of rule.strict) {
    const match = line.text.match(pattern);
    if (match) return { raw: match[1], unit: match[2], index: match.index, text: match[0] };
  }
  if (kind === 'appraisal' || kind === 'listing') {
    for (const pattern of rule.after || []) {
      const match = line.text.match(pattern);
      if (match && !(kind === 'listing' && LABEL_BEFORE.test(line.text.slice(0, match.index)))) return { raw: match[1], index: match.index };
    }
  }
  if (kind === 'listing') {
    for (const pattern of rule.before || []) {
      const match = line.text.match(pattern);
      if (match) return { raw: match[1], index: match.index };
    }
  }
  return null;
}

function counts(lines, kind) {
  const facts = {};
  for (const [key, rule] of Object.entries(COUNTS)) {
    const found = [];
    for (const line of lines) {
      const hit = countIn(line, rule, kind);
      if (!hit) continue;
      if (key === 'living_sqft' && NOT_LIVING.test(line.text.slice(Math.max(0, hit.index - 12), hit.index + (hit.text || '').length + 12))) continue;
      let value = number(hit.raw);
      if (key === 'lot_sqft' && /^ac/i.test(hit.unit || '')) value = Math.round(value * 43560);
      if (!Number.isFinite(value) || value < BOUNDS[key][0] || value > BOUNDS[key][1]) continue;
      found.push({ value, page: line.page, quote: quoteOf(line, hit.index), raw: hit.raw });
    }
    const pick = settle(found, kind);
    if (pick) facts[key] = pick;
  }
  baths(facts, kind);
  return facts;
}

/**
 * An appraisal writes baths as full.half ("2.1" is two full and one half); a listing that writes ".1" to ".3" means
 * the same. A quarter, a half or three quarters is a fraction.
 */
function baths(facts, kind) {
  const bath = facts.bathrooms;
  if (bath && /\.\d$/.test(bath.raw) && (kind === 'appraisal' || /\.[123]$/.test(bath.raw))) {
    const [full, half] = bath.raw.split('.').map(Number);
    facts.full_baths = facts.full_baths || { ...bath, value: full };
    facts.half_baths = facts.half_baths || { ...bath, value: half };
    bath.value = full + half / 2;
  } else if (!bath && facts.full_baths) {
    const half = facts.half_baths ? facts.half_baths.value : 0;
    facts.bathrooms = { ...facts.full_baths, value: facts.full_baths.value + half / 2 };
  }
  for (const fact of Object.values(facts)) delete fact.raw;
}

const AGE = /(?<![\d\-–+]\s?)(?<!to\s)(?<!\d\s?(?:-|–|to)\s?)\b(\d{1,2})\s*(?:years?|yrs?\.?)\s*old\b|\b(?:age|approximate age|estimated age|approx(?:imate|\.)? age)(?:\s*of (?:the )?(?:roof|roof covering|unit|system|water heater|furnace|equipment|panel))?\s*[:\-–]?\s*(?:approx(?:imately|\.)?\s*|about\s*|est(?:imated|\.)?\s*)?(\d{1,2})(?![\d\-–+]|\s*(?:-|–|to)\s*\d)\s*(?:years?|yrs?)\b/i;
// Never "built": a home's year built sits near its roof on an appraisal.
const YEAR = /\b(?:manufactur(?:ed|e date|e year|ing date)|installed|install(?:ation)? date|replaced|year(?: installed| of manufacture| manufactured)?|date of manufacture|mfg\.?(?: date| year)?|vintage|dated)\s*(?:in|on|:|-|–)?\s*(?:approx(?:imately|\.)?\s*|circa\s*|about\s*)?((?:19|20)\d{2})\b/i;

const NEW_YEAR = /\b(?:new|newer)\b[^.]{0,40}?\b((?:19|20)\d{2})\b/i;

/** The part of a line about this system: its sentence, cut at commas when the sentence names another system too. */
function aboutSystem(text, subject) {
  const sentence = text.split(/(?<=[.;!?])\s+/).find((candidate) => subject.test(candidate));
  if (!sentence) return null;
  const others = SUBJECTS.filter((other) => other !== subject && other.test(sentence));
  if (!others.length) return sentence;
  return sentence.split(/,\s+|\s+and\s+/).find((part) => subject.test(part) && !others.some((other) => other.test(part))) || null;
}

/** Each system's year: stated, or its stated age counted back from the report's date, read under that system's name. */
function systemYears(lines, date) {
  const facts = {};
  const reportYear = date ? Number(date.slice(0, 4)) : null;
  for (const [key, system] of Object.entries(SYSTEMS)) {
    const found = [];
    lines.forEach((line, index) => {
      if (!system.subject.test(line.text)) return;
      // The system's own words on its line, then a few lines after it, until another system starts.
      for (let next = index; next < Math.min(lines.length, index + 6); next += 1) {
        const candidate = lines[next];
        if (next > index && SUBJECTS.some((subject) => subject.test(candidate.text))) break;
        if (key === 'electrical_panel' && /sub ?-?panel/i.test(candidate.text)) continue;
        const text = next === index ? aboutSystem(candidate.text, system.subject) : candidate.text;
        if (!text) break;
        const stated = text.match(YEAR) || text.match(NEW_YEAR);
        if (stated) {
          const year = Number(stated[1]);
          if (year >= 1900 && year <= (reportYear || new Date().getUTCFullYear())) found.push({ value: year, page: candidate.page, quote: quoteOf(candidate, candidate.text.indexOf(stated[0])) });
          break;
        }
        const aged = text.match(AGE);
        if (aged && reportYear) {
          const age = Number(aged[1] || aged[2]);
          if (age <= AGE_YEARS) found.push({ value: reportYear - age, page: candidate.page, quote: quoteOf(candidate, candidate.text.indexOf(aged[0])), age });
          break;
        }
      }
    });
    const values = new Set(found.map((item) => item.value));
    // Two different years for one system (a summary and a section that disagree) give none.
    if (found.length && values.size === 1) facts[key] = found[0];
  }
  return facts;
}

/** The water heater, the electrical service and its panel, read under their own headings. */
function systemDetails(lines) {
  const under = systemsAbove(lines);
  const facts = {};
  const heater = { tankless: false, tank: false, fuel: null, gallons: null, page: null, quote: null };
  const amps = [];
  const panel = { brand: null, kind: null, page: null, quote: null };
  lines.forEach((line, index) => {
    const text = line.text;
    if (under[index] === 'water_heater') {
      const fuel = /\bheat pump|hybrid\b/i.test(text) ? 'heat pump' : /\b(?:natural gas|gas)\b/i.test(text) ? 'gas' : /\belectric\b/i.test(text) ? 'electric' : /\bpropane\b/i.test(text) ? 'propane' : null;
      const gallons = text.match(/\b(\d{2,3})\s*-?\s*gal(?:lons?|\.)?\b/i);
      const found = /tankless|on[- ]demand|instantaneous/i.test(text);
      if (found) heater.tankless = true;
      if (gallons || /\btank\b/i.test(text)) heater.tank = true;
      if (fuel && !heater.fuel) heater.fuel = fuel;
      if (gallons && !heater.gallons) heater.gallons = Number(gallons[1]);
      if ((fuel || gallons || found) && !heater.quote) Object.assign(heater, { page: line.page, quote: quoteOf(line) });
    }
    const amp = text.match(/\b(\d{2,3})\s*(?:-\s*)?(?:amps?|amperes?|a)\b/i);
    if (amp && STANDARD_AMPS.has(Number(amp[1])) && !/sub ?-?panel|breaker for|circuit/i.test(text)
      && (under[index] === 'electrical_panel' || /\b(?:service|main|capacity|rating|rated|size|amperage|electrical)\b/i.test(text))) {
      amps.push({ value: Number(amp[1]), page: line.page, quote: quoteOf(line, amp.index) });
    }
    if (under[index] === 'electrical_panel' || /\b(?:panel|electrical)\b/i.test(text)) {
      const brand = text.match(/\b(square d|siemens|cutler[- ]hammer|eaton|general electric|federal pacific|stab-lok|zinsco|sylvania|murray|challenger|westinghouse|pushmatic|wadsworth|bryant|crouse[- ]hinds|thomas & betts|ite|leviton|homeline)\b/i);
      if (brand && !panel.brand) Object.assign(panel, { brand: brand[1], page: line.page, quote: quoteOf(line, brand.index) });
      if (under[index] === 'electrical_panel' && !panel.kind) {
        if (/\bfuses?\b/i.test(text)) panel.kind = 'fuses';
        else if (/\bbreakers?\b/i.test(text)) panel.kind = 'breakers';
        if (panel.kind && !panel.quote) Object.assign(panel, { page: line.page, quote: quoteOf(line) });
      }
    }
  });
  if (heater.quote && (heater.tankless || heater.fuel || heater.gallons)) {
    const fuel = heater.fuel ? heater.fuel[0].toUpperCase() + heater.fuel.slice(1) : null;
    let value;
    if (heater.tankless) value = fuel ? `Tankless, ${heater.fuel}` : 'Tankless';
    else if (heater.fuel === 'heat pump') value = heater.gallons ? `Heat pump, ${heater.gallons} gallons` : 'Heat pump';
    else value = [fuel ? `${fuel} tank` : 'Tank', heater.gallons ? `${heater.gallons} gallons` : null].filter(Boolean).join(', ');
    facts.water_heater = { value, page: heater.page, quote: heater.quote };
  }
  if (amps.length && new Set(amps.map((item) => item.value)).size === 1) facts.electrical_service = amps[0];
  if (panel.brand || panel.kind) {
    const brand = panel.brand ? panel.brand.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/^Ite$/, 'ITE') : null;
    const kind = panel.kind ? panel.kind[0].toUpperCase() + panel.kind.slice(1) : null;
    facts.electrical_panel = { value: brand ? `${brand}${panel.kind ? `, ${panel.kind}` : ''}` : kind, page: panel.page, quote: panel.quote };
  }
  return facts;
}

/**
 * @param {Array} pages    pdfText.pdfPages's pages.
 * @param {object} args
 * @param {string} args.address  The Home's street line.
 * @param {Date} [args.today]
 * @returns {{ kind: string, date: string|null, namesAddress: boolean, systems: object, facts: object, missing: string[] }}
 */
function readFacts(pages, { address, today = new Date() }) {
  const lines = linesOf(pages);
  const text = lines.map((line) => line.text).join('\n');
  const kind = kindOf(text);
  const date = reportDate(lines, kind, today);
  if (!namesAddress(text, address)) return { kind, date, namesAddress: false, systems: {}, facts: {}, missing: [] };
  const systems = systemYears(lines, date);
  const facts = { ...counts(lines, kind), ...described(lines, kind), ...systemDetails(lines) };
  const missing = Object.entries(SYSTEMS).filter(([key, system]) => system.missing && !systems[key]).map(([, system]) => system.missing);
  return { kind, date, namesAddress: true, systems, facts, missing };
}

module.exports = { readFacts, KINDS, SYSTEMS, namesAddress };
