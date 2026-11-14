'use strict';
// James City County, Virginia: the county's parcel layer on its own GIS server, shared on its open data site by the Real Estate Assessment
// Division's Mapping/GIS section, with the Assessor's facts on each parcel. Its notice says the data is believed correct but not guaranteed,
// that the county isn't responsible for its accuracy or how current it is, and asks that this disclaimer go on products made from it; it
// states no license and no limit on use. So the county's source line carries "believed correct, not guaranteed by the county" wherever
// Pantopus names it. Year built, finished area, bedrooms, full and half baths (the county's own field list: Num3Baths is the full bath count,
// Num2Baths the half bath count), rooms, stories, recorded acres, the current land, improvement and total assessments (Virginia assesses at
// full market value) and the last sale. Owner, mailing and seller columns are never asked for.
// Each parcel's address is the county's own address point for it (number, street, unit), which spells streets out in full where the
// Assessor's line is cut short. The state property class says single family, multi-family, commercial, farm or exempt; the layer names no
// house or townhouse, so a single-family home is a home of no named type, a condominium where its legal description says so (a unit, "U-").

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '51095';
const COUNTY = 'James City County';
const LAYER = 'https://property.jamescitycountyva.gov/arcgis/rest/services/JCC/GIS_Data/FeatureServer/17';
const COLUMNS = ['PIN', 'PropClas', 'PCDesc', 'Full_Address', 'APT', 'City', 'Zip_Code', 'Legal1', 'SUBNAME', 'Primary_Zone', 'Stories', 'YrBuilt', 'FinSize', 'NumRms', 'NumBdRms', 'Num2Baths', 'Num3Baths', 'LegalAc', 'CurLand', 'CurImp', 'CurTot', 'Sale1D', 'Sale1Amt', 'Shape__Area'];

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// A condominium unit's legal description names its regime or starts with its unit ("U-202 BLDG-1 PH-1 ...").
const isCondo = (row) => /\bCONDO/i.test(row.Legal1 ?? '') || /^\s*U-\s?\w/i.test(row.Legal1 ?? '');

// Virginia's state property classes: 501 and 502 single family (suburban, urban), 503 multi-family, 1xx agricultural, 404 commercial and
// industrial, 6xx exempt, 808 assessed by the State Corporation Commission. A farm with a home's facts is a home.
function useOf(row, unit) {
  const cls = Number(row.PropClas);
  const home = positive(row.NumBdRms) || (positive(row.FinSize) && positive(row.Num3Baths));
  if ((cls === 501 || cls === 502 || (cls >= 100 && cls < 200)) && home) {
    if (unit) return ['unit', isCondo(row) ? 'condo' : null];
    return ['property', isCondo(row) ? 'townhouse' : null];
  }
  if (cls === 503) return ['building', 'multi_unit'];
  if (cls === 501 || cls === 502 || (cls >= 100 && cls < 200)) return ['parcel', null];
  return ['other', null];
}

function siteOf(row) {
  const line = String(row.Full_Address ?? '').replace(/\s+/g, ' ').trim();
  const parsed = line ? parse(line) : null;
  if (!parsed || parsed.form !== 'street' || !parsed.number) return null;
  const { form, ...street } = parsed;
  return street;
}

function fromRow(row) {
  const address = siteOf(row);
  const parcel = word(row.PIN);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.Full_Address, ''));
  put(facts, 'property_class', word(row.PCDesc));
  put(facts, 'subdivision', word(row.SUBNAME));
  put(facts, 'zoning', word(row.Primary_Zone));
  put(facts, 'legal_description', word(row.Legal1)?.slice(0, 300));
  if (home || kind === 'building') put(facts, 'year_built', year(row.YrBuilt));
  if (home) {
    put(facts, 'stories', inRange(row.Stories, 5));
    put(facts, 'living_sqft', positive(row.FinSize));
    put(facts, 'bedrooms', inRange(row.NumBdRms, 15));
    const [full, half] = [inRange(row.Num3Baths, 12), inRange(row.Num2Baths, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'rooms', inRange(row.NumRms, 40));
  }
  if (kind === 'building') put(facts, 'gross_sqft', positive(row.FinSize));
  // The acres recorded at the courthouse. A condominium's parcel without them is its share of the complex (the unit's footprint), so it gets
  // no lot; any other lot without them takes its parcel's own area (the layer is in Virginia South state plane feet).
  if (kind !== 'unit') {
    if (positive(row.LegalAc)) put(facts, 'lot_acres', positive(row.LegalAc));
    else if (homeType !== 'townhouse') put(facts, 'lot_sqft', positive(row.Shape__Area) >= 100 ? Math.round(positive(row.Shape__Area)) : null);
  }
  put(facts, 'market_value', positive(row.CurTot));
  put(facts, 'market_land_value', positive(row.CurLand));
  put(facts, 'market_building_value', positive(row.CurImp));
  const price = positive(row.Sale1Amt);
  if (isHomeSale(price)) {
    put(facts, 'sale_price', price);
    put(facts, 'sale_date', isoDate(row.Sale1D));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.City) || '').toUpperCase(), zip: zipCode(row.Zip_Code) }, facts };
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'va-james-city', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  // The layer doesn't say when it last changed, so the release is dated by the day it was read.
  yield {
    fips: FIPS, state: 'VA', name: COUNTY, publisher: 'James City County', dataset: 'parcels (Real Estate Assessment Division, Mapping/GIS)', method: 'county', source: 'va-james-city', as_of: isoDate(today.getTime()), stale_after_days: 450, notice: 'believed correct, not guaranteed by the county', extra_zips: zipsByCounty(work, ['51']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YrBuilt', living_sqft: 'FinSize', gross_sqft: 'FinSize', bedrooms: 'NumBdRms', bathrooms: 'Num3Baths', full_baths: 'Num3Baths', half_baths: 'Num2Baths', rooms: 'NumRms', stories: 'Stories', lot_acres: 'LegalAc', lot_sqft: 'Shape__Area', market_value: 'CurTot', market_land_value: 'CurLand', market_building_value: 'CurImp', sale_price: 'Sale1Amt', sale_date: 'Sale1D' },
  },
};
