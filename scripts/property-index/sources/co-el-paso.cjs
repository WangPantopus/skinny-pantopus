'use strict';
// El Paso County, Colorado: the County Assessor's weekly parcel data file (assessor.elpasoco.com, "Assessor Data"), which the office says
// is "provided as a public courtesy" and should be considered "best information available"; no license and no limit on use stated.
// Each parcel's site address (with its unit) and GIS ZIP, primary land use and improvement use (Colorado's state codes, with the county's
// own improvement words), acreage, actual (market) value, the primary residence's year built, rooms, bedrooms, bath count, finished area
// and style, and the last sale with the Assessor's own description. Owner and mailing columns are never asked for.

const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipTable, zipMembers } = require('../lib/tables.cjs');
const { bathFacts } = require('../lib/fill.cjs');
const { year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '08041';
const COUNTY = 'El Paso County';
const PAGE = 'https://assessor.elpasoco.com/assessordata/';
const COLUMNS = ['LastUpdate', 'PARCEL', 'LOCATION', 'LOCATIONZIP', 'PARTIALLEGAL', 'SchoolDist', 'ZONING', 'MARKETVALUE', 'LANDCODEDESCR', 'Acreage', 'IMPSTATECODE', 'IMPSTATEDESCR', 'IMPLOCALDESCR', 'YearBlt', 'RESSTYLE', 'Rooms', 'Beds', 'Baths', 'TotalFinishedArea', 'SALEDATE', 'SALEPRICE', 'AsrSaleCmnt'];

// Colorado's improvement use codes as the file words them: 1212 single family residential (the county's own word says townhouse or
// manufactured home where it is one), 1230 condominiums, 1235 manufactured housing, 4277 farm or ranch residence, 1215 duplexes and
// triplexes, 1220 four to eight units, 1225 nine units and up. A parcel with no improvement is land when its land use says vacant.
function useOf(row, unit) {
  const code = String(row.IMPSTATECODE || '').trim();
  const local = String(row.IMPLOCALDESCR || '').trim().toUpperCase();
  if (code === '1212') {
    if (local === 'TOWNHOUSE') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
    if (local === 'MANUFACTURED HOME') return ['property', 'mobile_home'];
    return unit ? ['unit', 'condo'] : ['property', 'house'];
  }
  if (code === '1230') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (code === '1235') return ['property', 'mobile_home'];
  if (code === '4277') return ['property', null];
  if (code === '1215' || code === '1220') return ['building', 'multi_unit'];
  if (code === '1225') return ['building', 'apartment'];
  if (!code && /\bVACANT\b/i.test(String(row.LANDCODEDESCR || ''))) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function siteOf(row) {
  const line = String(row.LOCATION ?? '').replace(/\s+/g, ' ').trim();
  const parsed = /^\d/.test(line) ? parse(line) : null;
  if (!parsed || parsed.form !== 'street' || !parsed.number) return null;
  const { form, ...street } = parsed;
  return street;
}

function fromRow(row) {
  const address = siteOf(row);
  const parcel = word(row.PARCEL);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.LOCATION, ''));
  put(facts, 'land_use', word(row.LANDCODEDESCR));
  put(facts, 'building_type', word(row.IMPLOCALDESCR) || word(row.IMPSTATEDESCR));
  put(facts, 'school_district', word(row.SchoolDist));
  put(facts, 'zoning', word(row.ZONING));
  put(facts, 'legal_description', word(row.PARTIALLEGAL)?.slice(0, 300));
  if (home || kind === 'building') put(facts, 'year_built', year(row.YearBlt));
  if (home) {
    put(facts, 'living_sqft', positive(row.TotalFinishedArea));
    put(facts, 'bedrooms', inRange(row.Beds, 15));
    // The bath count keeps quarter baths as the Assessor writes them (2.75 has a three-quarter bath), as Santa Barbara's does; only a
    // whole or half total also says its full and half baths.
    const baths = Number(row.Baths);
    if (baths > 0 && baths <= 12 && (baths * 4) % 1 === 0) {
      facts.bathrooms = baths;
      if ((baths * 2) % 1 === 0) Object.assign(facts, bathFacts(baths, 12));
    }
    put(facts, 'rooms', inRange(row.Rooms, 40));
    put(facts, 'style', word(row.RESSTYLE));
  }
  if (kind === 'building') put(facts, 'gross_sqft', positive(row.TotalFinishedArea));
  // A condominium unit's parcel is its share of the complex, so it gets no lot.
  if (kind !== 'unit' && homeType !== 'townhouse') put(facts, 'lot_acres', positive(row.Acreage));
  put(facts, 'market_value', positive(row.MARKETVALUE));
  const price = positive(row.SALEPRICE);
  if (/^Arms-Length Sale$/i.test(String(row.AsrSaleCmnt || '').trim()) && isHomeSale(price)) {
    put(facts, 'sale_price', price);
    put(facts, 'sale_date', isoDate(row.SALEDATE));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: zipCode(row.LOCATIONZIP) }, facts };
}

