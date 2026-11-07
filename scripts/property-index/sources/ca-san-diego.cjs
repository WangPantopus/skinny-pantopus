'use strict';
// San Diego County, California: SanGIS's parcel layer, from the County Assessor's weekly property records. SanGIS's end user
// agreement "discourages, but does not prohibit" redistributing its data; altered data can't be passed off as a SanGIS product
// or name SanGIS as its only source, so the record credits the Assessor and says it's derived from SanGIS. The layer has no owner
// names here; the owner-occupied flag isn't asked for. The dictionary says not to use YEAR_EFFECTIVE for a building's age, and it
// can't tell 1905 from 2005, so this county has no year built. Values are Proposition 13 assessed values. No sale prices.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '06073';
const COUNTY = 'San Diego County';
const SERVICE = 'https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0';
const COLUMNS = ['apn', 'situs_address', 'situs_fraction', 'situs_pre_dir', 'situs_street', 'situs_suffix', 'situs_post_dir', 'situs_suite', 'situs_zip', 'situs_community', 'legldesc', 'asr_land', 'asr_impr', 'acreage', 'tranum', 'nucleus_use_cd', 'unitqty', 'subname', 'total_lvg_area', 'bedrooms', 'baths', 'garage_stalls', 'carport_stalls', 'pool', 'sub_type', 'SHAPE__Area'];

// The layer's metadata, NUCLEUS_USE_CD, in its own words.
const USES = {
  '090': 'Manufactured home in park', '091': 'Manufactured home in rental park', '092': 'MH in condo/subdivision park', '093': 'MH in planned unit development (PUD) park', '094': 'Manufactured home in co-op park', '095': 'MH in long term lease park', '096': 'MH on Indian reservation', '097': 'MH on leased land', '099': 'MH on private property',
  109: 'Single family residence with ADU', 110: 'Single family residence', 111: 'Single family residence', 112: 'Single family residence w/granny flat', 113: 'Single family gated community', 114: 'Single family attached/PUD', 115: 'Single family detached/PUD', 116: 'Single family residence w/shared water sys', 117: 'Single family with ag buildings', 118: 'Single family residence attached - age restricted', 119: 'Single family residence detached - age restricted',
  120: 'Duplex', 130: '2 - 4 units', 140: '5 - 15 units', 150: '16 - 60 units', 152: '16 - 60 units senior housing', 153: '16 - 60 units - restricted rents', 160: '61 units and up', 162: '61 units and up senior housing', 163: '61 units and up restricted housing',
  170: 'Condos and other res classifications', 171: 'Condos attached', 172: 'Condos detached', 173: '2 unit project', 174: 'Separate sub-ids-project operated as lg apt', 175: 'Condos attached - age restricted', 176: 'Condos detached - age restricted', 180: 'Co-op', 182: 'Co-op on leased land',
};

function useOf(code, hasLiving) {
  const n = Number(code);
  if ((n >= 90 && n <= 97) || n === 99) return ['property', 'mobile_home'];
  if (n === 114 || n === 118) return ['property', 'townhouse'];
  if (n >= 109 && n <= 119) return ['property', 'house'];
  if (n === 120 || n === 130) return ['building', 'multi_unit'];
  if (n >= 140 && n <= 163) return ['building', 'apartment'];
  if ((n >= 170 && n <= 176) || n === 180 || n === 182) return ['unit', 'condo'];
  if (n === 100 || n === 200 || (n >= 190 && n <= 193)) return hasLiving && n === 100 ? ['property', 'house'] : ['parcel', null];
  return ['other', null];
}

// Bedrooms are three digits, baths three digits with an implied decimal ("025" is 2.5).
const count = (text, most) => {
  const value = positive(String(text ?? '').trim());
  return value && value <= most ? value : null;
};

