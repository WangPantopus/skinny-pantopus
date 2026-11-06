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
  const { provenance = null, field_tags: fieldTags = null, ...legacy } = result;
  if (!wanted) return legacy;
  const tiers = legacy.tiers_used || [];
  const lookup = legacy.attom_lookup;
  const message = lookupMessage(tiers, lookup, provenance);
  return {
    ...legacy,
    tiers_used: tiers.includes('attom') && !tiers.includes(RECORD_TIER) ? [...tiers, RECORD_TIER] : tiers,
    ...(lookup ? { record_lookup: lookup } : {}),
    ...(message ? { lookup_message: message } : {}),
    ...(provenance ? { provenance } : {}),
    ...(fieldTags ? { field_tags: fieldTags } : {}),
  };
}

/** What the Home's value came from, when it isn't the same record as its facts. */
const valueProvenance = (profile) => profile?.value_provenance || profile?.provenance || null;

/** GET /api/homes/:id/property-value. For older builds a record-based answer stays `source: cache`. */
function propertyValue(answer, profile, wanted) {
  const provenance = wanted ? valueProvenance(profile) : null;
  if (!provenance) return answer;
  return {
    ...answer,
    source: answer.source === 'cache_stale' ? 'record_stale' : 'record',
    provenance,
    ...(profile.value_title ? { value_title: profile.value_title } : {}),
  };
}

const withoutRowTags = (record) => record && {
  ...record,
  sections: record.sections.map((section) => ({
    ...section,
    rows: section.rows.map(({ tag, ...row }) => row),
  })),
};

/** GET /api/homes/:id/property-details. A row tag says a row came from somewhere other than the footer's source. */
function propertyDetail(result, wanted) {
  const { provenance = null, ...legacy } = result;
  if (!wanted) return { ...legacy, county_record: withoutRowTags(legacy.county_record) };
  return provenance ? { ...legacy, source: RECORD_TIER, provenance } : legacy;
}

/** Place's value block: nulled with the other value fields for anyone but the confirmed owner. */
function placeValueFields(profile) {
  const label = valueProvenance(profile)?.label;
  return {
    ...(label ? { value_source: label } : {}),
    ...(profile.value_title ? { value_title: profile.value_title } : {}),
  };
}

module.exports = { wantsRecordVocabulary, suggestions, propertyValue, propertyDetail, placeValueFields };
