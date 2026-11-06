'use strict';
// Clark County, Washington: the Assessor's weekly open-data file (PACS_OpenData.zip) for the facts, and the county's
// two public map layers for what the file doesn't say: "Taxlots for Public Use" (each account's address, with its unit
// and building) and "Situs Addresses" (every address and apartment on a parcel, which is the only list of a rental
// building's units). Terms: open data, with the county's disclaimer. Owner names aren't in the file; its mailing
// addresses are never asked for here, so they stay in the zip.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parts, zip5, unitKey } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipTable, cachedLayer } = require('../lib/tables.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '53011';
const ZIP_URL = 'https://gis.clark.wa.gov/openDataHub/PacsData/PACS_OpenData.zip';
const TAXLOTS_URL = 'https://services2.arcgis.com/ylxwjFBdCPBzP16d/arcgis/rest/services/TaxlotsforPublicUse/FeatureServer/0';
const SITUS_URL = 'https://services2.arcgis.com/ylxwjFBdCPBzP16d/arcgis/rest/services/SitusAddress/FeatureServer/0';
const TABLE = { delimiter: '|', quoted: false };
const VALUE_YEARS_KEPT = 5;

// The Assessor's property use codes (PT1): what each record is. Anything not listed is land or a business.
const HOME_USES = new Map([
  ...[10, 11, 13, 14, 15, 19, 31, 88, 92, 511, 513, 514, 518].map((code) => [code, ['property', 'house']]),
  [12, ['property', 'townhouse']],
  ...[16, 70, 71, 75, 78, 79, 516].map((code) => [code, ['property', 'mobile_home']]),
  ...[17, 517].map((code) => [code, ['unit', 'condo']]),
  ...[21, 22, 32, 33, 35, 38, 39].map((code) => [code, ['building', 'multi_unit']]),
  ...[23, 24, 25, 26, 27, 28, 29, 37, 80, 81, 83].map((code) => [code, ['building', 'apartment']]),
  [72, ['building', 'other']],
]);
const VACANT_USES = new Set([989, 991, 992, 993, 994, 995, 996, 997, 998, 999]);

const number = (text) => {
  const value = Number(text);
  return text !== '' && text != null && Number.isFinite(value) ? value : null;
};
const positive = (text) => {
  const value = number(text);
  return value !== null && value > 0 ? value : null;
};
/** Sets a fact only when it says something. */
function put(facts, name, value) {
  if (value === null || value === undefined || value === '') return;
  facts[name] = value;
}
const dateOnly = (text) => (/^\d{4}-\d{2}-\d{2}/.test(text || '') ? text.slice(0, 10) : null);

/** "COMPOSITION, SHINGLE" stays the county's own word, read as a sentence by the projector; empty and "NONE" say nothing. */
function word(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return !value || /^(NONE|NULL|UNKNOWN|N\/A)$/i.test(value) ? null : value;
}

const IMPROVEMENT_ATTRIBUTES = new Map([
  ['Exterior Wall', 'exterior_walls'],
  ['Roof Covering', 'roof_cover'],
  ['HEAT TYPE', 'heating'],
  ['A/C', 'cooling'],
  ['Foundation', 'foundation'],
  ['Flooring', 'flooring'],
  ['POOL TYPE', 'pool'],
]);

// The county's codes in plain words. Only what its own documentation or lookup page confirms: a code not listed here
// is left out of the release and counted (unmappedCodes), never guessed.
const CODE_WORDS = {
  exterior_walls: { VINYL: 'Vinyl', LOG: 'Log' },
  roof_cover: { METAL: 'Metal', ROLL: 'Rolled' },
  heating: {},
  cooling: { Y: 'Yes', N: 'No' },
  foundation: { CONC: 'Concrete' },
  flooring: { CONC: 'Concrete' },
  pool: { CONCRETE: 'Concrete', FIBERGLASS: 'Fiberglass', 'PLACSTIC LINED': 'Plastic lined' },
};

const GARAGE_WORDS = new Map([
  ['ATTACHED GARAGE', 'Attached'], ['BUILT-IN GARAGE', 'Built-in'], ['DETACHED GARAGE', 'Detached'],
  ['BASEMENT GARAGE', 'Basement'], ['MH ATTACHED GARAGE', 'Attached'],
]);
const BASEMENT_FINISHED = new Set(['FINISHED BASEMENT', 'DAY FINISHED BASEMENT']);
const BASEMENT_ALL = new Set(['FINISHED BASEMENT', 'DAY FINISHED BASEMENT', 'UNFINISHED BASEMENT', 'DAY UNFINISHED BASEMENT']);
const STORY_LINES = new Map([['MAIN', 1], ['SECOND', 2], ['THIRD', 3]]);
const STRUCTURES = new Set(['GENERAL PURPOSE BUILDING', 'SHED', 'LEANTO', 'PORCH', 'DECK', 'POLE COVER', 'BARN', 'SUN ROOM', 'PATIO COVER', 'PATIO', 'MACHSHED', 'STABLE', 'ARENA', 'LOAFSHED']);

