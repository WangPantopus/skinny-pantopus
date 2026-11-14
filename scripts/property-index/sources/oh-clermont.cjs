'use strict';
// Clermont County, Ohio: the County Auditor's "AC - Parcels" dataset on its own open data site (opendata.clermontauditor.org), published under
// a public domain license: each parcel's dwelling, commercial structure and last sale, by tax year, updated daily. Year built, living area,
// bedrooms, full and half baths, stories, style, acres, the appraised land, building and total values (Ohio appraises at full market value;
// tax is figured on 35% of it) and the last sale with the Auditor's own valid-sale flag. The owner column is never asked for.
// The dataset holds every tax year since 2010, so the build reads the latest one that has begun (2026 is the county's reappraisal).
// A parcel inside a tax increment financing or abatement area has a second account (its number with a T, A or X for the last character,
// an exempt land use code 7xx) that repeats the dwelling and holds the exempt share of the value. That account isn't filed, since it isn't
// another home, and its home gets no value: its own account holds only part of it, and the record doesn't give the whole.
// Most rows carry no city or ZIP, so the county's ZIP codes (from the Census) let an address find it.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, socrataRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39025';
const COUNTY = 'Clermont County';
const DOMAIN = 'opendata.clermontauditor.org';
const DATASET = 'dh49-9zqk';
const COLUMNS = ['parid', 'taxyr', 'aprland', 'aprbldg', 'aprtot', 'yrblt', 'stories', 'style_desc', 'sfla', 'beds', 'fullbaths', 'half_bath', 'adrno', 'adrstr', 'adrsuf', 'cityname', 'zip', 'luc', 'luc_desc', 'class_desc', 'acres', 'saledt', 'sale_price', 'saleval_desc', 'nbhd_desc', 'schname'];

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// Ohio's land use codes, in the Auditor's own words (luc_desc): 510 a one-family dwelling, 550 a condominium, 555 a landominium (a condominium
// that owns its land), 570 and 575 townhomes, 560 and 580 manufactured homes, 520, 521, 530 and 540 two- and three-family dwellings, 500 vacant
// residential land, 599 other residential, 1xx agricultural, 401-403 apartments, 7xx an exempt account (abatement or tax increment financing).
function useOf(row) {
  const c = String(row.luc || '').trim();
  const home = positive(row.beds) || (positive(row.sfla) && positive(row.fullbaths));
  if (c === '510') return ['property', 'house'];
  if (c === '550' || c === '555' || c === '570' || c === '575') return ['property', 'townhouse'];
  if (c === '560' || c === '580') return ['property', 'mobile_home'];
  if (c === '520' || c === '521' || c === '530' || c === '540') return ['building', 'multi_unit'];
  if (/^40[1-3]$/.test(c)) return ['building', 'apartment'];
  if ((c === '599' || /^1\d\d$/.test(c)) && home) return ['property', null];
  if (c === '599' || /^50\d$/.test(c) || /^1\d\d$/.test(c)) return ['parcel', null];
  return ['other', null];
}

// "R - SINGLE FAMILY DWELLING, PLATTED LOT": the class letter goes.
const landUse = (text) => word(String(text ?? '').replace(/^[A-Z]\s+-\s+/, ''));

function siteOf(row) {
  const number = String(row.adrno ?? '').trim();
  if (!/^\d/.test(number) || /^0+$/.test(number)) return null;
  const parsed = parse([number, row.adrstr, row.adrsuf].map((part) => String(part ?? '').trim()).filter(Boolean).join(' '));
  if (!parsed || parsed.form !== 'street' || !parsed.number) return null;
  const { form, ...street } = parsed;
  return street;
}