function fromRow(row, valueYear) {
  const unit = realUnit(word(row.situs_suite));
  const address = streetParts({ number: row.situs_address, numberSuffix: word(row.situs_fraction) || '', pre: word(row.situs_pre_dir) || '', name: word(row.situs_street) || '', suffix: word(row.situs_suffix) || '', post: word(row.situs_post_dir) || '', unit });
  const parcel = word(row.apn);
  if (!address || !parcel) return null;
  const code = String(row.nucleus_use_cd ?? '').trim().padStart(3, '0');
  const living = positive(row.total_lvg_area);
  const [kind, homeType] = useOf(code, Boolean(living));
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.situs_address, row.situs_fraction, row.situs_pre_dir, row.situs_street, row.situs_suffix, row.situs_post_dir].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'tax_code_area', word(row.tranum));
  put(facts, 'land_use', USES[Number(code)] || USES[code]);
  put(facts, 'county_use_code', code);
  put(facts, 'subdivision', word(row.subname));
  put(facts, 'legal_description', word(row.legldesc)?.slice(0, 300));
  if (home) {
    put(facts, 'living_sqft', living);
    put(facts, 'bedrooms', count(row.bedrooms, 15));
    const baths = count(row.baths, 150);
    put(facts, 'bathrooms', baths && baths / 10);
    const stalls = count(row.garage_stalls, 30);
    put(facts, 'parking_spaces', stalls);
    if (stalls) facts.garage = `${stalls} ${stalls === 1 ? 'stall' : 'stalls'}`;
    if (/^Y$/i.test(row.pool || '')) facts.pool = 'Yes';
  }
  if (kind === 'building') put(facts, 'units', positive(row.unitqty));
  // A coach in a park sits on the park's parcel: the polygon and the acres are the whole park's.
  if (kind !== 'unit' && homeType !== 'mobile_home') {
    // Acreage only fills past half an acre; the parcel's own polygon, in California state plane feet, says the rest.
    const acres = positive(row.acreage);
    if (acres) facts.lot_acres = acres;
    else put(facts, 'lot_sqft', positive(row.SHAPE__Area) && Math.round(row.SHAPE__Area));
  }
  const [land, building] = [positive(row.asr_land), positive(row.asr_impr)];
  put(facts, 'value_year', valueYear);
  put(facts, 'assessed_land_value', land);
  put(facts, 'assessed_building_value', building);
  put(facts, 'assessed_value', (land || 0) + (building || 0) || null);
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.situs_community) || '').toUpperCase(), zip: zipCode(row.situs_zip) }, facts };
}

async function* build({ work }) {
  const info = await getJson(`${SERVICE}?f=json`, 'The layer\'s description');
  const asOf = isoDate(info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'ca-san-diego', 'parcels.jsonl.gz'), () => layerRows(SERVICE, COLUMNS, { oid: 'objectid', pageSize: 2000 }))) {
    const record = fromRow(row, Number(asOf.slice(0, 4)));
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'CA', name: COUNTY, publisher: 'San Diego County Assessor, derived from SanGIS', dataset: 'parcels', method: 'county', source: 'ca-san-diego', as_of: asOf, stale_after_days: 90, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: SERVICE,
    facts: { living_sqft: 'total_lvg_area', bedrooms: 'bedrooms', bathrooms: 'baths', units: 'unitqty', lot_acres: 'acreage', assessed_land_value: 'asr_land', assessed_building_value: 'asr_impr' },
    text: `${SERVICE}/metadata`,
    words: { nucleus_use_cd: { 91: { said: 'MANUFACTURED HOME IN RENTAL PARK' }, 111: { said: 'SINGLE FAMILY RESIDENCE' }, 112: { said: 'SINGLE FAMILY RESIDENCE W/GRANNY FLAT' }, 114: { said: 'SINGLE FAMILY ATTACHED/PUD' }, 115: { said: 'SINGLE FAMILY DETACHED/PUD' }, 120: { said: 'DUPLEX - GENERIC' }, 130: { said: '2 - 4 UNITS - GENERIC' }, 140: { said: '5 - 15 UNITS GENERIC' }, 160: { said: '61 UNITS AND UP GENERIC' }, 171: { said: 'CONDOS ATTACHED' }, 172: { said: 'CONDOS DETACHED' }, 180: { said: 'CO-OP GENERIC' } } },
  },
};
