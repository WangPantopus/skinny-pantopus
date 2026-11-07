'use strict';
// Los Angeles County, California: the county's public parcel layer. The county's Enterprise GIS terms grant a license to
// copy, publish and adapt its data, commercially too, without implying its endorsement. The layer has no owner columns;
// exemption columns aren't asked for, because a homeowners' exemption says who lives there. Values are Proposition 13
// assessed values, never market values. No sale prices. Up to five building lines per parcel: the largest is the home.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, streetParts } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '06037';
const COUNTY = 'Los Angeles County';
const SERVICE = 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0';
const LINES = [1, 2, 3, 4, 5];
const COLUMNS = ['AIN', 'APN', 'SitusHouseNo', 'SitusFraction', 'SitusDirection', 'SitusUnit', 'SitusStreet', 'SitusAddress', 'SitusCity', 'SitusZIP', 'TaxRateArea', 'TaxRateCity', 'UseCode', 'UseType', 'UseDescription',
  ...LINES.flatMap((n) => [`YearBuilt${n}`, `EffectiveYear${n}`, `Units${n}`, `Bedrooms${n}`, `Bathrooms${n}`, `SQFTmain${n}`]),
  'Roll_Year', 'Roll_LandValue', 'Roll_ImpValue', 'LegalDescription', 'Shape.STArea()'];

// The county's own words for the use code's third and fourth characters (Assessor Parcel Data's UseCodeDescChar3 and 4).
const FORMS = { 2: 'Townhouse format', D: 'Detached', H: 'High rise, 5 stories or more', 5: '5 stories or more' };
const POOLS = { 1: 'Yes', 3: 'Yes', 4: 'Therapy pool (spa)' };
const OTHER_STRUCTURES = { 8: 'Guesthouse' };
const CONDO_FORMS = new Set(['C', 'E', 'F', 'H']); // condominium, condo conversion, cooperative, own-your-own

function useOf(row, unit, built) {
  const code = String(row.UseCode || '').toUpperCase();
  const [group, form, detail] = [code.slice(0, 2), code[2], code[3]];
  if (row.UseType !== 'Residential') return ['other', null];
  if (!built || detail === 'V' || detail === 'X') return ['parcel', null];
  if (CONDO_FORMS.has(detail) || (group === '01' && unit)) return unit || group === '01' ? ['unit', 'condo'] : ['building', 'condo'];
  if (group === '01') return ['property', form === '2' ? 'townhouse' : 'house'];
  if (group === '07') return ['property', 'mobile_home'];
  if (group === '02' || group === '03' || group === '04' || group === '08') return ['building', 'multi_unit'];
  if (group === '05') return ['building', 'apartment'];
  return ['other', null];
}

// The building line with the most living area: a guesthouse can come first.
function mainLine(row) {
  let best = null;
  let count = 0;
  for (const n of LINES) {
    const size = positive(row[`SQFTmain${n}`]);
    if (!size) continue;
    count += 1;
    if (!best || size > positive(row[`SQFTmain${best}`])) best = n;
  }
  return { line: best, count };
}

// A few lines use 99 for "many": nothing past these is one home's count.
const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const unitText = word(row.SitusUnit) || '';
  const address = streetParts({ number: row.SitusHouseNo, numberSuffix: word(row.SitusFraction) || '', pre: word(row.SitusDirection) || '', name: word(row.SitusStreet) || '', unit: unitText });
  const parcel = word(row.AIN);
  if (!address || !parcel) return null;
  const { line, count } = mainLine(row);
  const [kind, homeType] = useOf(row, address.unit, Boolean(line));
  const code = String(row.UseCode || '').toUpperCase();
  const facts = { parcel_number: word(row.APN) || parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', word(row.SitusAddress));
  put(facts, 'municipality', word(row.TaxRateCity));
  put(facts, 'tax_code_area', word(row.TaxRateArea));
  put(facts, 'land_use', word(row.UseDescription));
  put(facts, 'county_use_code', code);
  put(facts, 'legal_description', word(row.LegalDescription)?.slice(0, 300));
  if (line && kind !== 'other' && kind !== 'parcel') {
    put(facts, 'year_built', year(row[`YearBuilt${line}`]));
    put(facts, 'effective_year_built', year(row[`EffectiveYear${line}`]));
    put(facts, 'building_type', FORMS[code[2]]);
    if (count > 1) facts.buildings_on_parcel = count;
  }
  if (home) {
    put(facts, 'living_sqft', positive(row[`SQFTmain${line}`]));
    put(facts, 'bedrooms', inRange(row[`Bedrooms${line}`], 15));
    put(facts, 'bathrooms', inRange(row[`Bathrooms${line}`], 15));
    put(facts, 'pool', POOLS[code[3]]);
    put(facts, 'other_structures', OTHER_STRUCTURES[code[3]]);
  }
  if (kind === 'building') put(facts, 'units', LINES.reduce((sum, n) => sum + (positive(row[`Units${n}`]) || 0), 0) || null);
  if (kind !== 'unit') {
    const lot = positive(row['Shape.STArea()']);
    put(facts, 'lot_sqft', lot && Math.round(lot));
  }
  const [land, building] = [positive(row.Roll_LandValue), positive(row.Roll_ImpValue)];
  put(facts, 'value_year', positive(row.Roll_Year));
  put(facts, 'assessed_land_value', land);
  put(facts, 'assessed_building_value', building);
  put(facts, 'assessed_value', (land || 0) + (building || 0) || null);
  const city = String(word(row.SitusCity) || '').toUpperCase().replace(/\s+CA$/, '');
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city, zip: zipCode(row.SitusZIP) }, facts };
}

async function* build({ work }) {
  const stats = await getJson(`${SERVICE}/query?${new URLSearchParams({ where: '1=1', outStatistics: JSON.stringify([{ statisticType: 'max', onStatisticField: 'SpatialChangeDate', outStatisticFieldName: 'changed' }]), f: 'json' })}`, 'The layer\'s last change');
  const asOf = isoDate(stats.features?.[0]?.attributes?.changed);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'ca-los-angeles', 'parcels.jsonl.gz'), () => layerRows(SERVICE, COLUMNS, { pageSize: 1000 }))) {
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
    fips: FIPS, state: 'CA', name: COUNTY, publisher: 'Los Angeles County Assessor', dataset: 'parcels, Enterprise GIS', method: 'county', source: 'ca-los-angeles', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: SERVICE,
    facts: { year_built: 'YearBuilt1', living_sqft: 'SQFTmain1', bedrooms: 'Bedrooms1', bathrooms: 'Bathrooms1', units: 'Units1', lot_sqft: 'Shape.STArea()', assessed_land_value: 'Roll_LandValue', assessed_building_value: 'Roll_ImpValue', value_year: 'Roll_Year' },
    area_unit: 'foot',
    codes: { UseCode: 'Assessor Parcel Data (Rolls 2021 - 2025): UseCodeDescChar1-4' },
  },
};
