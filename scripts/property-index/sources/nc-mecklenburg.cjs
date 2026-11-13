'use strict';
// Mecklenburg County, North Carolina: the county's own CAMA parcel service, with the bedrooms and baths the statewide parcels lack. No
// terms are stated on the service. Owner, mailing, grantor and exemption columns are in the layer and never asked for; the layer's zipcode
// sits with the mailing columns, so a home's ZIP isn't read from it and the county's ZIPs come from the Census list. totmarkval is the
// county's market value at its last revaluation. Its address column runs on into the town and is only read for a condo's unit.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '37119';
const COUNTY = 'Mecklenburg County';
const LAYER = 'https://meckgis.mecklenburgcountync.gov/server/rest/services/TaxParcel_camadata/FeatureServer/0';
const COLUMNS = ['parcelid', 'pid', 'nc_pin', 'gisacres', 'address', 'yearid', 'lusecode', 'landuse_description', 'neighbordesc', 'saleprice', 'saledate', 'streetname', 'streetnumber', 'totlandval', 'totalbldgval', 'totmarkval', 'legaldesc', 'deed_book', 'deed_page', 'heatedarea', 'extwall', 'storyheight', 'bldgtype', 'foundation', 'roofcover', 'heat', 'heatfuel', 'frame', 'yearbuilt', 'effyearblt', 'fullbath', 'halfbath', 'threequabath', 'fireplaces', 'percntac', 'resunits', 'bedrooms', 'grade', 'totgararea', 'totcrpoarea', 'totalarea', 'basearea', 'fingarage', 'unfingarag', 'taxmundist', 'typeofdeed', 'naldesc'];

