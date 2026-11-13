'use strict';
// ============================================================
// RECORD VOCABULARY — the words a build asks for with ?vocabulary=2.
//
// A build that understands where a record comes from says so on Add Home's
// property suggestions, Property details, the Home's value and Place (as
// `ballot=1` does for Ballot). Every other build keeps today's field names and
// allowed values, word for word: the apps in the stores drop a whole card on a
// value they don't know. Old servers ignore the flag, so the new builds read
// both vocabularies.
//
// A record that names its source carries a `provenance`:
//   { publisher, dataset, as_of: 'YYYY-MM-DD', scope: unit|building|parcel|area,
//     method: county|state|recorder|manager|household|estimate,
//     label: "From Clark County Assessor's records, updated Oct 31, 2026", title?: 'County records' }
// The apps draw `label` as it comes. ATTOM's answers carry none, so the lines
// the server already sends for them don't change.
// ============================================================

const { addHomeQuestions } = require('./householdFacts');
const { addHomePart } = require('./propertyRecords/floorPlanFormat');

const VOCABULARY = '2';
const RECORD_TIER = 'record';
const GUESS_TIERS = new Set(['heuristic', 'llm']);

const wantsRecordVocabulary = (req) => req.query?.vocabulary === VOCABULARY;

function lookupMessage(tiers, lookup, provenance) {
  if (lookup === 'pending') return null;
  if (lookup === 'unavailable') return 'Public property records are unavailable right now. Confirm the details below.';
  if (tiers.some((tier) => !GUESS_TIERS.has(tier))) {
    return provenance?.scope === 'building'
      ? "We found the building. Your unit's details weren't in the county record."
      : 'Public property records found. Review them before continuing.';
  }
  return tiers.length
    ? "We couldn't find public records for this address, so we filled in what we could from address hints. You can change them anytime."
    : "We couldn't find public records for this address. Tell us the basics; you can change them anytime.";
}

/** POST /api/homes/property-suggestions: the new words sit beside today's, so `tiers_used` still says `attom` for ATTOM. */
function suggestions(result, wanted) {
  const { provenance = null, field_tags: fieldTags = null, lookup_note: note = null, record_age: age = null, county_page: countyPage = null, county_check: countyCheck = null, floor_plan: floorPlan = null, ...legacy } = result;
  if (!wanted) return legacy;
  const planPart = floorPlan ? addHomePart(floorPlan) : null;
  const tiers = legacy.tiers_used || [];
  const lookup = legacy.attom_lookup;
  // A sheet that found this unit isn't a public record, and isn't "no record" to the person reading the form either.
  const said = note || (planPart?.match === 'exact' && !provenance ? "We found your unit on the building's floor-plan sheet. Check the details below." : lookupMessage(tiers, lookup, provenance));
  // A county's release past its date that still answers: how old its records are, plainly (propertyRecords/homeRecord.js).
  const message = said && age ? `${said} These county records were last updated ${age}; some details may have changed since.` : said;
  const questions = addHomeQuestions(legacy.suggestions, lookup);
  return {
    ...legacy,
    tiers_used: tiers.includes('attom') && !tiers.includes(RECORD_TIER) ? [...tiers, RECORD_TIER] : tiers,
    ...(lookup ? { record_lookup: lookup } : {}),
    ...(message ? { lookup_message: message } : {}),
    ...(provenance ? { provenance } : {}),
    ...(fieldTags ? { field_tags: fieldTags } : {}),
    ...(questions.length ? { questions } : {}),
    ...(countyPage ? { county_page: countyPage } : {}),
    ...(countyCheck ? { county_check: countyCheck } : {}),
    ...(planPart ? { floor_plan: planPart } : {}),
  };
}

/** What the Home's value came from, when it isn't the same record as its facts. */
const valueProvenance = (profile) => profile?.value_provenance || profile?.provenance || null;

/**
 * GET /api/homes/:id/property-value. For older builds a record-based answer stays `source: cache`.
 * `card`: the value card (services/homeValueCard.js), which a build that asks for the new words draws.
 */
function propertyValue(answer, profile, wanted, card = null) {
  if (!wanted) return answer;
  const provenance = valueProvenance(profile);
  const withCard = { ...answer, ...(card ? { value_card: card } : {}) };
  if (!provenance) return withCard;
  return {
    ...withCard,
    source: answer.source === 'cache_stale' ? 'record_stale' : 'record',
    provenance,
    ...(profile.value_title ? { value_title: profile.value_title } : {}),
  };
}

const withoutRowTags = (record) => record && {
  ...record,
  sections: record.sections.map((section) => ({
    ...section,
    rows: section.rows.map(({ tag, note, ...row }) => row),
  })),
};

/**
 * GET /api/homes/:id/property-details. A row tag says a row came from somewhere other than the footer's source,
 * and a row note says what stands beside it. `household` (services/householdFacts.js) goes only to builds that ask:
 * every other build gets the record as the county has it.
 */
function propertyDetail(result, wanted) {
  const { provenance = null, household = null, ...legacy } = result;
  if (!wanted) return { ...legacy, county_record: withoutRowTags(legacy.county_record) };
  const { record_view: view = null, ...part } = household || {};
  return {
    ...legacy,
    ...(view ? { county_record: view } : {}),
    ...(provenance ? { source: RECORD_TIER, provenance } : {}),
    ...(household ? { household: part } : {}),
  };
}

/** Place's value block: nulled with the other value fields for anyone but the confirmed owner. */
function placeValueFields(profile, card = null) {
  const label = valueProvenance(profile)?.label;
  return {
    ...(label ? { value_source: label } : {}),
    ...(profile.value_title ? { value_title: profile.value_title } : {}),
    ...(card ? { value_card: card } : {}),
  };
}

module.exports = { wantsRecordVocabulary, suggestions, propertyValue, propertyDetail, placeValueFields };
