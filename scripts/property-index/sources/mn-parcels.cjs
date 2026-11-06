'use strict';
// Minnesota: MnGeo's compilation of the counties that opted in to open parcels. What each county supplies varies. A
// county here is only read if the state's own table says the Geospatial Advisory Council's open approval is on. The
// homestead flag says something about a person and isn't asked for; neither are the owner and taxpayer columns.

const path = require('node:path');
const { parts } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const SERVICE = 'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_mngeo/plan_parcels_open/FeatureServer';
const COLUMNS = ['county_pin', 'state_pin', 'anumberpre', 'anumber', 'anumbersuf', 'st_pre_dir', 'st_pre_typ', 'st_name', 'st_pos_typ', 'st_pos_dir', 'sub_type1', 'sub_id1', 'sub_id2', 'zip', 'ctu_name', 'postcomm', 'co_name', 'acres_deed', 'acres_poly',
  'emv_land', 'emv_bldg', 'emv_total', 'tax_year', 'mkt_year', 'useclass1', 'dwell_type', 'home_style', 'fin_sq_ft', 'garage', 'garagesqft', 'basement', 'heating', 'cooling', 'year_built', 'num_units', 'sale_date', 'sale_value', 'school_dst', 'plat_name'];

function useOf(row, unit) {
  const use = `${row.useclass1 || ''} ${row.dwell_type || ''}`.toUpperCase();
  if (/GARAGE|MISCELL/.test(use) && /CONDO/.test(use)) return ['other', null];
  if (/CONDO|CO-OP|COOP/.test(use)) return ['unit', 'condo'];
  if (/TOWN ?H|TWIN/.test(use)) return ['property', 'townhouse'];
  if (/MANUF|MOBILE/.test(use)) return ['property', 'mobile_home'];
  if (/DOUBLE BUNG|DUPLEX|TRIPLEX|2-3 UNIT|TWO|THREE/.test(use)) return ['building', 'multi_unit'];
  if (/APART/.test(use)) return ['building', 'apartment'];
  if (/VACANT/.test(use)) return ['parcel', null];
  if (/RESID|S\.FAM/.test(use)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  return ['other', null];
}
const said = (text) => {
  const value = word(text);
  return value && !/^(unknown|none|no|n|u|0)$/i.test(value) ? value : null;
};
// "Two Story", "1-1/2 Stry": a style that also says the stories.
const STORY_WORDS = { ONE: 1, TWO: 2, THREE: 3 };
function storiesFrom(style) {
  const text = String(style ?? '').toUpperCase();
  const fraction = /^(\d)-(\d)\/(\d)\s*ST/.exec(text);
  if (fraction) return Number(fraction[1]) + Number(fraction[2]) / Number(fraction[3]);
  const named = /^(ONE|TWO|THREE)\s+STORY$/.exec(text);
  return named ? STORY_WORDS[named[1]] : null;
}

function fromRow(row, fips, county) {
  const unit = [row.sub_type1, row.sub_id1].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
  const parsed = parts({ number: `${row.anumberpre || ''}${row.anumber || ''}`, numberSuffix: row.anumbersuf || '', pre: row.st_pre_dir || '', name: [row.st_pre_typ, row.st_name].filter(Boolean).join(' '), suffix: row.st_pos_typ || '', post: row.st_pos_dir || '', unit });
  const parcel = word(row.county_pin) || word(row.state_pin);
  if (!parsed || !parcel) return null;
  const [kind, homeType] = useOf(row, parsed.unit);
  const facts = { parcel_number: parcel, county, fips };
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'municipality', word(row.ctu_name));
  put(facts, 'year_built', on ? year(row.year_built) : null);
  put(facts, 'living_sqft', home ? positive(row.fin_sq_ft) : null);
  const style = said(row.home_style);
  put(facts, 'style', on ? style : null);
  put(facts, 'stories', on ? storiesFrom(style) : null);
  if (kind === 'building') put(facts, 'units', positive(row.num_units));
  if (home) {
    put(facts, 'heating', said(row.heating));
    put(facts, 'cooling', said(row.cooling));
    put(facts, 'garage', said(row.garage));
    put(facts, 'garage_sqft', positive(row.garagesqft));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.acres_deed) || positive(row.acres_poly));
  put(facts, 'subdivision', word(row.plat_name));
  put(facts, 'school_district', word(row.school_dst));
  put(facts, 'land_use', word(row.useclass1));
  put(facts, 'value_year', positive(row.mkt_year) || positive(row.tax_year));
  put(facts, 'market_value', positive(row.emv_total));
  put(facts, 'market_land_value', positive(row.emv_land));
  put(facts, 'market_building_value', positive(row.emv_bldg));
  const sold = isoDate(row.sale_date);
  if (positive(row.sale_value) > 100 && sold) {
    facts.sale_price = positive(row.sale_value);
    facts.sale_date = sold;
  }
  return { id: `pp:${kind}:${fips}:${parcel}`, kind, home_type: homeType, address: { ...parsed, city: String(word(row.postcomm) || word(row.ctu_name) || '').toUpperCase(), zip: zipCode(row.zip) }, facts };
}

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const table = await getJson(`${SERVICE}/0/query?${new URLSearchParams({ where: '1=1', outFields: 'countyfips,countyname,acqdate,gac_open_approval', returnGeometry: 'false', f: 'json' })}`, 'The county table');
  const counties = (table.features || []).map((feature) => feature.attributes).filter((row) => String(row.gac_open_approval).toLowerCase() === 'true');
  log(`${counties.length} counties opted in`);
  if (counties.length < 40) throw new Error(`Only ${counties.length} counties are marked open`);
  for (const { countyfips: code, countyname: name, acqdate: acquired } of counties.sort((a, b) => a.countyfips.localeCompare(b.countyfips))) {
    const fips = `27${code}`;
    if (only.length && !only.includes(fips)) continue;
    const county = `${name} County`;
    const records = [];
    const seen = new Set();
    let noAddress = 0;
    const rows = cached(path.join(work, 'mn-parcels', `${fips}.jsonl.gz`), () => layerRows(`${SERVICE}/1`, COLUMNS, { where: `co_name = '${name.replace(/'/g, "''")}'`, oid: 'objectid' }));
    for await (const row of rows) {
      const record = fromRow(row, fips, county);
      if (!record) noAddress += 1;
      else if (!seen.has(record.id)) {
        seen.add(record.id);
        records.push(record);
      }
    }
    log(`${county}: ${records.length} records, ${noAddress} without a street number`);
    const asOf = isoDate(acquired);
    if (!asOf) throw new Error(`${county}'s row no longer says when it was acquired`);
    for (const building of condoBuildings(records, { fips, county })) records.push(building);
    yield {
      fips, state: 'MN', name: county, publisher: `${county} and MnGeo`, dataset: 'open county parcels', method: 'state', source: 'mn-parcels', title: 'State records', as_of: asOf, stale_after_days: 730, records,
    };
  }
}

module.exports = { build };