async function readFacts(zip, records, today) {
  const unmappedCodes = {};
  for await (const row of zipTable(zip, 'PropBldgSumInfoVw.txt', ['prop_id', 'BldgStyle', 'YrBlt', 'LivingArea', 'Condition', 'Class', 'Bedrooms', 'FullBaths', 'HalfBaths', 'ThrQtrsBaths', 'Fireplaces'], TABLE)) {
    const record = records.get(row.prop_id);
    if (!record) continue;
    const { facts } = record;
    put(facts, 'style', word(row.BldgStyle));
    put(facts, 'year_built', positive(row.YrBlt));
    put(facts, 'living_sqft', positive(row.LivingArea));
    put(facts, 'condition', word(row.Condition));
    put(facts, 'quality', word(row.Class));
    put(facts, 'bedrooms', positive(row.Bedrooms));
    const full = positive(row.FullBaths);
    const half = positive(row.HalfBaths);
    const threeQuarter = positive(row.ThrQtrsBaths);
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    put(facts, 'three_quarter_baths', threeQuarter);
    if (full || half || threeQuarter) facts.bathrooms = (full || 0) + 0.75 * (threeQuarter || 0) + 0.5 * (half || 0);
    put(facts, 'fireplaces', positive(row.Fireplaces));
  }

  for await (const row of zipTable(zip, 'PropImpDetailAttrVw.txt', ['prop_id', 'ImpAttr', 'ImpAttrVal'], TABLE)) {
    const name = IMPROVEMENT_ATTRIBUTES.get(row.ImpAttr);
    const record = name && records.get(row.prop_id);
    if (!record) continue;
    const code = word(row.ImpAttrVal);
    const value = code && CODE_WORDS[name][code.toUpperCase()];
    if (code && !value) unmappedCodes[`${name}:${code}`] = (unmappedCodes[`${name}:${code}`] || 0) + 1;
    // A home can list several; the first says what the main building is.
    if (value && !record.facts[name]) record.facts[name] = value;
  }

  const garages = new Map();
  const structures = new Map();
  for await (const row of zipTable(zip, 'PropImpDetailVw.txt', ['prop_id', 'ImpDetTypeDesc', 'ImpDetSqFt', 'ImpDetStories'], TABLE)) {
    const record = records.get(row.prop_id);
    if (!record) continue;
    const { facts } = record;
    const type = row.ImpDetTypeDesc;
    const area = positive(row.ImpDetSqFt);
    if (STORY_LINES.has(type)) facts.stories = Math.max(facts.stories || 0, STORY_LINES.get(type));
    if (type === 'MAIN' && positive(row.ImpDetStories)) facts.stories = Math.max(facts.stories || 0, positive(row.ImpDetStories));
    if (GARAGE_WORDS.has(type)) {
      if (!garages.has(row.prop_id)) garages.set(row.prop_id, new Set());
      garages.get(row.prop_id).add(GARAGE_WORDS.get(type));
      if (area) facts.garage_sqft = (facts.garage_sqft || 0) + area;
    }
    if (type === 'CARPORT' && area) facts.carport_sqft = (facts.carport_sqft || 0) + area;
    if (BASEMENT_ALL.has(type) && area) facts.basement_sqft = (facts.basement_sqft || 0) + area;
    if (BASEMENT_FINISHED.has(type) && area) facts.basement_finished_sqft = (facts.basement_finished_sqft || 0) + area;
    if (type === 'POOL' && !facts.pool) facts.pool = 'Yes';
    if (STRUCTURES.has(type)) {
      if (!structures.has(row.prop_id)) structures.set(row.prop_id, new Set());
      structures.get(row.prop_id).add(type);
    }
  }
  log(`codes with no plain word yet: ${Object.entries(unmappedCodes).map(([code, n]) => `${code} ${n}`).join(', ') || 'none'}`);
  for (const [id, kinds] of garages) records.get(id).facts.garage = [...kinds].sort().join(', ');
  for (const [id, kinds] of structures) records.get(id).facts.other_structures = [...kinds].sort().join(', ');

  for await (const row of zipTable(zip, 'PropLandVw.txt', ['Prop_id', 'AssrAc', 'AssrSqFt', 'PT1Desc', 'DOR_Use_Code', 'Z1'], TABLE)) {
    const record = records.get(row.Prop_id);
    if (!record) continue;
    const { facts } = record;
    put(facts, 'lot_acres', positive(row.AssrAc));
    put(facts, 'lot_sqft', positive(row.AssrSqFt));
    put(facts, 'land_use', word(row.PT1Desc));
    put(facts, 'county_use_code', word(row.DOR_Use_Code));
    put(facts, 'zoning', word(row.Z1));
  }

  for await (const row of zipTable(zip, 'PropAbstractVw.txt', ['Prop_ID', 'Legal', 'TaxStatus', 'NbrhdName'], TABLE)) {
    const record = records.get(row.Prop_ID);
    if (!record) continue;
    put(record.facts, 'legal_description', word(row.Legal)?.slice(0, 300));
    put(record.facts, 'neighborhood', word(row.NbrhdName));
    const status = word(row.TaxStatus);
    put(record.facts, 'tax_status', status);
    // "Regular" is the county saying no exemption applies; anything but its other words isn't an exemption.
    if (status) record.facts.exemptions = /EXEMPT/i.test(status) ? [status] : [];
  }

  for await (const row of zipTable(zip, 'subdiv.txt', ['prop_id', 'name'], TABLE)) {
    const record = records.get(row.prop_id);
    if (record) put(record.facts, 'subdivision', word(row.name));
  }

  for await (const row of zipTable(zip, 'PropTaxAreaMillage.txt', ['prop_id', 'AVYear', 'tax_area_number'], TABLE)) {
    const record = records.get(row.prop_id);
    if (record && (number(row.AVYear) || 0) >= (record.taxAreaYear || 0)) {
      record.taxAreaYear = number(row.AVYear);
      put(record.facts, 'tax_code_area', word(row.tax_area_number));
    }
  }

  const values = new Map();
  for await (const row of zipTable(zip, 'ValueMktTaxVw.txt', ['prop_id', 'Prop_val_yr', 'MarketVal', 'MktBldgVal', 'MktLandVal', 'TaxTotalValue'], TABLE)) {
    if (!records.has(row.prop_id)) continue;
    const year = number(row.Prop_val_yr);
    if (!year) continue;
    if (!values.has(row.prop_id)) values.set(row.prop_id, new Map());
    // The same year can repeat with a supplement number; the last line is the latest.
    values.get(row.prop_id).set(year, row);
  }
  for (const [id, years] of values) {
    const { facts } = records.get(id);
    const sorted = [...years.keys()].sort((a, b) => b - a);
    const latest = years.get(sorted[0]);
    put(facts, 'value_year', sorted[0]);
    put(facts, 'market_value', positive(latest.MarketVal));
    put(facts, 'market_building_value', positive(latest.MktBldgVal));
    put(facts, 'market_land_value', positive(latest.MktLandVal));
    put(facts, 'taxable_value', positive(latest.TaxTotalValue));
    const history = sorted.slice(1, VALUE_YEARS_KEPT).map((year) => [year, positive(years.get(year).MarketVal)]).filter(([, value]) => value);
    if (history.length) facts.value_history = history;
  }

  const taxes = new Map();
  for await (const row of zipTable(zip, 'PropTaxesHistory.txt', ['prop_id', 'display_year', 'amount_billed'], TABLE)) {
    if (!records.has(row.prop_id)) continue;
    const year = number(row.display_year);
    const billed = positive(row.amount_billed);
    if (!year || !billed) continue;
    if (!taxes.has(row.prop_id)) taxes.set(row.prop_id, new Map());
    const years = taxes.get(row.prop_id);
    // A year's statements add up (first and second half, supplements).
    years.set(year, (years.get(year) || 0) + billed);
  }
  for (const [id, years] of taxes) {
    const { facts } = records.get(id);
    const sorted = [...years.keys()].sort((a, b) => b - a);
    // An account closed years ago has no current bill to show.
    if (sorted[0] < today.getFullYear() - 1) continue;
    facts.tax_year = sorted[0];
    facts.tax_amount = Math.round(years.get(sorted[0]) * 100) / 100;
    const history = sorted.slice(1, VALUE_YEARS_KEPT).map((year) => [year, Math.round(years.get(year) * 100) / 100]);
    if (history.length) facts.tax_history = history;
  }

  const sales = new Map();
  for await (const row of zipTable(zip, 'PropSalesInfoOnlyVw.txt', ['prop_id', 'SalePrice', 'SaleDate', 'deed_num'], TABLE)) {
    if (!records.has(row.prop_id) || !positive(row.SalePrice)) continue;
    const date = dateOnly(row.SaleDate);
    const held = sales.get(row.prop_id);
    if (date && (!held || date > held.date)) sales.set(row.prop_id, { date, row });
  }
  for (const [id, { date, row }] of sales) {
    const { facts } = records.get(id);
    facts.sale_date = date;
    facts.sale_price = positive(row.SalePrice);
    put(facts, 'sale_document', word(row.deed_num));
  }
}

