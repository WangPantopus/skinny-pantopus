'use strict';
// Allegheny County, Pennsylvania: the county's property assessments on the Western Pennsylvania Regional Data Center, under
// CC0. It leaves out owners' names (county Ordinance 3478-07); the mailing address columns ("change notice") and the homestead
// flag aren't asked for. The county's "fair market" values still stand on its 2012 base year, so they are never read as a home's
// market value today: the county's assessed values are shown as assessed values. Bedrooms and baths are on most homes.

const path = require('node:path');
const { ckanRows, getJson, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '42003';
const COUNTY = 'Allegheny County';
const DOMAIN = 'data.wprdc.org';
const RESOURCE = '65855e14-549e-4992-b5be-d629afc676fa';
const COLUMNS = ['PARID', 'PROPERTYHOUSENUM', 'PROPERTYFRACTION', 'PROPERTYADDRESS', 'PROPERTYCITY', 'PROPERTYUNIT', 'PROPERTYZIP', 'MUNIDESC', 'SCHOOLDESC', 'LEGAL1', 'LEGAL2', 'LEGAL3', 'NEIGHDESC', 'CLASSDESC', 'USECODE', 'USEDESC', 'LOTAREA', 'SALEDATE', 'SALEPRICE', 'DEEDBOOK', 'DEEDPAGE', 'COUNTYBUILDING', 'COUNTYLAND', 'COUNTYTOTAL', 'STYLEDESC', 'STORIES', 'YEARBLT', 'EXTFINISH_DESC', 'ROOFDESC', 'BASEMENTDESC', 'GRADEDESC', 'CONDITIONDESC', 'TOTALROOMS', 'BEDROOMS', 'FULLBATHS', 'HALFBATHS', 'HEATINGCOOLINGDESC', 'FIREPLACES', 'BSMTGARAGE', 'FINISHEDLIVINGAREA', 'TAXYEAR', 'ASOFDATE'];

const BASEMENTS = { Full: 'Full basement', Part: 'Partial basement', 'Slab/Piers': 'Slab or piers', Crawl: 'Crawl space' };

function useOf(words, unit) {
  const use = String(words || '').toUpperCase();
  if (/^SINGLE FAMILY$|^GENERAL FARM|^OTHER RESIDENTIAL STRUCTURE/.test(use)) return ['property', 'house'];
  if (use === 'TOWNHOUSE' || use === 'ROWHOUSE') return ['property', 'townhouse'];
  if (use === 'CONDOMINIUM') return ['unit', 'condo'];
  if (/^MOBILE HOME/.test(use)) return ['property', 'mobile_home'];
  if (/^(TWO|THREE|FOUR) FAMILY$/.test(use)) return ['building', 'multi_unit'];
  if (/APART/.test(use)) return unit ? ['other', null] : ['building', 'apartment'];
  if (/^VACANT LAND|^BUILDERS LOT/.test(use)) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const said = (text) => {
  const value = word(text);
  return value && !/^(NONE|OTHER|UNKNOWN)$/i.test(value) ? value : null;
};

function fromRow(row) {
  const unit = realUnit(word(row.PROPERTYUNIT));
  const address = streetParts({ number: row.PROPERTYHOUSENUM, numberSuffix: word(row.PROPERTYFRACTION) || '', name: word(row.PROPERTYADDRESS) || '', unit });
  const parcel = word(row.PARID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.USEDESC, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.PROPERTYHOUSENUM, row.PROPERTYFRACTION, row.PROPERTYADDRESS].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'municipality', word(row.MUNIDESC)?.replace(/\s+/g, ' '));
  put(facts, 'neighborhood', word(row.NEIGHDESC));
  put(facts, 'school_district', word(row.SCHOOLDESC));
  put(facts, 'land_use', word(row.USEDESC));
  put(facts, 'property_class', word(row.CLASSDESC));
  put(facts, 'county_use_code', word(row.USECODE));
  put(facts, 'legal_description', [row.LEGAL1, row.LEGAL2, row.LEGAL3].map(word).filter(Boolean).join(' ').slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YEARBLT));
    put(facts, 'style', said(row.STYLEDESC));
    put(facts, 'stories', inRange(row.STORIES, kind === 'building' ? 40 : 6));
    put(facts, 'exterior_walls', said(row.EXTFINISH_DESC));
    put(facts, 'roof_cover', said(row.ROOFDESC));
    put(facts, 'quality', said(row.GRADEDESC));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.FINISHEDLIVINGAREA));
    put(facts, 'bedrooms', inRange(row.BEDROOMS, 15));
    put(facts, 'rooms', inRange(row.TOTALROOMS, 40));
    const [full, half] = [inRange(row.FULLBATHS, 15), inRange(row.HALFBATHS, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'fireplaces', inRange(row.FIREPLACES, 20));
    put(facts, 'condition', said(row.CONDITIONDESC));
    // One column says both: "Central Heat with AC", "No Heat but with AC".
    const climate = said(row.HEATINGCOOLINGDESC) || '';
    put(facts, 'heating', /^No Heat/i.test(climate) ? null : climate.replace(/\s+with AC$/i, '') || null);
    if (/with AC$/i.test(climate)) facts.cooling = 'Air conditioning';
    put(facts, 'foundation', BASEMENTS[word(row.BASEMENTDESC)]);
    const stalls = inRange(row.BSMTGARAGE, 10);
    if (stalls) facts.garage = `${stalls} in the basement`;
  }
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(row.LOTAREA));
  put(facts, 'value_year', positive(row.TAXYEAR));
  put(facts, 'assessed_value', positive(row.COUNTYTOTAL));
  put(facts, 'assessed_land_value', positive(row.COUNTYLAND));
  put(facts, 'assessed_building_value', positive(row.COUNTYBUILDING));
  if (positive(row.SALEPRICE) > 100) {
    facts.sale_price = positive(row.SALEPRICE);
    put(facts, 'sale_date', isoDate(row.SALEDATE));
    if (word(row.DEEDBOOK) && word(row.DEEDPAGE)) facts.sale_document = `${word(row.DEEDBOOK)}-${word(row.DEEDPAGE)}`;
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.PROPERTYCITY) || '').toUpperCase(), zip: zipCode(row.PROPERTYZIP) }, facts };
}

async function* build({ work }) {
  const about = await getJson(`https://${DOMAIN}/api/3/action/resource_show?id=${RESOURCE}`, 'The table\'s description');
  const asOf = isoDate(about.result?.last_modified);
  if (!asOf) throw new Error('The table no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'pa-allegheny', 'assessments.jsonl.gz'), () => ckanRows(DOMAIN, RESOURCE, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'PA', name: COUNTY, publisher: 'Allegheny County Office of Property Assessments', dataset: 'property assessments, WPRDC', method: 'county', source: 'pa-allegheny', as_of: asOf, stale_after_days: 60, records,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: COLUMNS,
    facts: { year_built: 'YEARBLT', living_sqft: 'FINISHEDLIVINGAREA', bedrooms: 'BEDROOMS', full_baths: 'FULLBATHS', half_baths: 'HALFBATHS', rooms: 'TOTALROOMS', stories: 'STORIES', lot_sqft: 'LOTAREA', assessed_value: 'COUNTYTOTAL', assessed_land_value: 'COUNTYLAND', assessed_building_value: 'COUNTYBUILDING', sale_price: 'SALEPRICE', sale_date: 'SALEDATE', fireplaces: 'FIREPLACES', value_year: 'TAXYEAR' },
  },
};