function useOf(row, unit) {
  const use = String(row.landuse_description || '').toUpperCase().trim();
  const type = String(row.bldgtype || '').toUpperCase();
  if (/^CONDOMINIUM/.test(use) || /RESIDENTIAL CONDO/.test(type)) return ['unit', 'condo'];
  if (/^TOWN ?HOUSE/.test(use) || type === 'TOWNHOUSE') return ['property', 'townhouse'];
  if (/MANUFACTURED/.test(use) || /MANUFACTURED/.test(type)) return ['property', 'mobile_home'];
  // Its homesite, affordable-housing and mobile-home-subdivision land uses hold ordinary houses: the building type says so.
  if (/^SINGLE FAMILY/.test(use) || (/HOMESITE|AFFORDABLE|MOBILE HOME SUB/.test(use) && /^SINGLE FAMILY/.test(type))) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (/DUPLEX|TRIPLEX/.test(use) || /DUPLEX/.test(type)) return ['building', 'multi_unit'];
  if (/^MULTI FAMIL/.test(use)) return ['building', 'apartment'];
  if (/^VACANT/.test(use)) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const said = (text) => {
  const value = word(text);
  return value && !/^(NONE|UNKNOWN)$/i.test(value) ? value : null;
};

// A sale's qualification that says the price isn't this home's: the buildings were left out of it.
const NOT_THIS_SALE = /IMPROVEMENTS NOT INCLUDED/;
// The legal description's platted lot: "L12 B3 M45-678".
const lotOf = (legal) => /^L(\d+[A-Z]?)\s+(?:B\S+\s+)?M\d/.exec(String(legal ?? '').trim())?.[1] || null;

// The address column ends in the town; a condo's reads "123 MAIN ST, 4B CHARLOTTE". Only the unit is taken from it.
const unitOf = (text) => /,\s*(\S+)\s/.exec(String(text ?? ''))?.[1] || '';

function fromRow(row) {
  const unit = realUnit(unitOf(row.address));
  const address = streetParts({ number: row.streetnumber, name: word(row.streetname) || '', unit });
  // A condo complex's units share a pid; parcelid is each unit's own.
  const parcel = word(row.parcelid) || word(row.pid);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.streetnumber, row.streetname].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(row.landuse_description));
  put(facts, 'county_use_code', word(row.lusecode));
  put(facts, 'neighborhood', word(row.neighbordesc));
  put(facts, 'legal_description', word(row.legaldesc)?.slice(0, 300));
  put(facts, 'lot_number', lotOf(row.legaldesc));
  const town = word(row.taxmundist);
  if (town && town !== 'na') facts.municipality = /UNINCORPORATED/.test(town) ? 'Unincorporated Mecklenburg County' : town;
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.yearbuilt));
    put(facts, 'effective_year_built', year(row.effyearblt));
    put(facts, 'building_type', said(row.bldgtype));
    const story = /^(\d+(\.\d+)?)/.exec(String(row.storyheight ?? '').trim());
    put(facts, 'stories', story ? inRange(story[1], kind === 'building' ? 60 : 6) : null);
    if (!story) put(facts, 'style', said(row.storyheight));
    put(facts, 'exterior_walls', said(row.extwall));
    put(facts, 'roof_cover', said(row.roofcover));
    put(facts, 'foundation', said(row.foundation));
    put(facts, 'frame', said(row.frame));
    put(facts, 'quality', said(row.grade));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.heatedarea));
    put(facts, 'bedrooms', inRange(row.bedrooms, 15));
    const [full, threeQuarter, half] = [inRange(row.fullbath, 15), inRange(row.threequabath, 10), inRange(row.halfbath, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'three_quarter_baths', threeQuarter);
    put(facts, 'half_baths', half);
    if (full || threeQuarter || half) facts.bathrooms = (full || 0) + (threeQuarter || 0) * 0.75 + (half || 0) * 0.5;
    put(facts, 'fireplaces', inRange(row.fireplaces, 20));
    put(facts, 'heating', said(row.heat));
    put(facts, 'heating_fuel', said(row.heatfuel));
    if (positive(row.percntac)) facts.cooling = 'Air conditioning';
    put(facts, 'garage_sqft', positive(row.totgararea));
    put(facts, 'carport_sqft', positive(row.totcrpoarea));
    put(facts, 'gross_sqft', positive(row.totalarea));
    if (kind === 'property') put(facts, 'ground_floor_sqft', positive(row.basearea));
    const garages = [positive(row.fingarage) && 'Finished', positive(row.unfingarag) && 'Unfinished'].filter(Boolean);
    if (garages.length) facts.garage = garages.join(', ');
    const parking = [positive(row.totgararea) && 'Garage', positive(row.totcrpoarea) && 'Carport'].filter(Boolean);
    if (parking.length) facts.parking_type = parking.join(', ');
  }
  if (kind === 'building') put(facts, 'units', positive(row.resunits));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.gisacres));
  put(facts, 'value_year', positive(row.yearid));
  put(facts, 'market_value', positive(row.totmarkval));
  put(facts, 'market_land_value', positive(row.totlandval));
  put(facts, 'market_building_value', positive(row.totalbldgval));
  if (isHomeSale(positive(row.saleprice), row.naldesc) && word(row.typeofdeed) !== 'QC' && !NOT_THIS_SALE.test(row.naldesc || '')) {
    facts.sale_price = positive(row.saleprice);
    put(facts, 'sale_date', isoDate(row.saledate));
    if (word(row.deed_book) && word(row.deed_page)) facts.sale_document = `${word(row.deed_book)}-${word(row.deed_page)}`;
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: '' }, facts };
}

async function* build({ work, today }) {
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'nc-mecklenburg', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { oid: 'objectid_1' }))) {
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
    fips: FIPS, state: 'NC', name: COUNTY, publisher: 'Mecklenburg County Assessor', dataset: 'CAMA parcels', method: 'county', source: 'nc-mecklenburg', as_of: isoDate(today.getTime()), stale_after_days: 400, extra_zips: zipsByCounty(work, ['37']).get(FIPS) || [], records,
  };
}

// The parcel layer's own shapes, by the parcel number each record carries (the same columns): what lib/measure.cjs
// measures a lot's area and counts its buildings on (measured rows, held off until the county's measured_rows switch is on).
const parcelShapes = { url: LAYER, fields: ['parcelid', 'pid'], key: (row) => word(row.parcelid) || word(row.pid), oid: 'objectid_1' };

module.exports = {
  parcelShapes,
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'yearbuilt', effective_year_built: 'effyearblt', living_sqft: 'heatedarea', bedrooms: 'bedrooms', full_baths: 'fullbath', half_baths: 'halfbath', fireplaces: 'fireplaces', garage_sqft: 'totgararea', units: 'resunits', lot_acres: 'gisacres', market_value: 'totmarkval', market_land_value: 'totlandval', market_building_value: 'totalbldgval', sale_price: 'saleprice', sale_date: 'saledate' },
  },
};
