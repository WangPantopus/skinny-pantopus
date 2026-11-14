'use strict';
// Municipality of Anchorage, Alaska: the Property Appraisal Division's CAMA files on the Municipality's open data page (opendata.muni.org),
// refreshed daily. The Municipality's open data policy (2016) says the public data it publishes isn't subject to copyright, patent,
// trademark or trade secret restrictions. Two files: every parcel with its land use, land area and current land, building and total values
// (Alaska assesses at full and true value), and every residential parcel with its dwelling: year built, living area, bedrooms, full and half
// baths, rooms, stories and style. Each parcel's own street address and ZIP, with a condominium's unit number. The owner and mailing
// columns are never kept: only the named columns are read out of each line.

const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download, streamLines, splitQuoted } = require('../lib/tables.cjs');
const { year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '02020';
const COUNTY = 'Municipality of Anchorage';
const BASE = 'https://opendata.muni.org/CAMA';
const PARCELS = ['ParcelId', 'ParcelAddress', 'ParcelCity', 'ParcelZip', 'CondoUnitNumber', 'Legal1', 'LandArea', 'CurrentLandValue', 'CurrentBuildingValue', 'CurrentTotalValue', 'AppraisalYear', 'LandUseCodeDesc', 'ClassCodeDesc', 'Neighborhood', 'YearBuilt'];
const DWELLINGS = ['ParcelId', 'YearBuilt', 'TotalLivingArea', 'Bedrooms', 'NumFullBaths', 'NumHalfBaths', 'TotalAllRooms', 'StoryHgt', 'StyleDesc', 'BldgIndicatorDesc'];

/** A CSV file's rows, each holding only `columns` (a missing column stops the build). */
async function* csvRows(file, columns) {
  let at = null;
  for await (const line of streamLines(fs.createReadStream(file, 'utf8'))) {
    const fields = splitQuoted(line.replace(/^﻿/, ''), ',');
    if (!at) {
      at = columns.map((name) => fields.indexOf(name));
      const missing = columns.filter((name, i) => at[i] < 0);
      if (missing.length) throw new Error(`${path.basename(file)} has no ${missing.join(', ')} column`);
      continue;
    }
    if (fields.length < 2) continue;
    yield Object.fromEntries(columns.map((name, i) => [name, fields[at[i]]]));
  }
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// The Appraisal Division's land uses, in its own words. A condominium with no dwelling in the residential file and a class that isn't
// residential (an industrial or office unit) isn't a home.
function useOf(landUse, unit, dwelling, propertyClass) {
  const use = String(landUse || '').trim().toUpperCase();
  if (use === 'CONDO (FEE SIMPLE)' && !dwelling && !/^RESIDENTIAL/i.test(String(propertyClass || '').trim())) return ['other', null];
  if (use === 'RESIDENTIAL 1 FAMILY' || use === 'SINGLE FAMILY RESID. WITH ADU') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (use === 'CONDO (FEE SIMPLE)') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (use === 'MOBILE HOME ON PRIVATE LOT') return ['property', 'mobile_home'];
  if (use === 'RESIDENTIAL 2 FAMILY' || use === 'RESIDENTIAL 3 FAMILY' || use === '4 LIVING UNIT MIX' || use === 'FOURPLEX') return ['building', 'multi_unit'];
  if (/^APARTMENTS\b/.test(use)) return ['building', 'apartment'];
  if (use === 'RESI STRUCTURE ON COMMERCIAL LAND' && dwelling) return ['property', null];
  if (use === 'RESIDENTIAL VACANT LAND') return ['parcel', null];
  return ['other', null];
}

function siteOf(row) {
  const line = String(row.ParcelAddress ?? '').replace(/\s+/g, ' ').trim();
  const parsed = line ? parse(line, word(row.CondoUnitNumber) || '') : null;
  if (!parsed || parsed.form !== 'street' || !parsed.number) return null;
  const { form, ...street } = parsed;
  return street;
}

function fromRow(row, dwelling) {
  const address = siteOf(row);
  const parcel = word(row.ParcelId);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.LandUseCodeDesc, address.unit, dwelling, row.ClassCodeDesc);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.ParcelAddress, word(row.CondoUnitNumber) || ''));
  put(facts, 'land_use', word(row.LandUseCodeDesc));
  put(facts, 'legal_description', word(row.Legal1)?.slice(0, 300));
  if (home || kind === 'building') put(facts, 'year_built', year((dwelling || row).YearBuilt));
  if (home && dwelling) {
    put(facts, 'living_sqft', positive(dwelling.TotalLivingArea));
    put(facts, 'bedrooms', inRange(dwelling.Bedrooms, 15));
    const [full, half] = [inRange(dwelling.NumFullBaths, 12), inRange(dwelling.NumHalfBaths, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'rooms', inRange(dwelling.TotalAllRooms, 40));
    put(facts, 'stories', inRange(dwelling.StoryHgt, 5));
    put(facts, 'style', word(dwelling.StyleDesc));
  }
  if (kind === 'building' && dwelling) put(facts, 'gross_sqft', positive(dwelling.TotalLivingArea));
  // Land area is in square feet. A condominium unit's parcel is its share of the complex, so it gets no lot.
  if (kind !== 'unit' && homeType !== 'townhouse') put(facts, 'lot_sqft', positive(row.LandArea) >= 100 ? positive(row.LandArea) : null);
  put(facts, 'market_value', positive(row.CurrentTotalValue));
  put(facts, 'market_land_value', positive(row.CurrentLandValue));
  put(facts, 'market_building_value', positive(row.CurrentBuildingValue));
  put(facts, 'value_year', positive(row.AppraisalYear));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.ParcelCity) || '').toUpperCase(), zip: zipCode(row.ParcelZip) }, facts };
}

async function* build({ work, today }) {
  const dir = path.join(work, 'ak-anchorage');
  const parcelsFile = path.join(dir, 'CAMACommon.csv');
  const dwellingsFile = path.join(dir, 'CAMAResidential.csv');
  download(`${BASE}/CAMACommon.csv`, parcelsFile);
  download(`${BASE}/CAMAResidential.csv`, dwellingsFile);
  const dwellings = new Map();
  for await (const row of csvRows(dwellingsFile, DWELLINGS)) {
    if (/^dwelling$/i.test(String(row.BldgIndicatorDesc || '').trim())) dwellings.set(String(row.ParcelId).trim(), row);
  }
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of csvRows(parcelsFile, PARCELS)) {
    const record = fromRow(row, dwellings.get(String(row.ParcelId).trim()));
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels (${dwellings.size} with a dwelling), ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  // The files are refreshed daily, so the release is dated by the day they were read.
  yield {
    fips: FIPS, state: 'AK', name: COUNTY, publisher: 'the Municipality of Anchorage Property Appraisal Division', dataset: 'open data files', method: 'county', source: 'ak-anchorage', as_of: isoDate(today.getTime()), stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    // The files' own header names (the Municipality publishes no separate field list).
    columns: [...new Set([...PARCELS, ...DWELLINGS])],
    facts: { year_built: 'YearBuilt', living_sqft: 'TotalLivingArea', gross_sqft: 'TotalLivingArea', bedrooms: 'Bedrooms', bathrooms: 'NumFullBaths', full_baths: 'NumFullBaths', half_baths: 'NumHalfBaths', rooms: 'TotalAllRooms', stories: 'StoryHgt', style: 'StyleDesc', lot_sqft: 'LandArea', market_value: 'CurrentTotalValue', market_land_value: 'CurrentLandValue', market_building_value: 'CurrentBuildingValue', value_year: 'AppraisalYear' },
  },
};
