'use strict';
// Monroe County, New York: the county's public parcels layer, which joins its parcel boundaries to each municipality's assessment
// roll. Monroe isn't in the state's public parcels. Year built, living area, bedrooms, baths, kitchens, fireplaces, style, walls,
// basement, heat, air, water and sewer. Values are assessed, each town at its own ratio, so never a market value. No terms are
// stated on the service. Owner and mailing columns aren't in it.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '36055';
const COUNTY = 'Monroe County';
const LAYER = 'https://maps.monroecounty.gov/server/rest/services/Hosted/Parcels_Public/FeatureServer/0';
const COLUMNS = ['countysbl', 'printkey', 'parceladdress', 'parceladdressnumber', 'parceladdressstreetprefixdir', 'parceladdressstreetname', 'parceladdressstreetsuffix', 'parceladdressstreetpostdir', 'parceladdresscity', 'parceladdresszipcode', 'parceladdressunit', 'parceladdressunitnumber', 'frontagefeet', 'depthfeet', 'acres', 'rollyear', 'totalassessedvalue', 'landassessedvalue', 'schooldistrictname', 'propertyclass', 'propertyclassdescription', 'yearbuilt', 'buildingstyle', 'exteriorwallmaterial', 'numberofstories', 'squarefeetlivingarea', 'numberofbedrooms', 'numberoffullbathrooms', 'numberofhalfbathrooms', 'numberofkitchens', 'numberoffireplaces', 'basementtype', 'centralair', 'heattype', 'sewertype', 'watersupply'];

function useOf(code, hasUnit) {
  const c = String(code ?? '').slice(0, 3);
  if (c === '270' || c === '271') return ['property', 'mobile_home'];
  if (c === '220' || c === '230') return ['building', 'multi_unit'];
  if (c === '411' || c === '410') return hasUnit ? ['unit', 'condo'] : ['building', 'apartment'];
  if (c === '210' || c === '215' || c === '240' || c === '241' || c === '250' || c === '260') return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c.startsWith('3') || c.startsWith('1') || c.startsWith('9')) return ['parcel', null];
  return ['other', null];
}

const BASEMENT = { Full: 'Full basement', Partial: 'Partial basement', 'Partial fin': 'Partial basement, finished', Finished: 'Finished basement', Unfinished: 'Unfinished basement', 'Slab/pier': 'Slab or pier', Crawl: 'Crawl space' };
const said = (text) => {
  const value = word(text);
  return value && !/^(none|no central)$/i.test(value) ? value : null;
};

function fromRow(row) {
  const secondary = [row.parceladdressunit, row.parceladdressunitnumber].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
  const address = streetParts({ number: row.parceladdressnumber, pre: row.parceladdressstreetprefixdir, name: row.parceladdressstreetname, suffix: row.parceladdressstreetsuffix, post: row.parceladdressstreetpostdir, unit: realUnit(secondary) });
  const parcel = word(row.countysbl) || word(row.printkey);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.propertyclass, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(word(row.parceladdress), secondary));
  put(facts, 'land_use', word(row.propertyclassdescription));
  put(facts, 'county_use_code', word(row.propertyclass));
  put(facts, 'school_district', word(row.schooldistrictname));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.yearbuilt));
    put(facts, 'style', said(row.buildingstyle));
    put(facts, 'exterior_walls', said(row.exteriorwallmaterial));
    put(facts, 'stories', positive(row.numberofstories));
    put(facts, 'heating', said(row.heattype));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.squarefeetlivingarea));
    put(facts, 'bedrooms', positive(row.numberofbedrooms));
    const [full, half] = [positive(row.numberoffullbathrooms), positive(row.numberofhalfbathrooms)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'kitchens', positive(row.numberofkitchens));
    put(facts, 'fireplaces', positive(row.numberoffireplaces));
    put(facts, 'foundation', BASEMENT[String(row.basementtype ?? '').trim()]);
    if (/^yes$/i.test(row.centralair || '')) facts.cooling = 'Central air';
  } else if (kind === 'building') put(facts, 'gross_sqft', positive(row.squarefeetlivingarea));
  put(facts, 'water_source', said(row.watersupply));
  put(facts, 'sewer', said(row.sewertype));
  // A town lot is on the roll by its frontage and depth, a bigger parcel in acres.
  if (kind !== 'unit') {
    const [front, depth] = [positive(row.frontagefeet), positive(row.depthfeet)];
    if (positive(row.acres)) facts.lot_acres = positive(row.acres);
    else if (front && depth) facts.lot_sqft = Math.round(front * depth);
  }
  put(facts, 'value_year', positive(row.rollyear));
  put(facts, 'assessed_value', positive(row.totalassessedvalue));
  put(facts, 'assessed_land_value', positive(row.landassessedvalue));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.parceladdresscity) || '').toUpperCase(), zip: zipCode(row.parceladdresszipcode) }, facts };
}

async function* build({ work }) {
  const about = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(/File creation date:\s*\w+,\s*([A-Za-z]+ \d{1,2}, \d{4})/.exec(about.description || '')?.[1]) || isoDate(about.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it was made');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'ny-monroe', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { oid: 'objectid' }))) {
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
    fips: FIPS, state: 'NY', name: COUNTY, publisher: 'Monroe County', dataset: 'public parcels', method: 'county', source: 'ny-monroe', as_of: asOf, stale_after_days: 730, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [LAYER],
    facts: { year_built: 'yearbuilt', style: 'buildingstyle', exterior_walls: 'exteriorwallmaterial', stories: 'numberofstories', heating: 'heattype', living_sqft: 'squarefeetlivingarea', gross_sqft: 'squarefeetlivingarea', bedrooms: 'numberofbedrooms', full_baths: 'numberoffullbathrooms', half_baths: 'numberofhalfbathrooms', kitchens: 'numberofkitchens', fireplaces: 'numberoffireplaces', foundation: 'basementtype', water_source: 'watersupply', sewer: 'sewertype', lot_acres: 'acres', lot_sqft: 'frontagefeet', assessed_value: 'totalassessedvalue', assessed_land_value: 'landassessedvalue', value_year: 'rollyear', land_use: 'propertyclassdescription', school_district: 'schooldistrictname' },
    words: {},
  },
};
