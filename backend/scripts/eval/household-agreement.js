#!/usr/bin/env node
// The agreement score's household half (docs/research/provider-replacement/full-page-plan.md section 6): per county and
// Property details row, how often a verified household that answered "Is this right?" about its county record said yes.
// Read-only and counts only: it asks the database for two things per Home, its household's entries
// (`niche_data.household_facts`, services/householdFacts.js) and its county record's county, and prints no Home, person or
// value. A confirmed entry agrees with the record; a corrected one, where the record had a value, disagrees. Entries the
// record had nothing for, unverified writers' entries and link-and-confirm checks (no county record) aren't counted.
//
//   node backend/scripts/eval/household-agreement.js [--out <file.json>]
// Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment (backend/.env for a local stack). Its --out file
// goes to scripts/property-index/coverage.cjs --answers, which shows a share only from MIN_ANSWERS answers a row.
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env'), quiet: true });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { MIN_ANSWERS } = require('../../../scripts/property-index/lib/agreement.cjs');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const PAGE = 1000;

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const counties = {};
  let homes = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('Home')
      .select('id, entries:niche_data->household_facts->fields, fips:niche_data->property_record->>jurisdiction')
      .not('niche_data->household_facts', 'is', null)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`The read failed: ${error.code || error.message}`);
    for (const { entries, fips } of data) {
      if (!/^\d{5}$/.test(fips || '') || !entries || typeof entries !== 'object') continue;
      let counted = false;
      for (const [fact, entry] of Object.entries(entries)) {
        if (!entry?.verified || entry.via === 'county_page') continue;
        const agrees = entry.action === 'confirmed';
        if (!agrees && !(entry.action === 'corrected' && entry.record !== null && entry.record !== undefined)) continue;
        counties[fips] = counties[fips] || { homes: 0, rows: {} };
        const row = counties[fips].rows[fact] = counties[fips].rows[fact] || { compared: 0, agree: 0 };
        row.compared += 1;
        if (agrees) row.agree += 1;
        counted = true;
      }
      if (counted) {
        counties[fips].homes += 1;
        homes += 1;
      }
    }
    if (data.length < PAGE) break;
  }
  const answers = Object.values(counties).reduce((sum, county) => sum + Object.values(county.rows).reduce((n, row) => n + row.compared, 0), 0);
  console.log(`${homes} Homes in ${Object.keys(counties).length} counties answered "Is this right?" about their county record: ${answers} answers`);
  console.log(['fips', 'row', 'answers', 'agree'].join('\t'));
  for (const [fips, { rows }] of Object.entries(counties).sort()) {
    for (const [fact, { compared, agree }] of Object.entries(rows).sort()) {
      console.log([fips, fact, compared, compared >= MIN_ANSWERS ? `${Math.round((100 * agree) / compared)}%` : 'too few'].join('\t'));
    }
  }
  if (opt('--out')) fs.writeFileSync(opt('--out'), `${JSON.stringify({ written_at: new Date().toISOString(), min_answers: MIN_ANSWERS, counties }, null, 1)}\n`);
}

main().catch((err) => {
  console.error(err.constructor === Error ? err.message : err.name);
  process.exit(1);
});
