/**
 * Tiered property field suggestions for Add Home step 2:
 * 0) The county's own record, in a county that is live on it (services/propertyRecords): no ATTOM there
 * 1) ATTOM (structured US assessor-style data)
 * 2) Heuristics from HomeAddress + Places classification
 * 3) Optional LLM (PROPERTY_SUGGESTIONS_LLM=1, Claude) — fills gaps only; never overrides ATTOM
 */

const logger = require('../../utils/logger');
const { getAnthropicClient, resolveModel, resolveEffort, DRAFT_MODEL } = require('../../config/anthropic');
const { complete, isTimeoutError, parseJsonObject } = require('./llm');
const {
  fetchAttomPropertyDetailBundle,
  fetchAttomPropertyDetailBundleForAddress,
} = require('./propertyIntelligenceService');
const propertyRecords = require('../propertyRecords');
const homeRecords = require('../propertyRecords/homeRecord');

const LLM_TIMEOUT_MS = 12000;
// Several plausible records at an address: which one isn't for us to guess, so nothing fills in and the person is told why.
const SEVERAL_RECORDS_NOTE = 'More than one home is on record at this address, so we left the details for you. Add your unit if you have one, or tell us the basics.';
// A leftover PROPERTY_SUGGESTIONS_LLM_MODEL naming another provider's model is ignored.
const LLM_MODEL = resolveModel(process.env.PROPERTY_SUGGESTIONS_LLM_MODEL, DRAFT_MODEL);
const LLM_EFFORT = resolveEffort(process.env.ANTHROPIC_DRAFT_EFFORT, 'low');
// The reply is a few fields; max_tokens also covers the model's thinking.
const LLM_MAX_TOKENS = 1024;

const CANONICAL_HOME_TYPES = new Set([
  'house', 'apartment', 'condo', 'townhouse', 'studio', 'rv', 'mobile_home', 'trailer', 'multi_unit', 'other',
]);

// Whole words only: ATTOM's land-use classes ("MUSEUM, LIBRARY, ART GALLERY
// (RECREATIONAL)", "SERVICE STATION", "INDUSTRIAL") must not read as an RV or
// a triplex. Anything not clearly residential leaves the type to the person.
function mapAttomPropertyTypeToCanonical(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const u = raw.toUpperCase();
  if (/\bCONDO(MINIUM)?S?\b/.test(u)) return 'condo';
  if (/\bTOWN ?HOUSES?\b|\bTOWN ?HOMES?\b/.test(u)) return 'townhouse';
  if (/\bAPARTMENTS?\b|\bAPT\b/.test(u)) return 'apartment';
  if (/\b(DUPLEX|TRIPLEX|QUADRUPLEX)\b|\bMULTI[ -]?FAMILY\b/.test(u)) return 'multi_unit';
  if (/\bSFR\b|\bSINGLE[ -]FAMILY\b|\bRESIDENTIAL\b/.test(u)) return 'house';
  if (/\bMOBILE\b|\bMANUFACTURED\b/.test(u)) return 'mobile_home';
  if (/\bSTUDIO\b/.test(u)) return 'studio';
  if (/\bRV\b|\bRECREATIONAL VEHICLES?\b/.test(u)) return 'rv';
  return null;
}

/** Add Home's fields from a county record: a unit's or a home's own facts only on an exact match. */
function fillFromRecord(copy, merged, sources, tags) {
  const facts = copy.facts || {};
  const building = copy.building || {};
  const set = (field, value, tag) => {
    if (value == null) return;
    merged[field] = value;
    sources[field] = 'record';
    tags[field] = tag;
  };
  if (CANONICAL_HOME_TYPES.has(copy.home_type)) set('home_type', copy.home_type, copy.match === 'exact' ? 'County' : 'Building');
  set('year_built', facts.year_built ?? building.year_built ?? null, copy.match === 'exact' ? 'County' : 'Building');
  if (copy.match === 'exact') {
    set('bedrooms', facts.bedrooms ?? null, 'County');
    set('bathrooms', facts.bathrooms ?? null, 'County');
    set('sq_ft', facts.living_sqft != null ? Math.round(facts.living_sqft) : null, 'County');
  }
  if (copy.match !== 'building_only') {
    const lot = facts.lot_sqft ?? (facts.lot_acres ? facts.lot_acres * 43560 : null);
    if (copy.subject?.kind !== 'unit') set('lot_sq_ft', lot != null ? Math.round(lot) : null, 'County');
  }
}

