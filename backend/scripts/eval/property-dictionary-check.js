#!/usr/bin/env node
// A county connector's mapping against its publisher's own dictionary and against what it built. Prints counts and the
// county's code words, never an address.
//
// Each column a fact reads must exist in the publisher's field list, under a name or description that says what the fact
// says. Each word the connector gives a code must be in the publisher's dictionary. Each fact with a unit must look like
// that unit once built: a lot column in acres read as square feet, or a value in thousands, shows up in the medians.
//
//   node backend/scripts/eval/property-dictionary-check.js --source ca-los-angeles --out <build dir> [--pdftext <tool>]
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { openRelease } = require('./lib/propertyRelease');
const { FACTS } = require('../../services/propertyRecords/facts');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const USER_AGENT = 'Mozilla/5.0 (compatible; PantopusPropertyIndex/1.0; +https://pantopus.com)';

// What a column's name or description has to mention for this fact.
const SAYS = {
  year_built: /y(ea)?r|built|age/i, effective_year_built: /eff|y(ea)?r/i, living_sqft: /sq|sf|area|size|liv|feet/i, usable_sqft: /sq|sf|area|size/i, gross_sqft: /sq|sf|area|size|gross|gba|liv/i,
  ground_floor_sqft: /sq|sf|area|floor/i, bedrooms: /bed|bdrm|bd|br/i, bathrooms: /bath|bth|ba|plumb/i, full_baths: /f.*b(a)?th|bath|bth|full_?b|plumb/i, half_baths: /h.*b(a)?th|bath|bth|hlf_?b|plumb|powder/i, rooms: /room|rm/i, stories: /stor|stry|flr|floor/i,
  units: /unit|apt|apart|dwell|famil|ducount/i, lot_acres: /acre|ac|land|lot/i, lot_sqft: /sq|sf|area|land|lot|frontage/i, market_value: /val|mkt|market|appr|total|fmv|apr|just/i, market_land_value: /land|lnd/i, market_building_value: /bldg|build|imp|struct/i,
  assessed_value: /val|assess|assd|total/i, assessed_land_value: /land|lnd/i, assessed_building_value: /bldg|build|imp|struct/i, taxable_value: /tax/i, sale_price: /sale|price|consid|amount|amt/i, sale_date: /sale|date|dt|saldat/i,
  value_year: /y(ea)?r|roll/i, tax_year: /y(ea)?r|roll/i, tax_amount: /tax|amount|amt|bill/i, fireplaces: /fire|firpl|frpl|fp/i, garage_sqft: /gar|park/i, basement_sqft: /bas|bsmt|bsmnt/i, basement_finished_sqft: /bas|bsmt|bsmnt|fin/i,
};
// For the medians, by home: [lowest, highest]. A unit mix-up lands far outside these.
const MEDIANS = {
  year_built: [1850, 2026], effective_year_built: [1850, 2027], living_sqft: [350, 6000], gross_sqft: [350, 300000], lot_sqft: [800, 300000], lot_acres: [0.02, 40], bedrooms: [1, 6], bathrooms: [1, 5], full_baths: [1, 5], half_baths: [1, 2],
  rooms: [2, 14], stories: [1, 5], market_value: [10000, 5000000], market_land_value: [1000, 5000000], market_building_value: [1000, 5000000], assessed_value: [1000, 5000000], assessed_land_value: [100, 5000000], assessed_building_value: [100, 5000000],
  taxable_value: [1000, 5000000], sale_price: [5000, 5000000], tax_amount: [50, 100000], garage_sqft: [100, 2000], basement_sqft: [50, 5000], basement_finished_sqft: [50, 5000], fireplaces: [1, 3], value_year: [2015, 2028], tax_year: [2015, 2028],
};
// Nothing one home has more of.
const MOST = { bedrooms: 40, bathrooms: 40, full_baths: 40, half_baths: 20, rooms: 80, stories: 120, fireplaces: 30 };

const failures = [];
const fail = (text) => { failures.push(text); console.log(`  FAIL ${text}`); };

async function getText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`A dictionary answered ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function fieldList(dictionary) {
  const fields = new Map();
  if (dictionary.layer) {
    for (const layer of [].concat(dictionary.layer)) {
      const info = JSON.parse((await getText(`${layer}?f=json`)).toString('utf8'));
      for (const field of info.fields || []) fields.set(field.name.toLowerCase(), `${field.name} ${field.alias || ''} ${field.domain ? `domain ${field.domain.name}` : ''}`);
    }
  }
  if (dictionary.socrata) {
    for (const id of dictionary.socrata.ids) {
      const info = JSON.parse((await getText(`https://${dictionary.socrata.domain}/api/views/${id}.json`)).toString('utf8'));
      for (const column of info.columns || []) fields.set(column.fieldName.toLowerCase(), `${column.fieldName} ${column.name || ''} ${column.description || ''}`);
    }
  }
  if (dictionary.columns) {
    for (const column of dictionary.columns) fields.set(column.toLowerCase(), column);
  }
  return fields;
}

