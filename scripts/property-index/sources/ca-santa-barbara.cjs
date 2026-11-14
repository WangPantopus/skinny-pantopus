'use strict';
// Santa Barbara County, California: the Clerk-Recorder-Assessor's "Assessor Parcels Public" layer on the county's ArcGIS Online, kept by its
// Mapping Department: each parcel with its Assessor roll characteristics. Its notice says the county assumes no liability for errors or for
// improper use, makes no representation of accuracy and that the data is for representational purposes; it states no license and no limit on
// use. Year built, living area, bedrooms, baths, acres and the roll's assessed land and structure values (Proposition 13). The layer holds no
// owner names; the homeowner's exemption and exemption columns are never asked for.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { bathFacts } = require('../lib/fill.cjs');
const { year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '06083';
const COUNTY = 'Santa Barbara County';
const LAYER = 'https://services.arcgis.com/KkJhFbLnXVqahKz2/arcgis/rest/services/Assessor_Parcels_Public1/FeatureServer/0';
const COLUMNS = ['APN', 'RollYear', 'Situs1', 'SUnitNumb', 'SCity', 'SZip', 'TRA', 'Acreage', 'LandUse', 'SqFootage', 'YearBuilt', 'Bedrooms', 'Bathrooms', 'LandValue', 'StrImpr'];

// The Assessor's land uses, in its own words. A rural home site counts as a house where it has a home's building facts; otherwise it's land.
function useOf(landUse, unit, row) {
  const use = String(landUse || '').trim().toUpperCase();
  const built = positive(row.SqFootage) && positive(row.Bedrooms);
  if (use === 'SINGLE FAMILY RESIDENCE' || (use === 'RANCHO ESTATES (RURAL HOME SITES)' && built)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (use === 'CONDOS,COMMUNITY APT PROJS') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (use === 'MOBILE HOMES') return ['property', 'mobile_home'];
  if (use === 'RESIDENTIAL INCOME, 2-4 UNITS') return ['building', 'multi_unit'];
  if (use === 'APARTMENTS, 5 OR MORE UNITS') return ['building', 'apartment'];
  if (use === 'VACANT' || use === 'RANCHO ESTATES (RURAL HOME SITES)') return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// The site line ends with the unit when there is one ("123 MAIN ST 4"); the unit column says which part that is.
function siteOf(row) {
  const line = String(row.Situs1 ?? '').replace(/\s+/g, ' ').trim();
  const unit = word(row.SUnitNumb) || '';
  const street = unit && line.toUpperCase().endsWith(` ${unit.toUpperCase()}`) ? line.slice(0, -unit.length - 1) : line;
  const parsed = parse(street, unit);
  if (!parsed || parsed.form !== 'street' || !parsed.number) return null;
  const { form, ...address } = parsed;
  return address;
}

function fromRow(row) {
  const address = siteOf(row);
  const parcel = word(row.APN);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.LandUse, address.unit, row);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.Situs1, ''));
  put(facts, 'land_use', word(row.LandUse));
  put(facts, 'tax_code_area', word(row.TRA));
  if (home || kind === 'building') put(facts, 'year_built', year(row.YearBuilt));
  if (home) {
    put(facts, 'living_sqft', positive(row.SqFootage));
    put(facts, 'bedrooms', inRange(row.Bedrooms, 15));
    // The Assessor's bath total counts quarter baths (1.75 has a three-quarter bath), as Los Angeles's does; it's kept as the county
    // gives it. Only a whole or half total also says its full and half baths (2.5 is two full baths and a half bath).
    const baths = Number(row.Bathrooms);
    if (baths > 0 && baths <= 12 && (baths * 4) % 1 === 0) {
      facts.bathrooms = baths;
      if ((baths * 2) % 1 === 0) Object.assign(facts, bathFacts(baths, 12));
    }
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.Acreage));
  // California's assessed values (Proposition 13): land and structures; their sum is the assessed total.
  const [land, building] = [positive(row.LandValue), positive(row.StrImpr)];
  put(facts, 'assessed_land_value', land);
  put(facts, 'assessed_building_value', building);
  put(facts, 'assessed_value', (land || 0) + (building || 0) || null);
  put(facts, 'value_year', positive(row.RollYear));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.SCity) || '').toUpperCase(), zip: zipCode(row.SZip) }, facts };
}

async function* build({ work, today }) {
  const info = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const edited = info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate;
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'ca-santa-barbara', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'CA', name: COUNTY, publisher: 'Santa Barbara County Clerk-Recorder-Assessor', dataset: 'Assessor Parcels Public', method: 'county', source: 'ca-santa-barbara', as_of: isoDate(edited || today.getTime()), stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YearBuilt', living_sqft: 'SqFootage', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms', full_baths: 'Bathrooms', half_baths: 'Bathrooms', lot_acres: 'Acreage', assessed_land_value: 'LandValue', assessed_building_value: 'StrImpr', value_year: 'RollYear' },
  },
};
