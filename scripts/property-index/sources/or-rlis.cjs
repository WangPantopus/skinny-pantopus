'use strict';
// Multnomah, Washington and Clackamas counties, Oregon: Metro's public taxlots (RLIS), from the three county assessors, under the RLIS Open
// Database License: copy, publish and combine in an application, crediting Metro, without suggesting its endorsement. This public layer has
// no owner names. TOTALVAL is Oregon's real market value; ASSESSVAL is the capped value taxes follow. No bedrooms or baths.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const LAYER = 'https://services2.arcgis.com/McQ0OlIABe29rJJy/arcgis/rest/services/Taxlots_(Public)/FeatureServer/3';
const COUNTIES = { M: ['41051', 'Multnomah County'], W: ['41067', 'Washington County'], C: ['41005', 'Clackamas County'] };
// Counties read by their own connector, which adds the county's own facts to these taxlots.
const OWN_CONNECTOR = new Set(['41005']);
const COLUMNS = ['TLID', 'PRIMACCNUM', 'SITEADDR', 'SITECITY', 'SITEZIP', 'BLDGSQFT', 'A_T_ACRES', 'GIS_ACRES', 'YEARBUILT', 'LANDUSE', 'STATECLASS', 'TAXCODE', 'SALEDATE', 'SALEPRICE', 'COUNTY', 'JURIS_CITY', 'LANDVAL', 'BLDGVAL', 'TOTALVAL', 'ASSESSVAL'];
const USES = { SFR: 'Single family residential', MFR: 'Multi-family residential', VAC: 'Vacant', RUR: 'Rural', AGR: 'Agricultural', FOR: 'Forest', COM: 'Commercial', IND: 'Industrial', PUB: 'Public' };

function useOf(row, unit, built) {
  const use = String(row.LANDUSE || '').trim().toUpperCase();
  if (use === 'SFR' || use === 'RUR') {
    if (!built) return ['parcel', null];
    return unit ? ['unit', 'condo'] : ['property', 'house'];
  }
  if (use === 'MFR') return unit ? ['unit', 'condo'] : ['building', 'multi_unit'];
  if (use === 'VAC') return ['parcel', null];
  return ['other', null];
}

function fromRow(row, fips, county, asOf) {
  const line = word(row.SITEADDR);
  const address = line ? parse(line) : null;
  const account = word(row.PRIMACCNUM);
  if (!address || !account) return null;
  const size = positive(row.BLDGSQFT);
  const [kind, homeType] = useOf(row, address.unit, Boolean(size));
  const facts = { parcel_number: account, county, fips };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', line);
  put(facts, 'municipality', word(row.JURIS_CITY));
  put(facts, 'tax_code_area', word(row.TAXCODE));
  put(facts, 'land_use', USES[String(row.LANDUSE || '').trim().toUpperCase()]);
  put(facts, 'county_use_code', word(row.STATECLASS));
  if (home || kind === 'building') put(facts, 'year_built', year(row.YEARBUILT));
  if (home) put(facts, 'living_sqft', size);
  if (kind === 'building') put(facts, 'gross_sqft', size);
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.A_T_ACRES) || positive(row.GIS_ACRES));
  put(facts, 'value_year', Number(asOf.slice(0, 4)));
  put(facts, 'market_value', positive(row.TOTALVAL));
  put(facts, 'market_land_value', positive(row.LANDVAL));
  put(facts, 'market_building_value', positive(row.BLDGVAL));
  put(facts, 'assessed_value', positive(row.ASSESSVAL));
  if (positive(row.SALEPRICE) > 100) {
    facts.sale_price = positive(row.SALEPRICE);
    put(facts, 'sale_date', isoDate(row.SALEDATE));
  }
  return { id: `pp:${kind}:${fips}:${account}`, kind, home_type: homeType, address: { ...address, city: String(word(row.SITECITY) || '').toUpperCase(), zip: zipCode(row.SITEZIP) }, facts };
}

/** When Metro's layer last changed. */
async function layerDate() {
  const info = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  return asOf;
}

async function countyEntry(work, code, asOf) {
  const [fips, county] = COUNTIES[code];
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  const rows = cached(path.join(work, 'or-rlis', `${fips}.jsonl.gz`), () => layerRows(LAYER, COLUMNS, { where: `COUNTY = '${code}'`, oid: 'FID' }));
  for await (const row of rows) {
    const record = fromRow(row, fips, county, asOf);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${county}: ${records.length} taxlots, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips, county })) records.push(building);
  return {
    fips, state: 'OR', name: county, publisher: `${county} Assessor and Metro`, dataset: 'RLIS taxlots', method: 'county', source: 'or-rlis', as_of: asOf, stale_after_days: 120, records,
  };
}

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const asOf = await layerDate();
  for (const [code, [fips]] of Object.entries(COUNTIES)) {
    if (OWN_CONNECTOR.has(fips) || (only.length && !only.includes(fips))) continue;
    yield await countyEntry(work, code, asOf);
  }
}

/** One county's taxlots, for a connector that adds the county's own facts to them. */
async function countyTaxlots(work, fips) {
  const code = Object.keys(COUNTIES).find((key) => COUNTIES[key][0] === fips);
  if (!code) throw new Error(`RLIS has no county ${fips}`);
  return countyEntry(work, code, await layerDate());
}

module.exports = {
  build,
  countyTaxlots,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YEARBUILT', living_sqft: 'BLDGSQFT', gross_sqft: 'BLDGSQFT', lot_acres: 'A_T_ACRES', market_value: 'TOTALVAL', market_land_value: 'LANDVAL', market_building_value: 'BLDGVAL', assessed_value: 'ASSESSVAL', sale_price: 'SALEPRICE', sale_date: 'SALEDATE' },
  },
};