/** The words of a dictionary: a web page, a CSV, a PDF (needs --pdftext), or a local layout the connector names. */
async function dictionaryWords(dictionary) {
  const chunks = [];
  for (const url of [].concat(dictionary.text || [])) {
    const bytes = await getText(url);
    if (bytes.subarray(0, 4).toString('latin1') === '%PDF') {
      const tool = opt('--pdftext');
      if (!tool) {
        console.log('  (a PDF dictionary needs --pdftext; its words were not checked)');
        return null;
      }
      const file = path.join(fs.mkdtempSync(path.join(require('os').tmpdir(), 'dictionary-')), 'file.pdf');
      fs.writeFileSync(file, bytes);
      chunks.push(execFileSync(tool, [file], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8'));
    } else chunks.push(bytes.toString('latin1'));
  }
  return chunks.length ? chunks.join(' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').toUpperCase().replace(/[^A-Z0-9]+/g, ' ') : null;
}

function quantile(sorted, share) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] : null;
}

async function main() {
  const name = path.basename(opt('--source'));
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const { dictionary } = require(`../../../scripts/property-index/sources/${name}.cjs`);
  if (!dictionary) throw new Error(`${name} names no dictionary`);
  console.log(`${name}: columns`);
  const fields = await fieldList(dictionary);
  for (const [fact, column] of Object.entries(dictionary.facts || {})) {
    if (!FACTS[fact]) fail(`${fact} isn't a fact`);
    for (const one of [].concat(column)) {
      const known = fields.get(one.toLowerCase());
      if (/\(\)$/.test(one)) continue; // A geometry measure: the medians below check it.
      if (!known) fail(`${fact}: ${one} isn't in the publisher's list`);
      else if (SAYS[fact] && !SAYS[fact].test(known)) fail(`${fact}: ${known.slice(0, 80)} doesn't say so`);
    }
  }
  console.log(`  ${Object.keys(dictionary.facts || {}).length} facts read against ${fields.size} published columns`);

  const words = await dictionaryWords(dictionary);
  if (words) {
    let checked = 0;
    for (const [column, table] of Object.entries(dictionary.words || {})) {
      for (const [code, word] of Object.entries(table)) {
        // The publisher's word, as it wrote it: `said` when ours is plainer.
        const said = String(typeof word === 'object' ? word.said : word).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
        checked += 1;
        if (!words.includes(said)) fail(`${column} ${code}: "${said}" isn't in the dictionary`);
      }
    }
    console.log(`  ${checked} code words read against the dictionary`);
  }

  const out = opt('--out');
  for (const file of fs.readdirSync(path.join(out, 'counties')).filter((entry) => entry.endsWith('.json'))) {
    const release = openRelease(out, file.slice(0, -5));
    console.log(`${release.county.fips} ${release.county.name}, as of ${release.county.as_of}: ${release.county.records} records`);
    const groups = new Map();
    const wordsSeen = new Map();
    for (const record of release.records()) {
      if (record.kind === 'building' && record.home_type === 'condo' && !record.facts.parcel_number) continue;
      const group = `${record.kind}:${record.home_type || '-'}`;
      if (!groups.has(group)) groups.set(group, { records: 0, facts: new Map() });
      const entry = groups.get(group);
      entry.records += 1;
      for (const [fact, value] of Object.entries(record.facts)) {
        if (MEDIANS[fact] || MOST[fact]) {
          if (!entry.facts.has(fact)) entry.facts.set(fact, []);
          entry.facts.get(fact).push(Number(value));
        }
        if (FACTS[fact]?.format === 'text' && fact !== 'land_use' && fact !== 'property_class') {
          if (!wordsSeen.has(fact)) wordsSeen.set(fact, new Map());
          const seen = wordsSeen.get(fact);
          seen.set(value, (seen.get(value) || 0) + 1);
        }
      }
    }
    for (const [group, { records, facts }] of groups) {
      if (records < 200 || /^(other|parcel):/.test(group)) continue;
      const parts = [];
      for (const [fact, values] of facts) {
        values.sort((a, b) => a - b);
        const median = quantile(values, 0.5);
        parts.push(`${fact} ${median} (${Math.round((100 * values.length) / records)}%)`);
        const range = MEDIANS[fact];
        // A whole apartment building's value or sale is its own scale.
        if (range && !(group.startsWith('building:') && FACTS[fact]?.value) && (median < range[0] || median > range[1])) fail(`${group} ${fact}: the median is ${median}, expected ${range[0]} to ${range[1]}`);
        if (MOST[fact] && /^(property|unit):/.test(group) && values[values.length - 1] > MOST[fact]) fail(`${group} ${fact}: the most is ${values[values.length - 1]}`);
      }
      console.log(`  ${group}: ${records}; ${parts.join(', ')}`);
    }
    for (const [fact, seen] of wordsSeen) {
      const top = [...seen].sort((a, b) => b[1] - a[1]);
      const codes = top.filter(([value]) => /^[A-Z0-9]{1,3}$/.test(String(value)) && !/^(YES|NO|GAS|OIL|AC|LOG|TAR)$/i.test(String(value)));
      console.log(`  ${fact}: ${top.slice(0, 14).map(([value, n]) => `${value} ${n}`).join('; ')}${top.length > 14 ? `; and ${top.length - 14} more` : ''}`);
      if (codes.length) fail(`${fact} shows what look like codes: ${codes.slice(0, 8).map(([value]) => value).join(', ')}`);
    }
  }
  console.log(failures.length ? `${failures.length} problems` : 'No problems');
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err.constructor === Error ? err.message : err.name);
  process.exit(1);
});
