'use strict';
// Delaware County, Ohio: the Auditor's parcels from two of the county's own GIS layers, each published "as a public service" under the county's
// disclaimer (the data is as is; the user waives, releases and indemnifies the county); no limit on use is stated. The 2026 revaluation's parcel
// layer gives each parcel's number, site address, class, acres, living area, bedrooms, baths and current market value. The monthly parcel layer,
// kept by the Auditor's GIS office, gives year built, stories, rooms, heating, cooling, basement, subdivision, taxable value, annual tax and last
// sale; it carries no parcel number, so its rows join by site address, and by class or acres where an address holds several parcels. Owner and
// mailing columns are never asked for.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39041';
const COUNTY = 'Delaware County';
const BASE = 'https://services2.arcgis.com/ziXVKVy3BiopMCCU/arcgis/rest/services';
const PARCELS = `${BASE}/ParcelsProposedValue/FeatureServer/0`;
const PARCEL_COLUMNS = ['OBJECTID', 'PARCEL_NO', 'ALT_PID', 'FullAddress', 'Acres', 'NeighborhoodCode', 'TaxCode', 'SchoolCodeDesc', 'ClassCode', 'CurrentValue', 'FinishedLivingArea', 'FullBathCount', 'HalfBathCount', 'BedroomCount'];
const MONTHLY = `${BASE}/Parcel/FeatureServer/0`;
const MONTHLY_COLUMNS = ['OBJECTID', 'SUB_NAME', 'ADDR1', 'ADDR2', 'LEGAL', 'CLASS', 'ACRES', 'Shape__Area', 'MARKET_LAN', 'MARKET_IMP', 'TAXABLE_TO', 'ANNUALTAX', 'YRBUILT', 'ROOMS_TOT', 'STORYHGT', 'AIRCOND', 'HEATING', 'BASEMENT', 'MUN_NAME', 'TWP_NAME', 'SALE_DATE', 'SALE_AMNT'];

// Ohio's land use codes: 510-515 a one-family dwelling (by lot size), 550 a condominium unit (each with its own street number here), 560 a mobile
// home, 520 and 530 two and three families, 401-403 apartments, 500-505 residential vacant land.
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
const text = (value) => (/[A-Z]/i.test(String(value ?? '')) ? word(value) : null);
const squeeze = (value) => String(value ?? '').toUpperCase().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();

// The monthly layer splits the site into ADDR1 (street) and ADDR2 ("DELAWARE OH 43015"), which names each ZIP's cities. The revaluation layer runs
// the street into its city ("123 MAIN ST DELAWARE, OH 43015"), so its street is what's left once the ZIP's longest matching city is taken off.
function siteOf(full, citiesByZip) {
  const match = /^(.*) OH (\d{5})$/.exec(squeeze(full));
  if (!match) return null;
  const [, head, zip] = match;
  const city = (citiesByZip.get(zip) || []).find((name) => head.endsWith(` ${name}`));
  if (!city) return null;
  return { street: head.slice(0, head.length - city.length).trim(), city, zip };
}

function fromRow(row, site, joined) {
  const address = site && parse(site.street);
  const parcel = word(row.PARCEL_NO);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.ClassCode, address.unit);
  const facts = { parcel_number: word(row.ALT_PID) || parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  // A row joined only by its acres among several parcels at one address lends its building's figures, never the parcel's own.
  const own = joined && joined.exact ? joined.row : null;
  const building = joined ? joined.row : null;
  put(facts, 'address_on_record', onRecord(site.street, ''));
  put(facts, 'county_use_code', word(row.ClassCode));
  put(facts, 'neighborhood', word(row.NeighborhoodCode));
  put(facts, 'tax_code_area', word(row.TaxCode));
  put(facts, 'school_district', word(row.SchoolCodeDesc));
  if (own) {
    put(facts, 'subdivision', word(own.SUB_NAME));
    put(facts, 'legal_description', word(own.LEGAL)?.slice(0, 300));
    put(facts, 'municipality', word(own.MUN_NAME) || word(own.TWP_NAME));
  }
  if ((home || kind === 'building') && building) {
    put(facts, 'year_built', year(building.YRBUILT));
    put(facts, 'stories', inRange(building.STORYHGT, 5));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.FinishedLivingArea));
    put(facts, 'bedrooms', inRange(row.BedroomCount, 15));
    const [full, half] = [inRange(row.FullBathCount, 12), inRange(row.HalfBathCount, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    if (own) {
      put(facts, 'rooms', inRange(own.ROOMS_TOT, 40));
      put(facts, 'heating', text(own.HEATING));
      put(facts, 'cooling', text(own.AIRCOND));
      put(facts, 'foundation', text(own.BASEMENT));
    }
  }
  // A condominium's parcel outline is its whole complex, so a condo unit gets no lot.
  if (kind !== 'unit' && String(row.ClassCode || '').trim() !== '550') {
    // The revaluation layer's own area is in web map units, so a lot with no acreage takes the monthly layer's area (Ohio North state plane feet).
    if (positive(row.Acres)) put(facts, 'lot_acres', positive(row.Acres));
    else if (own && positive(own.ACRES)) put(facts, 'lot_acres', positive(own.ACRES));
    else if (own && positive(own.Shape__Area) >= 100) put(facts, 'lot_sqft', Math.round(positive(own.Shape__Area)));
  }
  put(facts, 'market_value', positive(row.CurrentValue));
  if (own) {
    put(facts, 'market_land_value', positive(own.MARKET_LAN));
    put(facts, 'market_building_value', positive(own.MARKET_IMP));
    put(facts, 'taxable_value', positive(own.TAXABLE_TO));
    put(facts, 'tax_amount', positive(own.ANNUALTAX));
    if (isHomeSale(positive(own.SALE_AMNT))) {
      put(facts, 'sale_price', positive(own.SALE_AMNT));
      put(facts, 'sale_date', isoDate(own.SALE_DATE));
    }
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: site.city, zip: zipCode(site.zip) }, facts };
}

