/**
 * Canonical Address Deduplication Service
 *
 * Ensures variant spellings of the same physical address resolve to a single
 * HomeAddress record.  Uses a deterministic SHA-256 hash of the normalized
 * address components as the deduplication key (HomeAddress.address_hash).
 *
 * Called by the validation pipeline after both Google and Smarty have returned
 * results, so the HomeAddress record is fully populated with all postal data
 * before any Home or AddressClaim record references it.
 *
 * Methods:
 *   normalizeAndHash(address)                     — deterministic hash
 *   findOrCreate(normalizedAddress, validationResult) — upsert
 *   findByHash(hash)                              — simple lookup
 *   mergeAliases(primaryId, aliasId)              — merge duplicate records
 */

const logger = require('../../utils/logger');
const supabaseAdmin = require('../../config/supabaseAdmin');
const { computeAddressHash } = require('../../utils/normalizeAddress');

/** @typedef {import('./types').NormalizedAddress} NormalizedAddress */
/** @typedef {import('./types').GoogleValidationResult} GoogleValidationResult */
/** @typedef {import('./types').SmartyPostalResult} SmartyPostalResult */

/**
 * @typedef {object} ValidationResult
 * @property {GoogleValidationResult} [google]
 * @property {SmartyPostalResult}     [smarty]
 * @property {import('./types').PlaceClassification} [place]
 * @property {import('./types').ProviderPlaceClassification} [providerPlace]
 * @property {import('./types').SecondaryAddressIntelligence} [unitIntelligence]
 * @property {import('./types').ParcelIntelligence} [parcelIntel]
 */

class CanonicalAddressService {
  /**
   * Produce a deterministic SHA-256 hash for address deduplication.
   *
   * Normalization pipeline:
   *   1. Standardize abbreviations (ST↔STREET, AVE↔AVENUE, etc.)
   *   2. Lowercase, trim, collapse whitespace
   *   3. Concatenate: line1 | line2 | city | state | zip | country
   *   4. SHA-256 the concatenated string
   *
   * Delegates to the shared normalizeAddress utility which already performs
   * all of the above steps consistently across the codebase.
   *
   * @param {NormalizedAddress} address
   * @returns {string} 64-char hex SHA-256 hash
   */
  normalizeAndHash(address) {
    return computeAddressHash(
      address.line1,
      address.line2 || '',
      address.city,
      address.state,
      address.zip,
    );
  }

