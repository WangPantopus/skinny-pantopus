'use strict';
// Cumberland County, Pennsylvania: the county's tax parcel layer with its assessment facts, which the county publishes as a public information service
// with a no-warranty notice and no limit on use. Year built, living area, bedrooms, baths, rooms, stories, deeded acres, assessed values (on the
// county's base year, never market), taxes and last sale. Owner, homestead and farmstead columns are never asked for. Some site addresses carry no
// ZIP, so the county's ZIPs from the Census fill in.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { hold } = require('../lib/held.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '42041';
const COUNTY = 'Cumberland County';
const LAYER = 'https://services1.arcgis.com/1Cfo0re3un0w6a30/arcgis/rest/services/Tax_Parcels/FeatureServer/0';
const COLUMNS = ['PID', 'PIN', 'SITUS', 'SITUS2', 'SITUS_ZIP', 'LUC', 'SUBDIVISIO', 'NBHD_ID', 'DEEDED_AC', 'CalcAcre', 'SQFT', 'LAND_VAL', 'BLDG_VAL', 'TOTAL_VAL', 'SALEPRICE', 'SALEDATE', 'YEAR_BLT', 'MUNI_NAME', 'SCHOOL_DIST', 'STORY_HEIG', 'DWELLING_T', 'FINISHED_B', 'FULL_BATH_', 'HALF_BATH_', 'TOTAL_ROOM', 'BEDROOM_CO', 'PRIMARY_EX', 'AIR_CONDIT', 'TOTALTAX'];

// Dwelling types as the county words them; a lot with no dwelling reads by its land use code (100, 600, 125 and 129 vacant, 2xx apartments).
function useOf(dwelling, luc, unit) {
  const d = String(dwelling || '').trim().toUpperCase();
  if (d === 'SINGLE FAMILY' || d === 'MODULAR HOME ON FOUNDATION') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (/TOWN HOUSE|ROW HOUSE|SEMI-DETACHED|DUPLEX HALF/.test(d)) return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (d === 'CONDOMINIUM UNIT') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/MANUFACTURED|MOBILE HOME/.test(d)) return ['property', 'mobile_home'];
  if (/DUPLEX|APARTMENTS/.test(d)) return ['building', 'multi_unit'];
  const code = /\((\d+)\)\s*$/.exec(String(luc || ''))?.[1];
  if (['100', '600', '125', '129'].includes(code)) return ['parcel', null];
  if (/^2[01]\d$/.test(code || '') && /APARTMENT/i.test(String(luc))) return ['building', 'apartment'];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  // A second line names a unit, or, after "&", a corner lot's other street.
  const second = String(row.SITUS2 ?? '').trim();
  const unit = /^(UNIT|APT|STE|SUITE|#)\s*\S+/i.test(second) ? second : '';
  const address = parse(String(row.SITUS ?? ''), unit);
  const parcel = word(row.PID) || word(row.PIN);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.DWELLING_T, row.LUC, address.unit);
  const facts = { parcel_number: word(row.PIN) || parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.SITUS, unit.replace(/^(UNIT|APT|STE|SUITE|#)\s*/i, '')));
  put(facts, 'land_use', word(row.LUC));
  put(facts, 'subdivision', word(row.SUBDIVISIO));
  put(facts, 'neighborhood', word(row.NBHD_ID));
  put(facts, 'municipality', word(row.MUNI_NAME));
  put(facts, 'school_district', word(row.SCHOOL_DIST));
  // 1776 stands in for an unknown year: every apartment parcel and some mobile homes carry it.
  if ((home || kind === 'building') && String(row.YEAR_BLT ?? '').trim() !== '1776') put(facts, 'year_built', year(row.YEAR_BLT));
  if (home) {
    put(facts, 'living_sqft', positive(row.SQFT));
    put(facts, 'bedrooms', inRange(row.BEDROOM_CO, 15));
    const [full, half] = [inRange(row.FULL_BATH_, 12), inRange(row.HALF_BATH_, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'rooms', inRange(row.TOTAL_ROOM, 40));
    put(facts, 'stories', inRange(row.STORY_HEIG, 5));
    put(facts, 'style', word(row.DWELLING_T));
    put(facts, 'exterior_walls', word(row.PRIMARY_EX));
    put(facts, 'cooling', word(row.AIR_CONDIT));
    put(facts, 'basement_finished_sqft', positive(row.FINISHED_B));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.DEEDED_AC) || positive(row.CalcAcre));
  put(facts, 'assessed_value', positive(row.TOTAL_VAL));
  put(facts, 'assessed_land_value', positive(row.LAND_VAL));
  put(facts, 'assessed_building_value', positive(row.BLDG_VAL));
  put(facts, 'tax_amount', positive(row.TOTALTAX));
  if (isHomeSale(positive(row.SALEPRICE))) {
    put(facts, 'sale_price', positive(row.SALEPRICE));
    put(facts, 'sale_date', isoDate(row.SALEDATE));
  }
  const record = { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: zipCode(row.SITUS_ZIP) || null }, facts };
  // Read since the county went live, held off its screens until its new_columns switch is on (lib/held.cjs): the story
  // height is written in words ("2 Stories", "1.5 Stories (Ul 50% Of Lla)"); split levels and bi-levels give no count.
  const stories = /^(\d(?:\.5)?) Stor(?:y|ies)\b/i.exec(String(row.STORY_HEIG ?? '').trim());
  if ((home || kind === 'building') && stories) hold(record, 'stories', Number(stories[1]));
  return record;
}

async function* build({ work }) {
  const info = await getJson(`${LAYER}?f=json`, 'The parcel layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The parcel layer no longer says when it changed');
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'pa-cumberland', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'PA', name: COUNTY, publisher: 'Cumberland County', dataset: 'tax parcels', method: 'county', source: 'pa-cumberland', as_of: asOf, stale_after_days: 60, extra_zips: zipsByCounty(work, ['42']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YEAR_BLT', living_sqft: 'SQFT', bedrooms: 'BEDROOM_CO', bathrooms: 'FULL_BATH_', full_baths: 'FULL_BATH_', half_baths: 'HALF_BATH_', rooms: 'TOTAL_ROOM', stories: 'STORY_HEIG', basement_finished_sqft: 'FINISHED_B', lot_acres: 'DEEDED_AC', assessed_value: 'TOTAL_VAL', assessed_land_value: 'LAND_VAL', assessed_building_value: 'BLDG_VAL', tax_amount: 'TOTALTAX', sale_price: 'SALEPRICE', sale_date: 'SALEDATE' },
  },
};
