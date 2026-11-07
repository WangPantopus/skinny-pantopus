'use strict';
// Berks County, Pennsylvania: the Assessment Department's CAMA residential file on the county's GIS site, with its published data dictionary. Year built,
// living area, bedrooms, baths, stories, rooms, fireplaces and assessed values. The county's terms: its data may not be copied or redistributed in its
// original format, and a product that incorporates it says "Information is based on geospatial data from the County of Berks": the record's dataset
// line says so. Values stand on the county's 1994 base year: assessed, never market. Owner and mailing columns are never asked for; the site address's
// city and ZIP come from the county's parcel layer.

const path = require('node:path');
const { layerRows, offsetRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '42011';
const COUNTY = 'Berks County';
const BASE = 'https://services3.arcgis.com/dGYe1jDYrTw1wwpc/arcgis/rest/services';
const RESIDENTIAL = `${BASE}/Berks_Assessment_CAMA_Residential_File/FeatureServer/15`;
const PARCELS = `${BASE}/Berks_County_Parcels_V2/FeatureServer/2`;
const COLUMNS = ['PARID', 'CARD', 'TAXYR', 'ADRNO', 'ADRADD', 'ADRDIR', 'ADRSTR', 'ADRSUF', 'TOTACRES', 'LUC', 'LIVUNITS', 'STORIES', 'YRBLT', 'BEDROOMS', 'FULLBATHS', 'HALFBATHS', 'SFLA', 'TOTROOMS', 'WBFP_OPENINGS', 'MET_FIREPL', 'LAND_VALUE', 'BLDG_VALUE', 'TOTAL_VALUE', 'PRICE', 'SALEDT'];
// Land use codes by kind, read from the county's CAMA data dictionary (residential codes; "/ROW" and "DOUBLE" share a wall).
const KINDS = {
  parcel: '100A 100B 151 160 600 800',
  house: '101 101P 102 102P 103 103P 104 104P 105 105A 105B 105P 106 106P 107 107P 108 108P 109 109P 110 110P 111 111P 112 112P 113 113P 114 114P 115 115P 116 117 117P 118 119 120 121 121A 121B 121P 143 143P 144 144P 145 145P 190 191 801 801P',
  townhouse: '101H 101R 102H 102R 104R 105R 106R 107R 110R 111R 112R 113R 114R 115R 116R 117R 118R 119R 120R 121C 121D 121R 149 149P 149R 161 161P 161R 162 162R 163 163P',
  multi_unit: '122 122R 123 123R 124 125 125P 126 127 128 129 130 130R 131 132 132P 132R 133 133P 133R 134 134P 135 136 136A 136R 137 137P 137R 138 138R 139 139R 140 140R 141',
  mobile_home: '146 146P 147 148',
  other: '150 150P 150R 153 153P 153R 154 802',
  condo: '152',
};
const KIND_OF = new Map(Object.entries(KINDS).flatMap(([kind, codes]) => codes.split(' ').map((code) => [code, kind])));
const USES = {
  house: (unit) => (unit ? ['unit', 'condo'] : ['property', 'house']),
  townhouse: (unit) => (unit ? ['unit', 'condo'] : ['property', 'townhouse']),
  condo: (unit) => (unit ? ['unit', 'condo'] : ['property', 'townhouse']),
  mobile_home: () => ['property', 'mobile_home'],
  multi_unit: () => ['building', 'multi_unit'],
  parcel: () => ['parcel', null],
  other: () => ['other', null],
};

function fromRow(row, place) {
  const unit = word(row.ADRADD) && !/^\d+\/\d+$/.test(row.ADRADD) ? word(row.ADRADD) : '';
  const address = streetParts({ number: row.ADRNO, pre: row.ADRDIR, name: word(row.ADRSTR), suffix: word(row.ADRSUF), unit });
  const parcel = word(row.PARID);
  if (!address || !parcel) return null;
  const code = String(row.LUC || '').trim().toUpperCase();
  const [kind, homeType] = (USES[KIND_OF.get(code)] || USES.other)(address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.ADRNO, row.ADRDIR, row.ADRSTR, row.ADRSUF].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'county_use_code', code);
  if (home || kind === 'building') put(facts, 'year_built', year(row.YRBLT));
  if (home) {
    put(facts, 'living_sqft', positive(row.SFLA));
    const beds = positive(row.BEDROOMS);
    if (beds && beds <= 15) facts.bedrooms = beds;
    const [full, half] = [positive(row.FULLBATHS), positive(row.HALFBATHS)];
    if (full && full <= 12) {
      facts.full_baths = full;
      facts.bathrooms = full + (half && half <= 6 ? half * 0.5 : 0);
      put(facts, 'half_baths', half && half <= 6 ? half : null);
    }
    put(facts, 'rooms', positive(row.TOTROOMS) && positive(row.TOTROOMS) <= 40 ? positive(row.TOTROOMS) : null);
    const fireplaces = (positive(row.WBFP_OPENINGS) || 0) + (positive(row.MET_FIREPL) || 0);
    put(facts, 'fireplaces', fireplaces && fireplaces <= 30 ? fireplaces : null);
    if (kind === 'property') put(facts, 'stories', positive(row.STORIES));
  }
  if (kind === 'building') put(facts, 'units', positive(row.LIVUNITS));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.TOTACRES));
  put(facts, 'value_year', positive(row.TAXYR));
  put(facts, 'assessed_value', positive(row.TOTAL_VALUE));
  put(facts, 'assessed_land_value', positive(row.LAND_VALUE));
  put(facts, 'assessed_building_value', positive(row.BLDG_VALUE));
  if (positive(row.PRICE) > 100) {
    put(facts, 'sale_price', positive(row.PRICE));
    put(facts, 'sale_date', isoDate(row.SALEDT));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: place?.city || '', zip: zipCode(place?.zip) }, facts };
}

