'use strict';
// Washoe County, Nevada: the County Assessor's Data Downloads (GSA_QuickInfo.zip), rebuilt each weeknight. Its readme says the files are
// "provided free of charge for your general use"; its disclaimer says the data is kept for assessment and isn't warranted error free, and
// asks that building and zoning facts be checked with the agencies that issue them. No license and no limit on use stated. (The county's
// separate GIS data marketplace has its own license; nothing here comes from it.)
// Quick_Info.txt has a row per building card: each parcel's site address and unit, land use, land size (square feet or acres), the fiscal
// year's assessed land, improvement and total values (Nevada assesses at 35% of taxable value), the last sale with the Assessor's own
// validity code, and the card's year built, building area, bedrooms, and full and half baths. A parcel's first card is its home.
// Owner and mailing columns are never asked for.

const path = require('node:path');
const fs = require('node:fs');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipTable, zipDates } = require('../lib/tables.cjs');
const { year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '32031';
const COUNTY = 'Washoe County';
const PAGE = 'https://www.washoecounty.gov/assessor/online_data/DataDownloads.php';
const MEMBER = 'Quick_Info.txt';
const COLUMNS = ['ParcelID', 'CardNumber', 'Status', 'StreetNumber', 'StreetNumberSfx', 'StreetDir', 'StreetName', 'StreetSfx', 'Unit', 'SitusZip', 'SitusZipCity', 'LegalDesc', 'Subdivision', 'LandUse', 'LandSize', 'UnitType', 'Zoning', 'FiscalYear', 'AssessedLand', 'AssessedImps', 'AssessedTotal', 'SAMT1', 'SDAT1', 'SCOD1', 'BldgType', 'BldgSF', 'Beds', 'FullBaths', 'HalfBaths', 'YearBlt'];

// The Assessor's land use codes (lu_lnd_use.txt in the same zip): 200 single family residence, 210 condominium or townhouse, 250 the same
// valued as an apartment, 220 and 230 mobile homes (real or personal property), 300 duplex, 310 two single family units, 320 three or four
// units, 330 and 340 five or more units, 1xx vacant land.
function useOf(code, unit) {
  const c = String(code || '').trim();
  if (c === '200') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === '210' || c === '250') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === '220' || c === '230') return ['property', 'mobile_home'];
  if (c === '300' || c === '310' || c === '320') return ['building', 'multi_unit'];
  if (c === '330' || c === '340') return ['building', 'apartment'];
  if (/^1[0-7]\d$/.test(c)) return ['parcel', null];
  return ['other', null];
}

// Valid single-parcel sales, in the Assessor's codes (lu_sale_valid.txt): good verified (1G and its adjusted and conditional forms), verified
// by a sales letter (1SVR) or by the declaration of value (2D), and a valid sale after foreclosure (2F). Multiple-parcel, questionable,
// excluded and unverified sales aren't shown.
const VALID_SALES = new Set(['1G', '1GCA', '1GCR', '1SVR', '2D', '2F']);

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function siteOf(row) {
  const number = [row.StreetNumber, row.StreetNumberSfx].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
  if (!/^\d/.test(number) || /^0+$/.test(String(row.StreetNumber).trim())) return null;
  const line = [number, row.StreetDir, row.StreetName, row.StreetSfx].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
  const parsed = parse(line, word(row.Unit) || '');
  if (!parsed || parsed.form !== 'street' || !parsed.number) return null;
  const { form, ...street } = parsed;
  return { street, line };
}