/**
 * Heuristic home_type + weak hints from validation pipeline / DB row.
 */
function buildHeuristicSuggestions({ classification, homeAddressRow, unit_number }) {
  const out = {};
  const bt = classification?.building_type || homeAddressRow?.building_type || '';
  const pt = classification?.parcel_type || homeAddressRow?.parcel_type || '';
  const types = Array.isArray(classification?.google_place_types)
    ? classification.google_place_types
    : (Array.isArray(homeAddressRow?.google_place_types) ? homeAddressRow.google_place_types : []);
  const typeStr = types.join(' ').toLowerCase();

  if (bt === 'multi_unit' || pt === 'commercial' || /apartment|subpremise|premise/.test(typeStr)) {
    out.home_type = unit_number ? 'apartment' : (out.home_type || 'apartment');
  } else if (bt === 'single_family') {
    out.home_type = 'house';
  }

  const units = homeAddressRow?.residential_unit_count;
  if (typeof units === 'number' && units > 1 && !out.home_type) {
    out.home_type = 'multi_unit';
  }

  return out;
}

function isLlmEnabled() {
  return process.env.PROPERTY_SUGGESTIONS_LLM === '1';
}

async function fetchLlmSuggestions(fullAddress, missingKeys) {
  const client = getAnthropicClient();
  if (!client || missingKeys.length === 0) return null;

  const system = `You estimate basic US residential property attributes from a postal address only.
Return a JSON object with these optional keys (omit unknowns): home_type (one of: house, apartment, condo, townhouse, studio, rv, mobile_home, trailer, multi_unit, other), bedrooms (integer), bathrooms (number), sq_ft (integer), lot_sq_ft (integer), year_built (integer), description_one_liner (short string).
Never claim certainty — these are guesses. Use null for unknown values.
Reply with the JSON object only: no prose, no code fence.`;

  const user = `Address: ${fullAddress}\nOnly fill fields that are plausibly inferable from public knowledge of typical US housing stock at this location. Missing requested keys: ${missingKeys.join(', ')}`;

  try {
    const { text } = await complete({
      client,
      model: LLM_MODEL,
      system,
      messages: [{ role: 'user', content: user }],
      effort: LLM_EFFORT,
      maxTokens: LLM_MAX_TOKENS,
      timeoutMs: LLM_TIMEOUT_MS,
    });
    const parsed = parseJsonObject(text);
    if (!parsed) return null;
    return { ...parsed, source: 'llm' };
  } catch (err) {
    if (isTimeoutError(err)) {
      logger.warn('property suggestions LLM timeout');
    } else {
      logger.warn('property suggestions LLM error', { error: err.message });
    }
    return null;
  }
}

function normalizeLlmHomeType(v) {
  if (!v || typeof v !== 'string') return null;
  const s = v.toLowerCase().replace(/\s+/g, '_');
  return CANONICAL_HOME_TYPES.has(s) ? s : null;
}

/**
 * @param {object} input
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseAdmin]
 * @param {object} [options]
 * @param {'wait'|'background'|'check'} [options.lookup='wait'] How a validated address's ATTOM lookup runs
 *   (propertyIntelligenceService.fetchAttomPropertyDetailBundleForAddress); the answer's `attom_lookup` says where it
 *   stands, so Add Home can show the step at once and fill the fields in when the record lands.
 */