async function* build({ work, today }) {
  const places = new Map();
  for await (const row of cached(path.join(work, 'pa-berks', 'parcels.jsonl.gz'), () => layerRows(PARCELS, ['OBJECTID', 'PROPID', 'SITEADDRESS_CSZ']))) {
    const match = /^(.*?),?\s+PA\s+(\d{5})/i.exec(String(row.SITEADDRESS_CSZ || '').trim());
    if (match && row.PROPID) places.set(String(row.PROPID).trim(), { city: match[1].trim().toUpperCase(), zip: match[2] });
  }
  const records = new Map();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'pa-berks', 'residential.jsonl.gz'), () => offsetRows(RESIDENTIAL, COLUMNS, { orderBy: 'PARID,CARD', pageSize: 2000 }))) {
    if (Number(row.CARD) > 1) continue;
    const record = fromRow(row, places.get(String(row.PARID || '').trim()));
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} residential parcels, ${noAddress} without a street number, ${places.size} parcels with a site city and ZIP`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'PA', name: COUNTY, publisher: 'County of Berks Assessment Department', dataset: 'CAMA residential file; information is based on geospatial data from the County of Berks', method: 'county', source: 'pa-berks', as_of: isoDate(today.getTime()), stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [RESIDENTIAL],
    facts: { year_built: 'YRBLT', living_sqft: 'SFLA', bedrooms: 'BEDROOMS', bathrooms: 'FULLBATHS', full_baths: 'FULLBATHS', half_baths: 'HALFBATHS', rooms: 'TOTROOMS', fireplaces: 'WBFP_OPENINGS', stories: 'STORIES', units: 'LIVUNITS', lot_acres: 'TOTACRES', assessed_value: 'TOTAL_VALUE', assessed_land_value: 'LAND_VALUE', assessed_building_value: 'BLDG_VALUE', sale_price: 'PRICE', sale_date: 'SALEDT', value_year: 'TAXYR' },
  },
};
