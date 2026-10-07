/**
 * Tiered property field suggestions for Add Home step 2:
 * 1) ATTOM (structured US assessor-style data)
 * 2) Heuristics from HomeAddress + Places classification
 * 3) Optional LLM (PROPERTY_SUGGESTIONS_LLM=1) — fills gaps only; never overrides ATTOM
 */

const logger = require('../../utils/logger');
const { getOpenAIClient } = require('../../config/openai');
const { fetchAttomPropertyDetailBundle } = require('./propertyIntelligenceService');

const LLM_TIMEOUT_MS = 12000;

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
  const openai = getOpenAIClient();
  if (!openai || missingKeys.length === 0) return null;

  const system = `You estimate basic US residential property attributes from a postal address only.
Return a JSON object with these optional keys (omit unknowns): home_type (one of: house, apartment, condo, townhouse, studio, rv, mobile_home, trailer, multi_unit, other), bedrooms (integer), bathrooms (number), sq_ft (integer), lot_sq_ft (integer), year_built (integer), description_one_liner (short string).
Never claim certainty — these are guesses. Use null for unknown values.`;

  const user = `Address: ${fullAddress}\nOnly fill fields that are plausibly inferable from public knowledge of typical US housing stock at this location. Missing requested keys: ${missingKeys.join(', ')}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.PROPERTY_SUGGESTIONS_LLM_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 400,
    }, { signal: controller.signal });

    clearTimeout(timeout);
    const content = completion.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    return { ...parsed, source: 'llm' };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
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
 */
async function getPropertySuggestions(input, supabaseAdmin) {
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
          residential_unit_count, parcel_land_use, parcel_property_type
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

  // Tier 1 — ATTOM (strongest structured signal; one /property/detail call)
  let attom = null;
  let attom_property_detail = null;
  if (process.env.ATTOM_API_KEY) {
    try {
      const bundle = await fetchAttomPropertyDetailBundle({
        address,
        address2: unitNumber,
        city,
        state,
        zipcode: zipCode,
      });
      attom = bundle.snapshot;
      attom_property_detail = bundle.attomPayload;
    } catch (e) {
      logger.warn('ATTOM snapshot failed', { error: e.message });
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

  // Tier 2 — heuristics from Places / HomeAddress (fill gaps only)
  const heuristic = buildHeuristicSuggestions({
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

  if (isLlmEnabled() && missingForLlm.length > 0) {
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

  return {
    suggestions: merged,
    field_sources: sources,
    tiers_used: [...new Set(tiersUsed)],
    llm_enabled: isLlmEnabled(),
    attom_property_detail,
  };
}

module.exports = { getPropertySuggestions };
