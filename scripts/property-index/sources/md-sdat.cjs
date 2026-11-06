'use strict';
// Maryland: the State Department of Assessments and Taxation's real property file, published by the state as public
// domain in a version with owner names hidden, updated monthly. Grantor names, mailing addresses and the credit
// programs' columns (which say something about a household's income) aren't asked for. Maryland assesses at full value,
// phased in over three years: the land and improvement values are the full ones, the assessment is what's phased in.

const path = require('node:path');
const { parts } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, socrataRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const DOMAIN = 'opendata.maryland.gov';
const DATASET = 'ed4q-f8tm';
const COUNTIES = {
  Allegany: '24001', 'Anne Arundel': '24003', Baltimore: '24005', Calvert: '24009', Caroline: '24011', Carroll: '24013', Cecil: '24015', Charles: '24017', Dorchester: '24019', Frederick: '24021', Garrett: '24023', Harford: '24025',
  Howard: '24027', Kent: '24029', Montgomery: '24031', "Prince George's": '24033', "Queen Anne's": '24035', "St. Mary's": '24037', Somerset: '24039', Talbot: '24041', Washington: '24043', Wicomico: '24045', Worcester: '24047', 'Baltimore City': '24510',
};

const COLUMN = {
  county: 'county_name_mdp_field_cntyname', account: 'account_id_mdp_field_acctid', number: 'premise_address_number_mdp_field_premsnum_sdat_field_20', numberSuffix: 'premise_address_number_suffix_sdat_field_21',
  direction: 'premise_address_direction_mdp_field_premsdir_sdat_field_22', street: 'premise_address_name_mdp_field_premsnam_sdat_field_23', streetType: 'premise_address_type_mdp_field_premstyp_sdat_field_24',
  city: 'premise_address_city_mdp_field_premcity_sdat_field_25', zip: 'premise_address_zip_code_mdp_field_premzip_sdat_field_26', unit: 'premise_address_condominium_unit_no_sdat_field_28', town: 'town_code_mdp_field_towncode_desctown_sdat_field_36',
  zoning: 'zoning_code_mdp_field_zoning_sdat_field_45', use: 'land_use_code_mdp_field_lu_desclu_sdat_field_50', soldOn: 'sales_segment_1_transfer_date_yyyy_mm_dd_mdp_field_tradate_sdat_field_89', soldFor: 'sales_segment_1_consideration_mdp_field_considr1_sdat_field_90',
  land: 'current_cycle_data_land_value_mdp_field_names_nfmlndvl_curlndvl_and_sallndvl_sdat_field_164', improvements: 'current_cycle_data_improvements_value_mdp_field_names_nfmimpvl_curimpvl_and_salimpvl_sdat_field_165',
  assessedOn: 'current_cycle_data_date_assessed_yyyy_mm_mdp_field_lastassd_sdat_field_169', assessed: 'current_assessment_year_total_assessment_sdat_field_172',
  built: 'c_a_m_a_system_data_year_built_yyyy_mdp_field_yearblt_sdat_field_235', dwellings: 'c_a_m_a_system_data_number_of_dwelling_units_mdp_field_bldg_units_sdat_field_239', stories: 'c_a_m_a_system_data_number_of_stories_mdp_field_bldg_story_sdat_field_240',
  area: 'c_a_m_a_system_data_structure_area_sq_ft_mdp_field_sqftstrc_sdat_field_241', landArea: 'c_a_m_a_system_data_land_area_mdp_field_landarea_sdat_field_242', landUnit: 'c_a_m_a_system_data_land_unit_of_measure_mdp_field_luom_sdat_field_243',
  construction: 'additional_c_a_m_a_data_dwelling_construction_code_mdp_field_strucnst_sdat_field_263', style: 'additional_c_a_m_a_data_building_style_code_and_description_mdp_field_strustyl_descstyl_sdat_field_264',
  dwellingType: 'additional_c_a_m_a_data_dwelling_type_mdp_field_strubldg_sdat_field_265', grade: 'c_a_m_a_system_data_dwelling_grade_code_and_description_mdp_field_strugrad_strudesc_sdat_field_230',
};