function fromRow(row, splitValue) {
  const address = siteOf(row);
  const parcel = word(row.parid);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property';
  put(facts, 'address_on_record', onRecord([row.adrno, row.adrstr, row.adrsuf].map(word).filter(Boolean).join(' '), ''));
  put(facts, 'land_use', landUse(row.luc_desc));
  put(facts, 'neighborhood', word(row.nbhd_desc));
  put(facts, 'school_district', word(row.schname));
  if (home || kind === 'building') put(facts, 'year_built', year(row.yrblt));
  if (home) {
    put(facts, 'living_sqft', positive(row.sfla));
    put(facts, 'bedrooms', inRange(row.beds, 15));
    const [full, half] = [inRange(row.fullbaths, 12), inRange(row.half_bath, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'stories', inRange(row.stories, 5));
    put(facts, 'style', word(row.style_desc));
  }
  if (kind === 'building') put(facts, 'gross_sqft', positive(row.sfla));
  put(facts, 'lot_acres', positive(row.acres));
  if (!splitValue) {
    put(facts, 'market_value', positive(row.aprtot));
    put(facts, 'market_land_value', positive(row.aprland));
    put(facts, 'market_building_value', positive(row.aprbldg));
    put(facts, 'value_year', positive(row.taxyr));
  }
  const price = positive(row.sale_price);
  if (/^VALID SALE$/i.test(String(row.saleval_desc || '').trim()) && isHomeSale(price)) {
    put(facts, 'sale_price', price);
    put(facts, 'sale_date', isoDate(row.saledt));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.cityname) || '').toUpperCase(), zip: zipCode(row.zip) }, facts };
}

async function* build({ work, today }) {
  const info = await getJson(`https://${DOMAIN}/api/views/${DATASET}.json`, 'The dataset\'s description');
  if (!info.rowsUpdatedAt) throw new Error('The dataset no longer says when it changed');
  const [{ max_taxyr: latest } = {}] = await getJson(`https://${DOMAIN}/resource/${DATASET}.json?${new URLSearchParams({ $select: 'max(taxyr)', $where: `taxyr <= ${today.getUTCFullYear()}` })}`, 'The latest tax year');
  if (!positive(latest)) throw new Error('The dataset has no tax year');
  const rows = [];
  for await (const row of cached(path.join(work, 'oh-clermont', `parcels-${latest}.jsonl.gz`), () => socrataRows(DOMAIN, DATASET, COLUMNS, { where: `taxyr = ${latest}` }))) rows.push(row);
  // A 7xx account whose parcel number, but for its last character, is another account's: that parcel's exempt share.
  const numbers = new Set(rows.map((row) => String(row.parid || '')));
  const exemptShare = (row) => /^7\d\d$/.test(String(row.luc || '').trim()) && [...'.ABCDEFGHIJKLMNOPQRSUVWXYZ'].some((last) => last !== String(row.parid).slice(-1) && numbers.has(String(row.parid).slice(0, -1) + last));
  const split = new Set(rows.filter(exemptShare).flatMap((row) => [...'.ABCDEFGHIJKLMNOPQRSUVWXYZ'].map((last) => String(row.parid).slice(0, -1) + last)));
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  let shares = 0;
  for (const row of rows) {
    if (exemptShare(row)) { shares += 1; continue; }
    const record = fromRow(row, split.has(String(row.parid)));
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: tax year ${latest}, ${list.length} parcels, ${noAddress} without a street number, ${shares} exempt-share accounts, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Clermont County Auditor', dataset: 'open data parcels', method: 'county', source: 'oh-clermont', as_of: isoDate(info.rowsUpdatedAt * 1000), stale_after_days: 450, extra_zips: zipsByCounty(work, ['39']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    socrata: { domain: DOMAIN, ids: [DATASET] },
    facts: { year_built: 'yrblt', living_sqft: 'sfla', gross_sqft: 'sfla', bedrooms: 'beds', bathrooms: 'fullbaths', full_baths: 'fullbaths', half_baths: 'half_bath', stories: 'stories', style: 'style_desc', lot_acres: 'acres', market_value: 'aprtot', market_land_value: 'aprland', market_building_value: 'aprbldg', value_year: 'taxyr', sale_price: 'sale_price', sale_date: 'saledt' },
  },
};