async function* build({ work }) {
  const dir = path.join(work, 'co-el-paso');
  // The file's name carries its date, so the build takes the one the Assessor's page links today.
  const page = path.join(dir, 'assessordata.html');
  download(PAGE, page);
  const link = /href="([^"]*EPC-Parcel-Data-\d{8}\.zip)"/i.exec(fs.readFileSync(page, 'latin1'))?.[1];
  if (!link) throw new Error('The Assessor\'s page no longer links its parcel data file');
  const zip = path.join(dir, path.basename(link));
  download(new URL(link, PAGE).toString(), zip);
  const member = zipMembers(zip).find((name) => /parcel data\.txt$/i.test(name));
  if (!member) throw new Error('The zip no longer holds the parcel data table');
  const records = new Map();
  let asOf = null;
  let noAddress = 0;
  let repeated = 0;
  for await (const row of zipTable(zip, member, COLUMNS, { delimiter: '\t', quoted: false })) {
    asOf = asOf || isoDate(row.LastUpdate);
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  if (!asOf) throw new Error('The file no longer says when it was created');
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'CO', name: COUNTY, publisher: 'El Paso County Assessor', dataset: 'parcel data file', method: 'county', source: 'co-el-paso', as_of: asOf, stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    // The columns read, with each one's description in the Assessor's file layout (EPC-Parcel-Layout.pdf).
    columns: {
      LastUpdate: 'Date File Created', PARCEL: 'Parcel ID Number', LOCATION: 'Physical Location (Street, Section/Township/Range)', LOCATIONZIP: 'Zip Code as determined through GIS calculations',
      PARTIALLEGAL: 'First line of legal Description', SchoolDist: 'School District', ZONING: 'Zoning Code', MARKETVALUE: 'Parcel Market (Actual) Value', LANDCODEDESCR: 'Description of Primary Land Use Code',
      Acreage: 'Parcel Acreage', IMPSTATECODE: 'State Improvement Use Code (Primary Use)', IMPSTATEDESCR: 'Description of State Use Code (Primary Use)', IMPLOCALDESCR: 'Description of County Improvement Use Code (Primary Use)',
      YearBlt: 'Year Built', RESSTYLE: 'Residential Building Style', Rooms: 'Room Count', Beds: 'Bedroom Count', Baths: 'Bathroom Count', TotalFinishedArea: 'Finished Area (Sq Ft)',
      SALEDATE: 'Last Sale Date', SALEPRICE: 'Last Sale Price', AsrSaleCmnt: 'Assessor Sale Description',
    },
    facts: { year_built: 'YearBlt', living_sqft: 'TotalFinishedArea', gross_sqft: 'TotalFinishedArea', bedrooms: 'Beds', bathrooms: 'Baths', full_baths: 'Baths', half_baths: 'Baths', rooms: 'Rooms', style: 'RESSTYLE', lot_acres: 'Acreage', market_value: 'MARKETVALUE', sale_price: 'SALEPRICE', sale_date: 'SALEDATE' },
  },
};