function addressOf(row) {
  const address = parts({
    number: row.SitusHsNum, numberSuffix: row.SitusHsSub, pre: row.SitusStDir, name: row.SitusStName, suffix: row.SitusStType,
    unit: row.SitusUnit, building: row.SitusBldgNum,
  });
  if (!address) return null;
  return { ...address, city: String(row.SitusCity || '').trim().toUpperCase(), zip: zip5(row.SitusZip1) };
}

function recordLine(row) {
  const street = [row.SitusHsNum, row.SitusHsSub, row.SitusStDir, row.SitusStName, row.SitusStType].filter(Boolean).join(' ');
  const secondary = [row.SitusBldgNum && `BLDG ${row.SitusBldgNum}`, row.SitusUnit && `#${row.SitusUnit}`].filter(Boolean).join(' ');
  return [street, secondary].filter(Boolean).join(' ');
}

async function build({ work, today = new Date() }) {
  const dir = path.join(work, 'wa-clark');
  const zip = path.join(dir, 'PACS_OpenData.zip');
  download(ZIP_URL, zip);
  const readMe = execFileSync('unzip', ['-p', zip, 'ReadMe.txt'], { encoding: 'latin1' });
  const asOf = /created on (\d{4}-\d{2}-\d{2})/.exec(readMe)?.[1];
  if (!asOf) throw new Error('The county\'s read-me no longer says when the file was made');

  // Each active account the county publishes, with its address.
  const records = new Map();
  const landOf = new Map();
  let noAddress = 0;
  for await (const row of cachedLayer(path.join(dir, 'taxlots.jsonl'), TAXLOTS_URL, [
    'OBJECTID', 'Prop_id', 'LandProp_id', 'Pt1', 'SitusHsNum', 'SitusHsSub', 'SitusBldgNum', 'SitusUnit', 'SitusStDir', 'SitusStName', 'SitusStType',
    'SitusCity', 'SitusZip1', 'BldgEffYrBlt', 'BldgType', 'BldgPercentComp', 'BldgCount', 'Units', 'JurisDesc', 'SchoolDistrict', 'PropertyUseClass',
  ])) {
    const id = String(row.Prop_id);
    if (row.LandProp_id) landOf.set(id, String(row.LandProp_id));
    const address = addressOf(row);
    if (!address) {
      noAddress += 1;
      continue;
    }
    const use = HOME_USES.get(row.Pt1);
    const [kind, homeType] = use || [VACANT_USES.has(row.Pt1) ? 'parcel' : 'other', null];
    const facts = { parcel_number: id, county: 'Clark County', fips: FIPS, address_on_record: recordLine(row) };
    put(facts, 'effective_year_built', positive(row.BldgEffYrBlt));
    put(facts, 'building_type', word(row.BldgType));
    const percent = positive(row.BldgPercentComp);
    if (percent && percent < 100) facts.percent_complete = percent;
    if (kind === 'building' || (positive(row.Units) || 0) > 1) put(facts, 'units', positive(row.Units));
    put(facts, 'buildings_on_parcel', positive(row.BldgCount));
    put(facts, 'municipality', word(row.JurisDesc));
    put(facts, 'school_district', word(row.SchoolDistrict));
    put(facts, 'property_class', word(row.PropertyUseClass));
    records.set(id, { id: `pp:${kind}:${FIPS}:${id}`, kind, home_type: homeType, address, facts, sourceId: id });
  }
  log(`accounts with an address: ${records.size}, without: ${noAddress}`);

  await readFacts(zip, records, today);

  // The address list: a parcel's other street numbers, and the units of its buildings.
  const pointsByParcel = new Map();
  for await (const row of cachedLayer(path.join(dir, 'situs.jsonl'), SITUS_URL, ['OBJECTID', 'HsNbr', 'HsSub', 'Stype', 'StName', 'StDir', 'Zp1', 'StCity', 'PSN', 'Building', 'Apt'])) {
    if (!row.PSN) continue;
    const address = parts({ number: row.HsNbr, numberSuffix: row.HsSub, pre: row.StDir, name: row.StName, suffix: row.Stype });
    if (!address) continue;
    const parcel = String(row.PSN);
    if (!pointsByParcel.has(parcel)) pointsByParcel.set(parcel, []);
    pointsByParcel.get(parcel).push({ ...address, city: String(row.StCity || '').trim().toUpperCase(), zip: zip5(row.Zp1), unit: unitKey(row.Apt), building: unitKey(row.Building) });
  }

  const output = [];
  const streetId = (address) => `${address.pre}|${address.name}|${address.suffix}|${address.post}|${address.number}`;
  // Where an account says it is. A neighbor's address list can name the same number; the account's own word wins.
  const homesAt = new Set();
  for (const record of records.values()) {
    if (record.kind === 'property' || record.kind === 'unit') homesAt.add(streetId(record.address));
  }
  /** One building record per street number the building has, listing the units the county knows there. */
  function buildingAt(id, kindSource, points, facts, parentId) {
    const byStreet = new Map();
    for (const point of points) {
      const key = streetId(point);
      if (!byStreet.has(key)) byStreet.set(key, { address: { ...point, unit: '', building: '' }, roster: new Set() });
      if (point.unit) {
        byStreet.get(key).roster.add(point.unit);
        if (point.building) byStreet.get(key).roster.add(`${point.building}${point.unit}`);
      }
    }
    for (const { address, roster } of byStreet.values()) {
      output.push({
        id: parentId || `pp:building:${FIPS}:${id}`,
        kind: 'building',
        home_type: kindSource,
        address,
        facts,
        roster: [...roster].sort(),
      });
    }
  }

  // Condos: every unit keeps its own record; their complex gets a building record at each of its street numbers.
  const complexes = new Map();
  for (const record of records.values()) {
    if (record.kind !== 'unit') continue;
    const land = landOf.get(record.sourceId) || record.sourceId;
    if (!complexes.has(land)) complexes.set(land, []);
    complexes.get(land).push(record);
  }
  for (const [land, units] of complexes) {
    const id = `pp:building:${FIPS}:${land}`;
    const years = units.map((unit) => unit.facts.year_built).filter(Boolean).sort((a, b) => a - b);
    const stories = units.map((unit) => unit.facts.stories).filter(Boolean);
    const facts = { units_in_condominium: units.length, parcel_number: land, county: 'Clark County', fips: FIPS };
    if (years.length) facts.year_built = years[years.length >> 1];
    if (stories.length) facts.stories = Math.max(...stories);
    for (const name of ['exterior_walls', 'roof_cover', 'foundation', 'subdivision', 'municipality', 'school_district']) {
      const seen = units.map((unit) => unit.facts[name]).filter(Boolean);
      if (seen.length) facts[name] = seen[0];
    }
    const land0 = records.get(land);
    if (land0?.facts.lot_acres) facts.lot_acres = land0.facts.lot_acres;
    const points = [...(pointsByParcel.get(land) || []), ...units.map((unit) => unit.address)];
    buildingAt(land, 'condo', points, facts, id);
    for (const unit of units) unit.parent = id;
    if (land0 && land0.kind !== 'unit') land0.isComplexLand = true;
  }

  for (const record of records.values()) {
    const { sourceId, taxAreaYear, isComplexLand, ...kept } = record;
    if (isComplexLand) continue;
    // A rental building's facts sit at every street number it has.
    if (record.kind === 'building') {
      const points = pointsByParcel.get(sourceId) || [record.address];
      buildingAt(sourceId, record.home_type, points.length ? points : [record.address], record.facts);
      continue;
    }
    output.push(kept);
    // A house with a second street number: that address is the house's, not a home of its own.
    if (record.kind === 'property') {
      const others = (pointsByParcel.get(sourceId) || []).filter((point) => !homesAt.has(streetId(point)));
      if (others.length) {
        const buildingFacts = {};
        for (const [name, value] of Object.entries(record.facts)) if (name !== 'address_on_record') buildingFacts[name] = value;
        buildingAt(sourceId, record.home_type, others, buildingFacts);
      }
    }
  }

  return [{
    fips: FIPS,
    state: 'WA',
    name: 'Clark County',
    publisher: 'Clark County Assessor',
    dataset: 'weekly file',
    method: 'county',
    source: 'wa-clark',
    as_of: asOf,
    // A weekly file three months old has stopped; facts this old aren't offered to a new lookup.
    stale_after_days: 90,
    records: output,
  }];
}

module.exports = { build };
