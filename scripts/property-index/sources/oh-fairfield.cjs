'use strict';
// Fairfield County, Ohio: the Auditor's parcel boundaries with each parcel's appraisal facts, on the county's GIS open data service. The Auditor's
// GIS downloads page says its data was developed from public records, isn't warranted for content, completeness or accuracy or fit for any
// particular use, and asks to hear of discrepancies; it states no license and no limit on use. Year built, living area, bedrooms, baths, rooms,
// stories, walls, heating, basement, acres and appraised values. Owner and mailing columns are never asked for. Parcels carry no site city or ZIP,
// so the county's ZIPs come from the Census. Style and sale validity are codes the county publishes no words for, so sales and styles are left out.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39045';
const COUNTY = 'Fairfield County';
const LAYER = 'https://gis.co.fairfield.oh.us/arcgis/rest/services/OpenData/ParcelBoundaries/MapServer/0';
const COLUMNS = ['PIN', 'PARID', 'ADRNO', 'ADRDIR', 'ADRSTR', 'ADRSUF', 'ADRSUF2', 'PADDR1', 'LEGAL1', 'ACRES', 'LUC', 'NBHD', 'STORIES', 'EXTWALL', 'SFLA', 'YRBLT', 'RMTOT', 'RMBED', 'FIXBATH', 'FIXHALF', 'BSMT', 'HEAT', 'FINBSMTARE', 'APRLAND', 'APRBLDG', 'APPRVAL', 'Shape_Area'];

// The Auditor's own code tables (its CAMA download's EXTWALL, BSMT and HEAT files), in plainer words.
const WALLS = { 1: 'Frame', 2: 'Brick', 3: 'Masonry and frame', 4: 'Block', 5: 'Stucco', 6: 'Aluminum or vinyl', 7: 'Stone', 8: 'Asbestos', 9: 'Concrete', 10: 'Metal' };
const BASEMENTS = { 2: 'Crawl space', 3: 'Part basement', 4: 'Full basement' };

// Ohio's land use codes: 510-515 a one-family dwelling (by lot size), 550 a condominium unit, 560 a mobile home, 520 and 530 two and three
// families, 401-403 apartments, 500-505 residential vacant land.
function useOf(code, unit) {
  const c = String(code || '').trim();
  if (/^51[0-5]$/.test(c)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === '550') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === '560') return ['property', 'mobile_home'];
  if (c === '520' || c === '530') return ['building', 'multi_unit'];
  if (/^40[1-3]$/.test(c)) return ['building', 'apartment'];
  if (/^50[0-5]$/.test(c)) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// The address line carries a unit where the parts don't ("123 MAIN ST NW UNIT 4"); the parts are read when the line won't parse.
function siteOf(row) {
  const parsed = parse(String(row.PADDR1 ?? ''));
  if (parsed && parsed.form === 'street' && parsed.number && Number(parsed.number) > 0) {
    const { form, ...street } = parsed;
    return street;
  }
  if (!(Number(row.ADRNO) > 0)) return null;
  return streetParts({ number: String(row.ADRNO), pre: word(row.ADRDIR) || '', name: word(row.ADRSTR) || '', suffix: word(row.ADRSUF) || '', post: word(row.ADRSUF2) || '' });
}

function fromRow(row) {
  const address = siteOf(row);
  const parcel = word(row.PARID) || word(row.PIN);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.LUC, address.unit);
  const facts = { parcel_number: word(row.PIN) || parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.PADDR1, ''));
  put(facts, 'county_use_code', word(row.LUC));
  put(facts, 'neighborhood', word(row.NBHD));
  put(facts, 'legal_description', word(row.LEGAL1)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YRBLT));
    put(facts, 'stories', inRange(row.STORIES, 5));
    put(facts, 'exterior_walls', WALLS[Number(row.EXTWALL)] || null);
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.SFLA));
    put(facts, 'bedrooms', inRange(row.RMBED, 15));
    const [full, half] = [inRange(row.FIXBATH, 12), inRange(row.FIXHALF, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'rooms', inRange(row.RMTOT, 40));
    put(facts, 'foundation', BASEMENTS[Number(row.BSMT)] || null);
    put(facts, 'basement_finished_sqft', positive(row.FINBSMTARE));
    // Heat codes: 2 basic, 3 air conditioning (with its heat), 4 a heat pump.
    const heat = Number(row.HEAT);
    if (heat === 3) put(facts, 'cooling', 'Air conditioning');
    if (heat === 4) put(facts, 'heating', 'Heat pump');
  }
  // A condominium's parcel is its share of the complex, so a condo unit gets no lot. The layer's own area is in Ohio South state plane feet.
  if (kind !== 'unit' && String(row.LUC || '').trim() !== '550') {
    if (positive(row.ACRES)) put(facts, 'lot_acres', positive(row.ACRES));
    else put(facts, 'lot_sqft', positive(row.Shape_Area) >= 100 ? Math.round(positive(row.Shape_Area)) : null);
  }
  put(facts, 'market_value', positive(row.APPRVAL));
  put(facts, 'market_land_value', positive(row.APRLAND));
  put(facts, 'market_building_value', positive(row.APRBLDG));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: null }, facts };
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'oh-fairfield', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { pageSize: 1000 }))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Fairfield County Auditor', dataset: 'parcel boundaries with appraisal data', method: 'county', source: 'oh-fairfield', as_of: isoDate(today.getTime()), stale_after_days: 450, extra_zips: zipsByCounty(work, ['39']).get(FIPS) || [], records: list,
  };
}

// The parcel layer's own shapes, by the parcel number each record carries (the same columns): what lib/measure.cjs
// measures a lot's area and counts its buildings on (measured rows, held off until the county's measured_rows switch is on).
const parcelShapes = { url: LAYER, fields: ['PIN', 'PARID'], key: (row) => word(row.PIN) || word(row.PARID), pageSize: 1000 };

module.exports = {
  parcelShapes,
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YRBLT', living_sqft: 'SFLA', bedrooms: 'RMBED', bathrooms: 'FIXBATH', full_baths: 'FIXBATH', half_baths: 'FIXHALF', rooms: 'RMTOT', stories: 'STORIES', basement_finished_sqft: 'FINBSMTARE', lot_acres: 'ACRES', lot_sqft: 'Shape_Area', market_value: 'APPRVAL', market_land_value: 'APRLAND', market_building_value: 'APRBLDG' },
  },
};