async function getPropertySuggestions(input, supabaseAdmin, { lookup = 'wait' } = {}) {
  const {
    address,
    unit_number: unitNumber,
    city,
    state,
    zip_code: zipCode,
    address_id: addressId,
    classification,
  } = input;

  const sources = {};
  const tiersUsed = [];

  let homeAddressRow = null;
  if (addressId && supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from('HomeAddress')
        .select(`
          id, building_type, parcel_type, google_place_types,
          residential_unit_count, parcel_land_use, parcel_property_type,
          address_line1_norm, address_line2_norm, city_norm, state, postal_code
        `)
        .eq('id', addressId)
        .maybeSingle();
      homeAddressRow = data || null;
    } catch (e) {
      logger.warn('property suggestions HomeAddress lookup failed', { error: e.message });
    }
  }

  const merged = {
    home_type: null,
    bedrooms: null,
    bathrooms: null,
    sq_ft: null,
    lot_sq_ft: null,
    year_built: null,
    description: null,
  };

  // Add Home's follow-up isn't counted against the outbound limit, so it never
  // asks a paid provider (ATTOM or the model) itself.
  const checkOnly = lookup === 'check';

  // Tier 0 — the county's own record. In a live county ATTOM isn't asked.
  const recordAddress = homeAddressRow
    ? { line1: homeAddressRow.address_line1_norm, unit: homeAddressRow.address_line2_norm, city: homeAddressRow.city_norm, state: homeAddressRow.state, zip: homeAddressRow.postal_code }
    : { line1: address, unit: unitNumber, city, state, zip: zipCode };
  propertyRecords.shadow(recordAddress);
  const record = await homeRecords.forAddress(recordAddress);
  const fieldTags = {};
  let provenance = null;
  let lookupNote = null;
  let attom = null;
  let attomLookup = null;
  if (record) {
    attomLookup = record.lookup;
    if (record.copy) {
      tiersUsed.push('record');
      fillFromRecord(record.copy, merged, sources, fieldTags);
      provenance = homeRecords.provenanceOf(record.copy);
    } else if (record.answer?.match === 'ambiguous') {
      lookupNote = SEVERAL_RECORDS_NOTE;
    }
  } else { // Tier 1 — ATTOM (strongest structured signal; one /property/detail call). Stored responses remain available without a live provider credential.
    try {
      // A validated address is looked up as validated, and the server keeps
      // the answer: creating the Home stores that copy, not the app's. The
      // county record itself never goes back to the app; only the Home's
      // verified owners read it, on Property details.
      let bundle = { snapshot: null };
      if (homeAddressRow) {
        bundle = await fetchAttomPropertyDetailBundleForAddress(homeAddressRow, { lookup });
      } else if (!checkOnly) {
        bundle = await fetchAttomPropertyDetailBundle({
          address,
          address2: unitNumber,
          city,
          state,
          zipcode: zipCode,
        });
      }
      attom = bundle.snapshot;
      attomLookup = bundle.lookup || null;
    } catch (e) {
      logger.warn('ATTOM snapshot failed', { error: e.message });
      attomLookup = 'unavailable';
    }
    if (attom) {
      tiersUsed.push('attom');
      const ht = mapAttomPropertyTypeToCanonical(attom.raw_property_type);
      if (ht) {
        merged.home_type = ht;
        sources.home_type = 'attom';
      }
      if (attom.bedrooms != null && !Number.isNaN(attom.bedrooms)) {
        merged.bedrooms = attom.bedrooms;
        sources.bedrooms = 'attom';
      }
      if (attom.bathrooms != null && !Number.isNaN(attom.bathrooms)) {
        merged.bathrooms = attom.bathrooms;
        sources.bathrooms = 'attom';
      }
      if (attom.sqft != null && !Number.isNaN(attom.sqft)) {
        merged.sq_ft = Math.round(attom.sqft);
        sources.sq_ft = 'attom';
      }
      if (attom.lot_sqft != null && !Number.isNaN(attom.lot_sqft)) {
        merged.lot_sq_ft = Math.round(attom.lot_sqft);
        sources.lot_sq_ft = 'attom';
      }
      if (attom.year_built != null && !Number.isNaN(attom.year_built)) {
        merged.year_built = attom.year_built;
        sources.year_built = 'attom';
      }
    }
  }

  // Tier 2 — heuristics from Places / HomeAddress (fill gaps only). While the
  // county record is still being looked up they wait for it, as the model's
  // guesses do: shown first, a guessed kind of home would change when the
  // record lands.
  const heuristic = attomLookup === 'pending' ? {} : buildHeuristicSuggestions({
    classification: classification || {},
    homeAddressRow,
    unit_number: unitNumber,
  });
  if (Object.keys(heuristic).length) {
    tiersUsed.push('heuristic');
    if (merged.home_type == null && heuristic.home_type) {
      merged.home_type = heuristic.home_type;
      sources.home_type = 'heuristic';
    }
  }

  const missingForLlm = [];
  if (merged.home_type == null) missingForLlm.push('home_type');
  if (merged.bedrooms == null) missingForLlm.push('bedrooms');
  if (merged.bathrooms == null) missingForLlm.push('bathrooms');
  if (merged.sq_ft == null) missingForLlm.push('sq_ft');
  if (merged.lot_sq_ft == null) missingForLlm.push('lot_sq_ft');
  if (merged.year_built == null) missingForLlm.push('year_built');

  // Guesses fill only what the county record lacks, so they wait for its
  // answer: filled first, they would keep the record's facts out of the form.
  if (isLlmEnabled() && missingForLlm.length > 0 && attomLookup !== 'pending' && !checkOnly) {
    const line1 = unitNumber ? `${address} ${unitNumber}` : address;
    const fullAddress = `${line1}, ${city}, ${state} ${zipCode}`;
    const llm = await fetchLlmSuggestions(fullAddress, missingForLlm);
    if (llm) {
      tiersUsed.push('llm');
      const ht = normalizeLlmHomeType(llm.home_type);
      if (merged.home_type == null && ht) {
        merged.home_type = ht;
        sources.home_type = 'llm';
      }
      if (merged.bedrooms == null && llm.bedrooms != null) {
        const n = parseInt(String(llm.bedrooms), 10);
        if (!Number.isNaN(n)) { merged.bedrooms = n; sources.bedrooms = 'llm'; }
      }
      if (merged.bathrooms == null && llm.bathrooms != null) {
        const n = parseFloat(String(llm.bathrooms));
        if (!Number.isNaN(n)) { merged.bathrooms = n; sources.bathrooms = 'llm'; }
      }
      if (merged.sq_ft == null && llm.sq_ft != null) {
        const n = parseInt(String(llm.sq_ft), 10);
        if (!Number.isNaN(n)) { merged.sq_ft = n; sources.sq_ft = 'llm'; }
      }
      if (merged.lot_sq_ft == null && llm.lot_sq_ft != null) {
        const n = parseInt(String(llm.lot_sq_ft), 10);
        if (!Number.isNaN(n)) { merged.lot_sq_ft = n; sources.lot_sq_ft = 'llm'; }
      }
      if (merged.year_built == null && llm.year_built != null) {
        const n = parseInt(String(llm.year_built), 10);
        if (!Number.isNaN(n)) { merged.year_built = n; sources.year_built = 'llm'; }
      }
      if (merged.description == null && typeof llm.description_one_liner === 'string' && llm.description_one_liner.trim()) {
        merged.description = llm.description_one_liner.trim();
        sources.description = 'llm';
      }
    }
  }

  // 'attom' in tiers_used is how the apps know a county record was found.
  // `attom_lookup` ('found', 'none', 'pending', 'unavailable') is answered for
  // a validated address: 'pending' means ask again with lookup=check.
  return {
    suggestions: merged,
    field_sources: sources,
    tiers_used: [...new Set(tiersUsed)],
    llm_enabled: isLlmEnabled(),
    ...(homeAddressRow && attomLookup ? { attom_lookup: attomLookup } : {}),
    ...(provenance ? { provenance, field_tags: fieldTags } : {}),
    ...(lookupNote ? { lookup_note: lookupNote } : {}),
  };
}

module.exports = { getPropertySuggestions };