// "Residential (R)": the code in brackets, and the file's words for it.
function coded(text) {
  const match = /^(.*?)\s*\(([A-Z0-9]+)\)?\s*$/.exec(String(text ?? '').trim());
  return match ? [match[2], match[1]] : ['', ''];
}
// "STRY 2 Story With Basement (0006)" says the style and the stories.
const STYLE = /^(?:STRY|HOUSING)\s+(.*?)\s*\(/;
function styleOf(text) {
  const style = STYLE.exec(String(text ?? ''))?.[1] || null;
  const levels = /(\d+)(\s+1\/2)?\s+Story/.exec(style || '');
  return { style, stories: levels ? Number(levels[1]) + (levels[2] ? 0.5 : 0) : null };
}

function fromRow(row, fips, county) {
  const pick = (name) => row[COLUMN[name]] ?? '';
  const [code, useWords] = coded(pick('use'));
  const dwellings = positive(pick('dwellings'));
  const built = year(pick('built'));
  const area = positive(pick('area'));
  const improved = Boolean(built || area);
  let [kind, homeType] = ['other', null];
  if (code === 'R' || code === 'A' || code === 'TH') {
    if (!improved) kind = 'parcel';
    else if (code === 'R' && dwellings > 1) [kind, homeType] = ['building', 'multi_unit'];
    else if (code === 'TH') [kind, homeType] = ['property', 'townhouse'];
    else [kind, homeType] = ['property', 'house'];
  } else if (code === 'U') [kind, homeType] = ['unit', 'condo'];
  else if (code === 'M') [kind, homeType] = ['building', 'apartment'];

  const address = parts({ number: pick('number'), numberSuffix: pick('numberSuffix'), pre: pick('direction'), name: pick('street'), suffix: pick('streetType'), unit: pick('unit') });
  if (!address || !word(pick('account')) || Number(pick('number')) === 0) return null;
  const facts = { parcel_number: word(pick('account')), county, fips };
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  const home = kind === 'property' || kind === 'unit';
  const { style, stories } = styleOf(pick('style'));
  put(facts, 'municipality', word(coded(pick('town'))[1]));
  put(facts, 'year_built', on ? built : null);
  // "Structure area" is the enclosed area above grade: what the state's own record calls living area.
  put(facts, 'living_sqft', home ? area : null);
  put(facts, 'gross_sqft', kind === 'building' ? area : null);
  put(facts, 'stories', on ? stories || positive(pick('stories')) : null);
  put(facts, 'style', on ? style : null);
  put(facts, 'exterior_walls', on ? word(coded(pick('construction'))[1].replace(/^Blank$/, '')) : null);
  put(facts, 'quality', on ? word(coded(pick('grade'))[1].replace(/^Blank$/, '')) : null);
  if (kind === 'building') put(facts, 'units', dwellings);
  if (kind !== 'unit') {
    const size = positive(pick('landArea'));
    if (pick('landUnit') === 'A') put(facts, 'lot_acres', size);
    if (pick('landUnit') === 'S') put(facts, 'lot_sqft', size);
  }
  put(facts, 'zoning', word(pick('zoning')));
  put(facts, 'land_use', word(useWords));
  put(facts, 'county_use_code', code);
  const assessedYear = /^(\d{4})/.exec(pick('assessedOn'));
  if (assessedYear && Number(assessedYear[1]) > 1900) facts.value_year = Number(assessedYear[1]);
  const [land, improvements] = [positive(pick('land')), positive(pick('improvements'))];
  if (land || improvements) put(facts, 'market_value', (land || 0) + (improvements || 0));
  put(facts, 'market_land_value', land);
  put(facts, 'market_building_value', improvements);
  put(facts, 'assessed_value', positive(pick('assessed')));
  const sold = isoDate(pick('soldOn'));
  if (positive(pick('soldFor')) > 100 && sold) {
    facts.sale_price = positive(pick('soldFor'));
    facts.sale_date = sold;
  }
  return { id: `pp:${kind}:${fips}:${facts.parcel_number}`, kind, home_type: homeType, address: { ...address, city: String(pick('city')).trim().toUpperCase(), zip: zipCode(pick('zip')) }, facts };
}

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const about = await getJson(`https://${DOMAIN}/api/views/${DATASET}.json`, 'The dataset\'s description');
  const asOf = isoDate((about.rowsUpdatedAt || 0) * 1000);
  if (!asOf) throw new Error('The dataset no longer says when it changed');
  for (const [name, fips] of Object.entries(COUNTIES)) {
    if (only.length && !only.includes(fips)) continue;
    const county = name === 'Baltimore City' ? name : `${name} County`;
    const records = [];
    let noAddress = 0;
    const rows = cached(path.join(work, 'md-sdat', `${fips}.jsonl.gz`), () => socrataRows(DOMAIN, DATASET, Object.values(COLUMN), { where: `${COLUMN.county}='${name.replace(/'/g, "''")}'` }));
    for await (const row of rows) {
      const record = fromRow(row, fips, county);
      if (record) records.push(record);
      else noAddress += 1;
    }
    log(`${county}: ${records.length} records, ${noAddress} without a street number`);
    for (const building of condoBuildings(records, { fips, county })) records.push(building);
    yield {
      fips, state: 'MD', name: county, publisher: 'Maryland Department of Assessments and Taxation', dataset: 'real property data', method: 'state', source: 'md-sdat', title: 'State records', as_of: asOf, stale_after_days: 120, records,
    };
  }
}

module.exports = { build };
