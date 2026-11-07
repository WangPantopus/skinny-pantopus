#!/usr/bin/env node
// G7 (docs/research/provider-replacement/experience.md): every home with any official value in a county's release, through
// the real profile and card builders. Does the owner's card show a value, and does an assessment ever read as market value?
// Local files only, no database. Prints counts, never a home.
//
//   node backend/scripts/eval/value-g7.js --root <local index root> --fips 53011,34033
'use strict';

process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'unused';
process.env.SUPABASE_ANON_KEY ||= 'unused';

const { openRelease } = require('./lib/propertyRelease');
const { buildProfileFromRecord } = require('../../services/ai/propertyIntelligenceService');
const homeValueCard = require('../../services/homeValueCard');
const { stateOfCounty } = require('../../services/propertyRecords/addressKey');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const root = opt('--root');
const fipsList = (opt('--fips') || '').split(',').filter(Boolean);
if (!root || !fipsList.length) throw new Error('usage: see the top of value-g7.js');

console.log(['county', 'homes', 'with a value', 'card shows it', 'card empty', 'assessment only', 'reads as market', 'fills the old "estimate"'].join('\t'));
for (const fips of fipsList) {
  const release = openRelease(root, fips);
  const state = stateOfCounty(fips);
  const count = { homes: 0, valued: 0, shown: 0, empty: 0, assessedOnly: 0, readsAsMarket: 0, oldEstimate: 0 };
  for (const record of release.records()) {
    if (record.kind === 'property' || record.kind === 'unit') {
      count.homes += 1;
      const { facts } = record;
      if (facts.market_value || facts.assessed_value || facts.taxable_value) {
        count.valued += 1;
        const profile = buildProfileFromRecord({ id: 'home', city: '', state, zipcode: '' }, {
          schema: 1,
          match: 'exact',
          subject: { kind: record.kind },
          jurisdiction: fips,
          as_of: release.county.as_of,
          publisher: release.county.publisher,
          dataset: release.county.dataset,
          method: release.county.method,
          facts,
        });
        const card = homeValueCard.build(profile);
        if (card?.value) count.shown += 1;
        else count.empty += 1;
        if (!facts.market_value) {
          count.assessedOnly += 1;
          if (/market/i.test(`${card?.title} ${card?.summary}`)) count.readsAsMarket += 1;
          if (profile.estimated_value != null) count.oldEstimate += 1;
        }
      }
    }
  }
  console.log([fips, count.homes, count.valued, count.shown, count.empty, count.assessedOnly, count.readsAsMarket, count.oldEstimate].join('\t'));
}
process.exit(0);
