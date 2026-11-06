#!/usr/bin/env node
// The machine half of a statewide connector's check, for every county in a build. Prints counts only.
//
// Identity: each record is asked for by the source's own address text, the way a person would write it, then by its unit
// and its neighbors'. A wrong unit or a picked home is the failure; "ambiguous" is the contract working.
// Fields: each home against a second publication of the same data, where one exists. It proves the connector read,
// joined and scaled each column right. Whether the source is right is for a person (property-hand-check-sheet.js).
//
//   node backend/scripts/eval/property-state-check.js --out <build dir> [--work <downloads>] [--fields <check name>]
'use strict';

const fs = require('fs');
const path = require('path');
const { openRelease } = require('./lib/propertyRelease');
const { layerRows, socrataRows, cached } = require('../../../scripts/property-index/lib/services.cjs');
const { parse, sortKey, zip5 } = require('../../services/propertyRecords/addressKey');
const { resolve } = require('../../services/propertyRecords/identity');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const out = opt('--out');
const work = opt('--work') || path.join(out, 'work');

const table = (title, rows) => {
  const total = Object.values(rows).reduce((sum, n) => sum + n, 0);
  console.log(`${title}: ${total}`);
  for (const [name, n] of Object.entries(rows).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(9)}  ${((100 * n) / total).toFixed(2).padStart(6)}%  ${name}`);
};

function identity(fips, totals) {
  const release = openRelease(out, fips);
  const bump = (part, outcome) => {
    totals[part] ||= {};
    totals[part][outcome] = (totals[part][outcome] || 0) + 1;
  };
  const ask = (query) => resolve(query, release.at(sortKey(query)));
  const label = (answer) => `${answer.match}${answer.reason ? ` (${answer.reason})` : ''}`;
  const buildings = [];
  const homesAtKey = new Map();
  for (const record of release.records()) {
    if (record.restricted) continue;
    if (record.kind === 'building') buildings.push(record);
    if (record.kind !== 'property' && record.kind !== 'unit') continue;
    // A unit's own text often ends in a bare token no person would type; the units are asked for below.
    const line = record.facts.address_on_record;
    const query = line ? parse(line) : null;
    if (query && (record.kind !== 'unit' || query.unit)) {
      const answer = ask({ ...query, zip: record.address.zip, city: record.address.city });
      const part = `Own address text: ${record.kind}`;
      if (answer.match !== 'exact') bump(part, label(answer));
      else if (answer.record.id === record.id) bump(part, 'exact, right record');
      else if (answer.record.facts.parcel_number === record.facts.parcel_number) bump(part, 'exact, right record');
      else bump(part, 'EXACT, WRONG RECORD');
    }
    if (record.kind === 'unit' && record.address.unit) {
      const answer = ask({ ...record.address });
      bump('Adjacent units', answer.match === 'exact' && answer.record.id === record.id ? 'exact, this unit' : (answer.match === 'exact' ? 'EXACT, WRONG UNIT' : label(answer)));
    }
    if (record.kind === 'property' && !record.address.unit) {
      const key = `${record.key}|${record.address.number}|${record.address.pre}|${record.address.suffix}|${record.address.post}|${record.address.zip}`;
      homesAtKey.set(key, [...(homesAtKey.get(key) || []), record]);
    }
  }
  const seen = new Set();
  for (const building of buildings) {
    if (seen.has(building.id) || !(building.roster || []).length) continue;
    seen.add(building.id);
    const answer = ask({ ...building.address, unit: 'ZZ9999', building: '', city: '' });
    bump('Units that do not exist', answer.match === 'exact' ? 'EXACT, WRONG UNIT' : label(answer));
  }
  for (const homes of homesAtKey.values()) {
    if (homes.length < 2) continue;
    const distinct = new Set(homes.map((home) => home.id));
    if (distinct.size < 2) continue;
    const answer = ask({ ...homes[0].address, unit: '', building: '', city: '' });
    bump('Addresses with several homes', answer.match === 'exact' ? 'EXACT (PICKED ONE)' : label(answer));
  }
  return release;
}

const near = (tolerance) => (a, b) => Math.abs(Number(a) - Number(b)) <= tolerance;
const same = near(0.5);
const moneyNear = (a, b) => Math.abs(Number(a) - Number(b)) <= Math.max(1, Number(b) * 0.001);

// A second publication per source. `county` limits the check where the second publication is one county's own file.
// `map` is [our fact, its column, optional comparison]. A year-apart vintage is only fair for facts that rarely change.
const CHECKS = {
  'ma-boston': {
    county: '25025', rows: () => layerRows('https://gis.boston.gov/arcgis/rest/services/Assessing/PROPERTY_ASSESSMENT_PARCEL_JOIN_FY26/MapServer/0', ['PID', 'YR_BUILT', 'LIVING_AREA', 'GROSS_AREA', 'BED_RMS', 'FULL_BTH', 'HLF_BTH', 'TOTAL_VALUE', 'LAND_VALUE', 'LAND_SF', 'TT_RMS']),
    id: (row) => row.PID,
    map: [['year_built', 'YR_BUILT'], ['living_sqft', 'LIVING_AREA'], ['gross_sqft', 'GROSS_AREA'], ['bedrooms', 'BED_RMS'], ['full_baths', 'FULL_BTH'], ['half_baths', 'HLF_BTH'], ['rooms', 'TT_RMS'], ['assessed_value', 'TOTAL_VALUE', moneyNear], ['assessed_land_value', 'LAND_VALUE', moneyNear], ['lot_sqft', 'LAND_SF']],
  },
  'ny-kings': {
    county: '36047', rows: () => layerRows('https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/1', ['SWIS_SBL_ID', 'SBL', 'YR_BLT', 'SQFT_LIVING', 'TOTAL_AV'], { where: "COUNTY_NAME = 'Kings'", pageSize: 5000 }),
    id: (row) => row.SBL,
    map: [['year_built', 'YR_BLT'], ['gross_sqft', 'SQFT_LIVING'], ['assessed_value', 'TOTAL_AV', moneyNear]],
  },
  'ct-2025': {
    rows: () => socrataRows('data.ct.gov', 'rny9-6ak2', ['pid', 'town_id', 'ayb', 'living_area', 'number_of_bedroom', 'number_of_baths', 'number_of_half_baths', 'land_acres', 'stories']),
    id: (row) => `${Math.trunc(Number(row.town_id))}-${String(row.pid ?? '').replace(/\.0+$/, '')}`,
    recordId: (record) => record.id.split(':').pop().replace(/\.0+$/, ''),
    map: [['year_built', 'ayb'], ['living_sqft', 'living_area', near(2)], ['bedrooms', 'number_of_bedroom'], ['full_baths', 'number_of_baths'], ['half_baths', 'number_of_half_baths'], ['lot_acres', 'land_acres', near(0.02)], ['stories', 'stories']],
  },
  'md-imap': {
    county: '24029', rows: () => layerRows('https://geodata.md.gov/imap/rest/services/PlanningCadastre/MD_PropertyData/MapServer/0', ['ACCTID', 'YEARBLT', 'SQFTSTRC', 'BLDG_UNITS', 'CONSIDR1', 'NFMLNDVL', 'NFMIMPVL'], { where: "JURSCODE = 'KENT'" }),
    id: (row) => row.ACCTID,
    map: [['year_built', 'YEARBLT'], ['living_sqft', 'SQFTSTRC'], ['sale_price', 'CONSIDR1', moneyNear], ['market_land_value', 'NFMLNDVL', moneyNear], ['market_building_value', 'NFMIMPVL', moneyNear]],
  },
  'nj-state-server': {
    county: '34033', rows: () => layerRows('https://maps.nj.gov/arcgis/rest/services/Framework/Cadastral/MapServer/0', ['PAMS_PIN', 'YR_CONSTR', 'NET_VALUE', 'LAND_VAL', 'IMPRVT_VAL', 'SALE_PRICE'], { where: "COUNTY = 'SALEM'" }),
    id: (row) => row.PAMS_PIN,
    map: [['year_built', 'YR_CONSTR'], ['assessed_value', 'NET_VALUE', moneyNear], ['assessed_land_value', 'LAND_VAL', moneyNear], ['assessed_building_value', 'IMPRVT_VAL', moneyNear], ['sale_price', 'SALE_PRICE', moneyNear]],
  },
  'tx-collin': {
    // The district's own file is a year behind StratMap's, so only what doesn't change in a year is fair to compare.
    county: '48085', rows: () => socrataRows('data.texas.gov', 'vffy-snc6', ['propid', 'imprvyearbuilt']),
    id: (row) => row.propid,
    map: [['year_built', 'imprvyearbuilt']],
  },
  'mn-hennepin': {
    county: '27053', rows: () => layerRows('https://gis.hennepin.us/arcgis/rest/services/HennepinData/LAND_PROPERTY/MapServer/1', ['PID', 'BUILD_YR', 'MKT_VAL_TOT', 'SALE_PRICE', 'PARCEL_AREA']),
    id: (row) => row.PID,
    map: [['year_built', 'BUILD_YR'], ['market_value', 'MKT_VAL_TOT', moneyNear], ['sale_price', 'SALE_PRICE', moneyNear]],
  },
  'nc-wake': {
    county: '37183', rows: () => layerRows('https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer/0', ['PIN_NUM', 'REID', 'YEAR_BUILT', 'HEATEDAREA', 'TOTSALPRICE', 'TOTAL_VALUE_ASSD']),
    id: (row) => row.PIN_NUM,
    map: [['year_built', 'YEAR_BUILT'], ['assessed_value', 'TOTAL_VALUE_ASSD', moneyNear]],
  },
};

async function fields(name, releases) {
  const check = CHECKS[name];
  if (!check) throw new Error(`Checks: ${Object.keys(CHECKS).join(', ')}`);
  const byId = new Map();
  for (const release of releases) {
    if (check.county && release.county.fips !== check.county) continue;
    for (const record of release.records()) {
      if (record.kind === 'building' && record.home_type === 'condo' && !record.facts.parcel_number) continue;
      const id = String(record.facts.parcel_number ?? '').trim();
      if (id) byId.set(check.recordId ? check.recordId(record) : id, record);
    }
  }
  const tally = {};
  let matched = 0;
  let rows = 0;
  const file = path.join(work, 'state-check', `${name}.jsonl.gz`);
  for await (const row of cached(file, check.rows)) {
    rows += 1;
    const id = String(check.id(row) ?? '').trim();
    const record = byId.get(id);
    if (!record) continue;
    matched += 1;
    for (const [fact, column, compare = same] of check.map) {
      const entry = (tally[fact] ||= { compared: 0, equal: 0, differ: 0, oursOnly: 0, theirsOnly: 0 });
      const ours = record.facts[fact];
      const theirs = Number(row[column]) ? row[column] : null;
      if (ours && theirs) {
        entry.compared += 1;
        if (compare(ours, theirs)) entry.equal += 1;
        else entry.differ += 1;
      } else if (ours) entry.oursOnly += 1;
      else if (theirs) entry.theirsOnly += 1;
    }
  }
  console.log(`\n${name}: ${rows} rows read, ${matched} matched to ${byId.size} records`);
  console.log(`${'fact'.padEnd(26)}${'compared'.padStart(10)}${'equal %'.padStart(9)}${'differ'.padStart(9)}${'ours only'.padStart(11)}${'theirs only'.padStart(12)}`);
  for (const [fact, row] of Object.entries(tally)) {
    const share = row.compared ? ((100 * row.equal) / row.compared).toFixed(2) : '-';
    console.log(`${fact.padEnd(26)}${String(row.compared).padStart(10)}${share.padStart(9)}${String(row.differ).padStart(9)}${String(row.oursOnly).padStart(11)}${String(row.theirsOnly).padStart(12)}`);
  }
}

(async () => {
  const counties = fs.readdirSync(path.join(out, 'counties')).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)).sort();
  const totals = {};
  const releases = [];
  for (const fips of counties) releases.push(identity(fips, totals));
  console.log(`${counties.length} counties`);
  for (const [part, outcomes] of Object.entries(totals)) table(part, outcomes);
  if (opt('--fields')) await fields(opt('--fields'), releases);
})().catch((err) => {
  console.error(err.constructor === Error ? err.message : err.name);
  process.exit(1);
});