function fromRow(row, legend) {
  const site = siteOf(row);
  const parcel = word(row.ParcelID);
  if (!site || !parcel) return null;
  const { street: address, line } = site;
  const [kind, homeType] = useOf(row.LandUse, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(line, word(row.Unit) || ''));
  put(facts, 'land_use', legend.get(String(row.LandUse || '').trim()));
  put(facts, 'building_type', word(row.BldgType));
  put(facts, 'subdivision', word(row.Subdivision));
  put(facts, 'zoning', word(row.Zoning));
  put(facts, 'legal_description', word(row.LegalDesc)?.slice(0, 300));
  if (home || kind === 'building') put(facts, 'year_built', year(row.YearBlt));
  if (home) {
    put(facts, 'living_sqft', positive(row.BldgSF));
    put(facts, 'bedrooms', inRange(row.Beds, 15));
    const [full, half] = [inRange(row.FullBaths, 12), inRange(row.HalfBaths, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
  }
  if (kind === 'building') put(facts, 'gross_sqft', positive(row.BldgSF));
  // Land size is in square feet or acres, as its unit says. A condominium unit's parcel is its share of the complex, so it gets no lot.
  if (kind !== 'unit' && homeType !== 'townhouse') {
    const unit = String(row.UnitType || '').trim().toUpperCase();
    if (unit === 'AC') put(facts, 'lot_acres', positive(row.LandSize));
    else if (unit === 'SF') put(facts, 'lot_sqft', positive(row.LandSize) >= 100 ? positive(row.LandSize) : null);
  }
  // Nevada's assessed values (35% of taxable value), land and improvements, for the fiscal year; exemptions aren't read.
  put(facts, 'assessed_land_value', positive(row.AssessedLand));
  put(facts, 'assessed_building_value', positive(row.AssessedImps));
  put(facts, 'assessed_value', positive(row.AssessedTotal));
  put(facts, 'value_year', positive(row.FiscalYear));
  const price = positive(row.SAMT1);
  if (VALID_SALES.has(String(row.SCOD1 || '').trim().toUpperCase()) && isHomeSale(price)) {
    put(facts, 'sale_price', price);
    put(facts, 'sale_date', isoDate(row.SDAT1));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.SitusZipCity) || '').toUpperCase(), zip: zipCode(row.SitusZip) }, facts };
}

async function* build({ work }) {
  const dir = path.join(work, 'nv-washoe');
  // The download's address is the one the Assessor's page links to today.
  const page = path.join(dir, 'DataDownloads.html');
  download(PAGE, page);
  const link = /href="([^"]*fileId=GSA_QuickInfo\.zip)"/i.exec(fs.readFileSync(page, 'latin1'))?.[1];
  if (!link) throw new Error('The Assessor\'s page no longer links GSA_QuickInfo.zip');
  const zip = path.join(dir, 'GSA_QuickInfo.zip');
  download(new URL(link.replace(/&amp;/g, '&'), PAGE).toString(), zip);
  const asOf = zipDates(zip).get(MEMBER);
  if (!asOf) throw new Error(`The zip no longer holds ${MEMBER}`);
  // The land use codes in the Assessor's own words, from the same zip.
  const legend = new Map();
  for await (const row of zipTable(zip, 'lu_lnd_use.txt', ['cd', 'dscr'], { delimiter: '\t', quoted: false })) legend.set(String(row.cd).trim(), word(row.dscr));
  if (!legend.size) throw new Error('The land use legend is empty');
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  let skipped = 0;
  for await (const row of zipTable(zip, MEMBER, COLUMNS, { delimiter: '\t', quoted: false })) {
    // Retired parcels, and a parcel's second and later building cards.
    if (String(row.Status || '').trim() !== 'A' || String(row.CardNumber || '').trim() !== '1') { skipped += 1; continue; }
    const record = fromRow(row, legend);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${skipped} other cards or retired parcels, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'NV', name: COUNTY, publisher: 'Washoe County Assessor', dataset: 'data downloads (Quick Info)', method: 'county', source: 'nv-washoe', as_of: asOf, stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    // The columns read, with each one's description in the Assessor's file layout (GSA_QuickInfoKey.xlsx).
    columns: {
      ParcelID: 'Assessor\'s Parcel Number (APN)', CardNumber: 'Card Number', Status: 'Status (A, Active parcel)', StreetNumber: 'Street Number', Unit: 'Unit Number', SitusZip: 'Zip Code for the Situs Address',
      LandUse: 'Current Land Use Code', LandSize: 'Land Size', UnitType: 'Land Unit Type', FiscalYear: 'Most Recent Fiscal Year', AssessedLand: 'Current Assessed Land', AssessedImps: 'Current Assessed Improvements', AssessedTotal: 'Current Assessed Total',
      SAMT1: 'Most Recent Sale Price', SDAT1: 'Most Recent Sale Date', SCOD1: 'Most Recent Sale Verification Code', BldgSF: 'Building Square Foot', Beds: 'Bedroom Count', FullBaths: 'Full Bath Count', HalfBaths: 'Half Bath Count', YearBlt: 'Original Year Built',
    },
    facts: { year_built: 'YearBlt', living_sqft: 'BldgSF', gross_sqft: 'BldgSF', bedrooms: 'Beds', bathrooms: 'FullBaths', full_baths: 'FullBaths', half_baths: 'HalfBaths', lot_sqft: 'LandSize', lot_acres: 'LandSize', assessed_land_value: 'AssessedLand', assessed_building_value: 'AssessedImps', assessed_value: 'AssessedTotal', value_year: 'FiscalYear', sale_price: 'SAMT1', sale_date: 'SDAT1' },
  },
};
