#!/usr/bin/env node
// WP7's bar: no estimate in a record field. What can be proved without a screen, printed as a report: the two fact tables
// share no name, a record's projector can't show an estimate's facts even if a copy somehow held them, and the estimate's
// own slot says what it is. The screens are checked in the apps.
//   node backend/scripts/eval/property-estimate-check.js
'use strict';

const { FACTS } = require('../../services/propertyRecords/facts');
const { ESTIMATE_FACTS } = require('../../services/propertyRecords/estimateFacts');
const { serializePropertyRecord, serializeEstimate } = require('../../serializers/countyRecordSerializer');

let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
};

const shared = Object.keys(ESTIMATE_FACTS).filter((name) => FACTS[name]);
check('No fact name is both a record fact and an estimate fact', shared.length === 0);

const modeled = { modeled_sqft: 1900, modeled_stories: 2, footprint_sqft: 1000, building_use: 'Single family', structures_at_address: 1, block_group: '500070001001' };
const record = serializePropertyRecord({
  schema: 1, match: 'exact', subject: { kind: 'property', id: 'x' }, as_of: '2026-11-01', publisher: 'A county', dataset: 'a file',
  facts: { year_built: 1950, ...modeled },
});
const recordRows = record.sections.flatMap((section) => section.rows);
check('A record\'s projector shows nothing from the estimate table', !recordRows.some((row) => Object.keys(ESTIMATE_FACTS).includes(row.id)));
check('A record never says "estimate"', !JSON.stringify(record).toLowerCase().includes('estimate'));

const estimate = serializeEstimate({
  structure: modeled,
  area: { scope: 'block_group', median_year_built: 1978, median_rooms: 6.2, most_common_bedrooms: 3, most_common_bedrooms_share: 54 },
  source: 'FEMA, the U.S. Army Corps of Engineers and the U.S. Census Bureau',
});
check('The estimate is one section, marked and titled as one', estimate.estimate === true && estimate.sections.length === 1 && estimate.sections[0].id === 'estimate' && estimate.sections[0].title === 'Estimate for similar homes nearby');
check('Its rows have their own ids, never a record fact\'s', estimate.sections[0].rows.every((row) => row.id.startsWith('estimate_') && !FACTS[row.id]));
check('Its figures read as approximate', estimate.sections[0].rows.every((row) => /^(About|Around|\d|No separate)/.test(row.value)));
check('Its note and footer say it isn\'t a record', /not a record/.test(estimate.sections[0].note) && /not a public record/.test(estimate.footer));

const own = serializeEstimate({ structure: modeled, area: { scope: 'zip', median_year_built: 1978, median_rooms: 6, most_common_bedrooms: 3 }, source: 'x' }, { sq_ft: 2000, year_built: 2001, bedrooms: 4 });
const ownIds = own.sections[0].rows.map((row) => row.id);
check('A household\'s own entry replaces the matching row', !ownIds.includes('estimate_size') && !ownIds.includes('estimate_year') && !ownIds.includes('estimate_bedrooms'));
const flat = serializeEstimate({ structure: { ...modeled, building_use: 'Multifamily' }, area: null, source: 'x' });
check('A building\'s figures are never offered as a home\'s', flat === null);
const unit = serializeEstimate({ structure: modeled, area: null, source: 'x' }, { address2: 'Unit 4' });
check('A home with a unit gets no structure figures', unit === null);

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