  /**
   * Look up an existing HomeAddress by hash; if found, update postal fields
   * and last_validated_at.  If not found, create a new record with all postal
   * verification data populated.
   *
   * @param {NormalizedAddress} normalizedAddress — from Google Layer 2
   * @param {ValidationResult} validationResult  — combined provider results
   * @returns {Promise<{data: object|null, error: object|null, created: boolean}>}
   */
  async findOrCreate(normalizedAddress, validationResult) {
    const hash = this.normalizeAndHash(normalizedAddress);
    const { google, smarty, place, providerPlace, unitIntelligence, parcelIntel } = validationResult || {};

    // ── Try to find existing ─────────────────────────────────
    const existing = await this.findByHash(hash);

    if (existing.error) {
      return { data: null, error: existing.error, created: false };
    }

    const postalFields = this._buildPostalFields(
      normalizedAddress,
      google,
      smarty,
      place,
      providerPlace,
      unitIntelligence,
      parcelIntel,
    );

    if (existing.data) {
      const mergedFields = this._mergeStoredMetadata(existing.data, postalFields);

      // Update postal fields + bump last_validated_at
      const { data, error } = await supabaseAdmin
        .from('HomeAddress')
        .update({
          ...mergedFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.data.id)
        .select()
        .single();

      if (error) {
        logger.error('CanonicalAddressService.findOrCreate: update failed', {
          id: existing.data.id,
          error: error.message,
        });
        return { data: null, error, created: false };
      }

      logger.info('CanonicalAddressService.findOrCreate: updated existing', {
        id: data.id,
        hash,
      });
      return { data, error: null, created: false };
    }

    // ── Create new record ────────────────────────────────────
    const record = {
      address_hash: hash,
      address_line1_norm: normalizedAddress.line1,
      address_line2_norm: normalizedAddress.line2 || null,
      city_norm: normalizedAddress.city,
      state: normalizedAddress.state,
      postal_code: normalizedAddress.zip,
      country: 'US',
      ...this._mergeStoredMetadata(null, postalFields),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('HomeAddress')
      .insert(record)
      .select()
      .single();

    if (error) {
      logger.error('CanonicalAddressService.findOrCreate: insert failed', {
        hash,
        error: error.message,
      });
      return { data: null, error, created: false };
    }

    logger.info('CanonicalAddressService.findOrCreate: created new record', {
      id: data.id,
      hash,
    });
    return { data, error: null, created: true };
  }

  /**
   * Look up a HomeAddress record by its address_hash.
   *
   * @param {string} hash — 64-char hex SHA-256
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async findByHash(hash) {
    const { data, error } = await supabaseAdmin
      .from('HomeAddress')
      .select('*')
      .eq('address_hash', hash)
      .maybeSingle();

    if (error) {
      logger.error('CanonicalAddressService.findByHash: lookup failed', {
        hash,
        error: error.message,
      });
      return { data: null, error };
    }

    return { data: data || null, error: null };
  }

  /**
   * Merge two HomeAddress records that represent the same physical address.
   *
   * Repoints all foreign-key references (Home.address_id) from the alias to
   * the primary, then archives the alias record by marking it with a
   * merged_into field and a distinctive address_hash suffix so it no longer
   * collides with the primary's unique index.
   *
   * @param {string} primaryId — the surviving HomeAddress.id
   * @param {string} aliasId   — the duplicate HomeAddress.id to retire
   * @returns {Promise<{success: boolean, error: object|null, repointed: {homes: number}}>}
   */
  async mergeAliases(primaryId, aliasId) {
    if (primaryId === aliasId) {
      return { success: false, error: { message: 'primaryId and aliasId must differ' }, repointed: { homes: 0 } };
    }

    // ── Verify both records exist ────────────────────────────
    const [primaryRes, aliasRes] = await Promise.all([
      supabaseAdmin.from('HomeAddress').select('id').eq('id', primaryId).maybeSingle(),
      supabaseAdmin.from('HomeAddress').select('id').eq('id', aliasId).maybeSingle(),
    ]);

    if (primaryRes.error || !primaryRes.data) {
      return {
        success: false,
        error: { message: `Primary HomeAddress ${primaryId} not found` },
        repointed: { homes: 0 },
      };
    }
    if (aliasRes.error || !aliasRes.data) {
      return {
        success: false,
        error: { message: `Alias HomeAddress ${aliasId} not found` },
        repointed: { homes: 0 },
      };
    }

    // ── Repoint Home.address_id ──────────────────────────────
    const { data: homes, error: homeErr } = await supabaseAdmin
      .from('Home')
      .update({ address_id: primaryId })
      .eq('address_id', aliasId)
      .select('id');

    if (homeErr) {
      logger.error('CanonicalAddressService.mergeAliases: Home repoint failed', {
        primaryId,
        aliasId,
        error: homeErr.message,
      });
      return { success: false, error: homeErr, repointed: { homes: 0 } };
    }

    const homesRepointed = homes ? homes.length : 0;

    // ── Archive the alias ────────────────────────────────────
    // Suffix the address_hash so it no longer collides with the unique index,
    // and store a merged_into pointer for auditability.
    const { error: archiveErr } = await supabaseAdmin
      .from('HomeAddress')
      .update({
        address_hash: `merged:${aliasId}`,
        merged_into: primaryId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', aliasId);

    if (archiveErr) {
      logger.error('CanonicalAddressService.mergeAliases: archive failed', {
        aliasId,
        error: archiveErr.message,
      });
      return { success: false, error: archiveErr, repointed: { homes: homesRepointed } };
    }

    logger.info('CanonicalAddressService.mergeAliases: complete', {
      primaryId,
      aliasId,
      homesRepointed,
    });

    return { success: true, error: null, repointed: { homes: homesRepointed } };
  }

  // ── Private helpers ────────────────────────────────────────────

  _mergeStoredMetadata(existingAddress, nextFields) {
    const merged = { ...nextFields };

    if (existingAddress?.validation_raw_response || nextFields.validation_raw_response) {
      merged.validation_raw_response = {
        ...(existingAddress?.validation_raw_response || {}),
        ...(nextFields.validation_raw_response || {}),
      };
    }

    if (existingAddress?.provider_versions || nextFields.provider_versions) {
      merged.provider_versions = {
        ...(existingAddress?.provider_versions || {}),
        ...(nextFields.provider_versions || {}),
      };
    }

    const existingProviderVersion = existingAddress?.provider_versions?.place_classification || null;
    const nextProviderVersion = nextFields?.provider_versions?.place_classification || null;
    const providerShadowFields = [
      'google_place_id',
      'google_place_primary_type',
      'google_place_types',
      'provider_place_types',
      'google_business_status',
      'google_place_name',
      'verification_level',
      'risk_flags',
      'last_place_validated_at',
    ];

    if (existingProviderVersion && !nextProviderVersion) {
      for (const field of providerShadowFields) {
        if (existingAddress[field] !== undefined) {
          merged[field] = existingAddress[field];
        }
      }
    } else if (existingProviderVersion && nextProviderVersion) {
      for (const field of providerShadowFields) {
        if (merged[field] === undefined || merged[field] === null) {
          merged[field] = existingAddress[field];
        }
      }
    }

    const existingSecondaryVersion = existingAddress?.provider_versions?.secondary_address || null;
    const nextSecondaryVersion = nextFields?.provider_versions?.secondary_address || null;
    const secondaryShadowFields = [
      'secondary_required',
      'unit_count_estimate',
      'unit_intelligence_confidence',
      'last_secondary_validated_at',
    ];

    if (existingSecondaryVersion && !nextSecondaryVersion) {
      for (const field of secondaryShadowFields) {
        if (existingAddress[field] !== undefined) {
          merged[field] = existingAddress[field];
        }
      }
    } else if (existingSecondaryVersion && nextSecondaryVersion) {
      for (const field of secondaryShadowFields) {
        if (merged[field] === undefined || merged[field] === null) {
          merged[field] = existingAddress[field];
        }
      }
    }

    const existingParcelVersion = existingAddress?.provider_versions?.parcel_intel || null;
    const nextParcelVersion = nextFields?.provider_versions?.parcel_intel || null;
    const parcelShadowFields = [
      'parcel_provider',
      'parcel_id',
      'parcel_land_use',
      'parcel_property_type',
      'parcel_confidence',
      'building_count',
      'residential_unit_count',
      'non_residential_unit_count',
      'usage_class',
      'last_parcel_validated_at',
    ];

    if (existingParcelVersion && !nextParcelVersion) {
      for (const field of parcelShadowFields) {
        if (existingAddress[field] !== undefined) {
          merged[field] = existingAddress[field];
        }
      }
    } else if (existingParcelVersion && nextParcelVersion) {
      for (const field of parcelShadowFields) {
        if (merged[field] === undefined || merged[field] === null) {
          merged[field] = existingAddress[field];
        }
      }
    }

    return merged;
  }

  /**
   * Build the postal/validation fields to store on HomeAddress.
   *
   * @param {NormalizedAddress} address
   * @param {GoogleValidationResult} [google]
   * @param {SmartyPostalResult} [smarty]
   * @param {import('./types').PlaceClassification} [place]
   * @param {import('./types').ProviderPlaceClassification} [providerPlace]
   * @param {import('./types').SecondaryAddressIntelligence} [unitIntelligence]
   * @param {import('./types').ParcelIntelligence} [parcelIntel]
   * @returns {object}
   * @private
   */
  _buildPostalFields(address, google, smarty, place, providerPlace, unitIntelligence, parcelIntel) {
    const fields = {};

    // Geocode from Google (or from normalized address)
    if (google?.geocode) {
      fields.geocode_lat = google.geocode.lat;
      fields.geocode_lng = google.geocode.lng;
    } else if (address.lat != null && address.lng != null) {
      fields.geocode_lat = address.lat;
      fields.geocode_lng = address.lng;
    }

    if (address.plus4) {
      fields.postal_code_plus4 = address.plus4;
    }

    if (smarty && !smarty.inconclusive) {
      fields.dpv_match_code = smarty.dpv_match_code || null;
      fields.rdi_type = smarty.rdi_type || 'unknown';
      fields.missing_secondary_flag = !!smarty.missing_secondary;
      fields.commercial_mailbox_flag = !!smarty.commercial_mailbox;
      fields.deliverability_status = smarty.dpv_match_code === 'N'
        ? 'undeliverable'
        : (smarty.dpv_match_code === 'D' || smarty.dpv_match_code === 'S')
          ? 'partial'
          : 'deliverable';
    }

    // Structural + classification fields used by later claim/attach flows.
    if (place?.building_type && place.building_type !== 'unknown') {
      fields.building_type = place.building_type;
    }
    if (place?.parcel_type && place.parcel_type !== 'unknown') {
      fields.parcel_type = place.parcel_type;
    }
    const heuristicPlaceTypes = Array.isArray(place?.google_place_types) && place.google_place_types.length > 0
      ? [...new Set(place.google_place_types)]
      : [];
    if (heuristicPlaceTypes.length > 0) {
      fields.google_place_types = heuristicPlaceTypes;
    }
    if (place?.building_type === 'single_family') {
      fields.place_type = 'single_family';
    } else if (place?.building_type === 'multi_unit') {
      fields.place_type = address.line2 ? 'unit' : 'building';
    }

    const rawResponse = {};

    // Smarty postal validation data stored as JSON blob for caching
    if (smarty && !smarty.inconclusive) {
      fields.validation_vendor = 'smarty';
      fields.last_validated_at = new Date().toISOString();
      rawResponse.smarty_candidate = smarty.raw || null;
      rawResponse.dpv_match_code = smarty.dpv_match_code;
      rawResponse.rdi_type = smarty.rdi_type;
      rawResponse.missing_secondary = smarty.missing_secondary;
      rawResponse.commercial_mailbox = smarty.commercial_mailbox;
      rawResponse.vacant_flag = smarty.vacant_flag;
      rawResponse.footnotes = smarty.footnotes;
    }

    // Google granularity + verdict summary
    if (google) {
      fields.geocode_granularity = google.granularity;
      fields.google_verdict = {
        hasUnconfirmedComponents: google.verdict?.hasUnconfirmedComponents || false,
        hasInferredComponents: google.verdict?.hasInferredComponents || false,
        hasReplacedComponents: google.verdict?.hasReplacedComponents || false,
      };
    }

    if (place) {
      rawResponse.heuristic_place = {
        google_place_types: Array.isArray(place.google_place_types) ? [...new Set(place.google_place_types)] : [],
        parcel_type: place.parcel_type || 'unknown',
        building_type: place.building_type || 'unknown',
      };
    }

    if (providerPlace) {
      const providerTypes = Array.isArray(providerPlace.types) && providerPlace.types.length > 0
        ? [...new Set(providerPlace.types)]
        : [];

      if (providerPlace.place_id) fields.google_place_id = providerPlace.place_id;
      if (providerPlace.primary_type) fields.google_place_primary_type = providerPlace.primary_type;
      if (providerPlace.business_status) fields.google_business_status = providerPlace.business_status;
      if (providerPlace.display_name) fields.google_place_name = providerPlace.display_name;
      if (providerTypes.length > 0) {
        fields.provider_place_types = providerTypes;
      }
      if (providerPlace.verification_level) fields.verification_level = providerPlace.verification_level;
      if (Array.isArray(providerPlace.risk_flags)) {
        fields.risk_flags = [...new Set(providerPlace.risk_flags)];
      }
      if (providerPlace.validated_at) {
        fields.last_place_validated_at = providerPlace.validated_at;
      }
      if (providerPlace.provider || providerPlace.provider_version) {
        fields.provider_versions = {
          place_classification: {
            provider: providerPlace.provider || null,
            version: providerPlace.provider_version || null,
            shadow_only: true,
          },
        };
      }

      rawResponse.place_provider = {
        provider: providerPlace.provider || null,
        provider_version: providerPlace.provider_version || null,
        place_id: providerPlace.place_id || null,
        primary_type: providerPlace.primary_type || null,
        types: Array.isArray(providerPlace.types) ? [...new Set(providerPlace.types)] : [],
        business_status: providerPlace.business_status || null,
        display_name: providerPlace.display_name || null,
        confidence: providerPlace.confidence ?? null,
        is_named_poi: providerPlace.is_named_poi ?? null,
        lookup_mode: providerPlace.lookup_mode || null,
        verification_level: providerPlace.verification_level || null,
        risk_flags: Array.isArray(providerPlace.risk_flags) ? [...new Set(providerPlace.risk_flags)] : [],
        validated_at: providerPlace.validated_at || null,
      };
    }

    if (unitIntelligence) {
      if (unitIntelligence.secondary_required != null) {
        fields.secondary_required = !!unitIntelligence.secondary_required;
      }
      if (Number.isFinite(unitIntelligence.unit_count_estimate)) {
        fields.unit_count_estimate = unitIntelligence.unit_count_estimate;
      }
      if (Number.isFinite(unitIntelligence.confidence)) {
        fields.unit_intelligence_confidence = unitIntelligence.confidence;
      }
      if (unitIntelligence.validated_at) {
        fields.last_secondary_validated_at = unitIntelligence.validated_at;
      }
      if (unitIntelligence.provider || unitIntelligence.provider_version) {
        fields.provider_versions = {
          ...(fields.provider_versions || {}),
          secondary_address: {
            provider: unitIntelligence.provider || null,
            version: unitIntelligence.provider_version || null,
            shadow_only: true,
          },
        };
      }

      rawResponse.secondary_provider = {
        provider: unitIntelligence.provider || null,
        provider_version: unitIntelligence.provider_version || null,
        secondary_required: unitIntelligence.secondary_required ?? null,
        unit_count_estimate: unitIntelligence.unit_count_estimate ?? null,
        confidence: unitIntelligence.confidence ?? null,
        submitted_unit_known: unitIntelligence.submitted_unit_known ?? null,
        submitted_unit_evaluated: unitIntelligence.submitted_unit_evaluated ?? null,
        lookup_mode: unitIntelligence.lookup_mode || null,
        verification_level: unitIntelligence.verification_level || null,
        validated_at: unitIntelligence.validated_at || null,
      };
    }

    if (parcelIntel) {
      if (parcelIntel.provider) fields.parcel_provider = parcelIntel.provider;
      if (parcelIntel.parcel_id) fields.parcel_id = parcelIntel.parcel_id;
      if (parcelIntel.land_use) fields.parcel_land_use = parcelIntel.land_use;
      if (parcelIntel.property_type) fields.parcel_property_type = parcelIntel.property_type;
      if (Number.isFinite(parcelIntel.confidence)) fields.parcel_confidence = parcelIntel.confidence;
      if (Number.isFinite(parcelIntel.building_count)) fields.building_count = parcelIntel.building_count;
      if (Number.isFinite(parcelIntel.residential_unit_count)) {
        fields.residential_unit_count = parcelIntel.residential_unit_count;
      }
      if (Number.isFinite(parcelIntel.non_residential_unit_count)) {
        fields.non_residential_unit_count = parcelIntel.non_residential_unit_count;
      }
      if (parcelIntel.usage_class) fields.usage_class = parcelIntel.usage_class;
      if (parcelIntel.validated_at) fields.last_parcel_validated_at = parcelIntel.validated_at;
      if (parcelIntel.provider || parcelIntel.provider_version) {
        fields.provider_versions = {
          ...(fields.provider_versions || {}),
          parcel_intel: {
            provider: parcelIntel.provider || null,
            version: parcelIntel.provider_version || null,
            shadow_only: true,
          },
        };
      }

      rawResponse.parcel_provider = {
        provider: parcelIntel.provider || null,
        provider_version: parcelIntel.provider_version || null,
        parcel_id: parcelIntel.parcel_id || null,
        land_use: parcelIntel.land_use || null,
        property_type: parcelIntel.property_type || null,
        building_count: parcelIntel.building_count ?? null,
        residential_unit_count: parcelIntel.residential_unit_count ?? null,
        non_residential_unit_count: parcelIntel.non_residential_unit_count ?? null,
        usage_class: parcelIntel.usage_class || 'unknown',
        confidence: parcelIntel.confidence ?? null,
        lookup_mode: parcelIntel.lookup_mode || null,
        from_cache: parcelIntel.from_cache === true,
        validated_at: parcelIntel.validated_at || null,
      };
    }

    if (Object.keys(rawResponse).length > 0) {
      fields.validation_raw_response = rawResponse;
    }

    return fields;
  }
}

module.exports = new CanonicalAddressService();
