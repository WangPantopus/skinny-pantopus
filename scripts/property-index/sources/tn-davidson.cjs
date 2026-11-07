'use strict';
// Davidson County, Tennessee: Metro Nashville's public ownership parcels, from its Assessor. No terms are stated on the service. Owner and
// mailing columns are in the layer and never asked for. TotlAppr is the Assessor's appraised value at its last reappraisal; homes are
// assessed at a quarter of it. No year built, bedrooms or baths.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { isoDate, zipCode, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '47037';
const COUNTY = 'Davidson County';
const LAYER = 'https://maps.nashville.gov/arcgis/rest/services/Cadastral/Cadastral_Layers/MapServer/4';
const COLUMNS = ['ParID', 'STANPAR', 'IsActive', 'PropAddr', 'PropSuite', 'PropCity', 'PropZip', 'LegalDesc', 'LUCode', 'LUDesc', 'DUCount', 'Acres', 'DeededAcreage', 'FinishArea', 'SalePrice', 'OwnDate', 'LandAppr', 'ImprAppr', 'TotlAppr', 'LandAssd', 'ImprAssd', 'TotlAssd', 'Zoning'];

function useOf(words, unit) {
  const use = String(words || '').toUpperCase();
  if (/CONDO/.test(use) && /RESIDENTIAL/.test(use)) return ['unit', 'condo'];
  if (use === 'SINGLE FAMILY') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (use === 'ZERO LOT LINE') return ['property', 'townhouse'];
  if (use === 'DUPLEX' || use === 'TRIPLEX' || use === 'QUADPLEX') return ['building', 'multi_unit'];
  if (/APARTMENT|MULTI-?FAMILY/.test(use)) return ['building', 'apartment'];
  if (/MOBILE HOME/.test(use)) return ['property', 'mobile_home'];
  if (/^VACANT/.test(use)) return ['parcel', null];
  return ['other', null];
}

function fromRow(row) {
  const line = word(row.PropAddr);
  const address = line ? parse(line, realUnit(word(row.PropSuite))) : null;
  const parcel = word(row.ParID) || word(row.STANPAR);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.LUDesc, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(line, row.PropSuite));
  put(facts, 'land_use', word(row.LUDesc));
  put(facts, 'county_use_code', word(row.LUCode));
  put(facts, 'zoning', word(row.Zoning));
  put(facts, 'legal_description', word(row.LegalDesc)?.slice(0, 300));
  if (home) put(facts, 'living_sqft', positive(row.FinishArea));
  if (kind === 'building') put(facts, 'units', positive(row.DUCount));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.DeededAcreage) || positive(row.Acres));
  put(facts, 'market_value', positive(row.TotlAppr));
  put(facts, 'market_land_value', positive(row.LandAppr));
  put(facts, 'market_building_value', positive(row.ImprAppr));
  put(facts, 'assessed_value', positive(row.TotlAssd));
  put(facts, 'assessed_land_value', positive(row.LandAssd));
  put(facts, 'assessed_building_value', positive(row.ImprAssd));
  if (positive(row.SalePrice) > 100) {
    facts.sale_price = positive(row.SalePrice);
    put(facts, 'sale_date', isoDate(row.OwnDate));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.PropCity) || '').toUpperCase(), zip: zipCode(row.PropZip) }, facts };
}

async function* build({ work, today }) {
  const records = [];
  const seen = new Set();
  let [noAddress, inactive] = [0, 0];
  for await (const row of cached(path.join(work, 'tn-davidson', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { where: "IsActive = 'Y' OR IsActive IS NULL" }))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number, ${inactive} inactive`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'TN', name: COUNTY, publisher: 'Metro Nashville Assessor of Property', dataset: 'ownership parcels', method: 'county', source: 'tn-davidson', as_of: isoDate(today.getTime()), stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { living_sqft: 'FinishArea', units: 'DUCount', lot_acres: 'DeededAcreage', market_value: 'TotlAppr', market_land_value: 'LandAppr', market_building_value: 'ImprAppr', assessed_value: 'TotlAssd', assessed_land_value: 'LandAssd', assessed_building_value: 'ImprAssd', sale_price: 'SalePrice', sale_date: 'OwnDate' },
  },
};