async function* build({ work }) {
  const dates = [];
  for (const layer of [PARCELS, MONTHLY]) {
    const info = await getJson(`${layer}?f=json`, 'A parcel layer\'s description');
    const date = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
    if (!date) throw new Error('A parcel layer no longer says when it changed');
    dates.push(date);
  }
  const bySite = new Map();
  const cities = new Map();
  for await (const row of cached(path.join(work, 'oh-delaware', 'monthly.jsonl.gz'), () => layerRows(MONTHLY, MONTHLY_COLUMNS))) {
    const place = /^(.*?) OH (\d{5})/.exec(squeeze(row.ADDR2));
    if (!place || !row.ADDR1) continue;
    if (!cities.has(place[2])) cities.set(place[2], new Set());
    cities.get(place[2]).add(place[1]);
    const key = `${squeeze(row.ADDR1)}|${place[1]}|${place[2]}`;
    if (!bySite.has(key)) bySite.set(key, []);
    bySite.get(key).push(row);
  }
  const citiesByZip = new Map([...cities].map(([zip, names]) => [zip, [...names].sort((a, b) => b.length - a.length)]));
  const records = new Map();
  const tally = { exact: 0, byAcres: 0, unjoined: 0, noAddress: 0, repeated: 0 };
  for await (const row of cached(path.join(work, 'oh-delaware', 'parcels.jsonl.gz'), () => layerRows(PARCELS, PARCEL_COLUMNS))) {
    const site = siteOf(row.FullAddress, citiesByZip);
    let joined = null;
    if (site) {
      const rows = bySite.get(`${site.street}|${site.city}|${site.zip}`) || [];
      const sameClass = rows.length > 1 ? rows.filter((other) => String(other.CLASS).trim() === String(row.ClassCode).trim()) : rows;
      if (sameClass.length === 1) joined = { row: sameClass[0], exact: true };
      else {
        const sameAcres = (sameClass.length ? sameClass : rows).filter((other) => Math.abs((other.ACRES || 0) - (row.Acres || 0)) < 0.005);
        if (sameAcres.length === 1) joined = { row: sameAcres[0], exact: false };
      }
    }
    const record = fromRow(row, site, joined);
    if (!record) { tally.noAddress += 1; continue; }
    if (records.has(record.id)) { tally.repeated += 1; continue; }
    if (!joined) tally.unjoined += 1;
    else if (joined.exact) tally.exact += 1;
    else tally.byAcres += 1;
    records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels (${tally.exact} joined to the monthly layer by address, ${tally.byAcres} by acres, ${tally.unjoined} not joined), ${tally.noAddress} without a street number, ${tally.repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Delaware County Auditor', dataset: 'parcels (2026 revaluation layer and monthly parcel layer)', method: 'county', source: 'oh-delaware', as_of: dates.sort()[0], stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: PARCELS,
    facts: { living_sqft: 'FinishedLivingArea', bedrooms: 'BedroomCount', bathrooms: 'FullBathCount', full_baths: 'FullBathCount', half_baths: 'HalfBathCount', lot_acres: 'Acres', market_value: 'CurrentValue' },
    monthly: { layer: MONTHLY, facts: { year_built: 'YRBUILT', stories: 'STORYHGT', rooms: 'ROOMS_TOT', lot_sqft: 'Shape__Area', market_land_value: 'MARKET_LAN', market_building_value: 'MARKET_IMP', taxable_value: 'TAXABLE_TO', tax_amount: 'ANNUALTAX', sale_price: 'SALE_AMNT', sale_date: 'SALE_DATE' } },
  },
};
