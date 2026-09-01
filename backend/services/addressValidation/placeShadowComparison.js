const GENERIC_PLACE_TYPES = new Set([
  'establishment',
  'point_of_interest',
]);

const RESIDENTIAL_PLACE_TYPES = new Set([
  'premise',
  'subpremise',
  'street_address',
  'room',
  'apartment',
  'apartment_building',
  'apartment_complex',
  'housing_complex',
  'condominium',
  'townhouse',
  'residential_building',
]);

const COMMERCIAL_PLACE_TYPES = new Set([
  'store',
  'corporate_office',
  'office',
  'restaurant',
  'shopping_mall',
  'supermarket',
  'bank',
  'gas_station',
  'finance',
  'doctor',
  'hospital',
  'pharmacy',
  'lodging',
  'warehouse',
  'factory',
]);

const INSTITUTIONAL_PLACE_TYPES = new Set([
  'school',
  'university',
  'stadium',
  'government_office',
  'event_venue',
  'library',
  'museum',
  'airport',
  'church',
  'hospital',
]);

function normalizeTypes(types) {
  if (!Array.isArray(types)) return [];
  return [...new Set(types.map((type) => String(type || '').trim()).filter(Boolean))];
}

function buildSignalProfile(types) {
  const normalizedTypes = normalizeTypes(types);
  const specificTypes = normalizedTypes.filter((type) => !GENERIC_PLACE_TYPES.has(type));

  const categories = [];
  if (normalizedTypes.some((type) => RESIDENTIAL_PLACE_TYPES.has(type))) categories.push('residential');
  if (normalizedTypes.some((type) => COMMERCIAL_PLACE_TYPES.has(type))) categories.push('commercial');
  if (normalizedTypes.some((type) => INSTITUTIONAL_PLACE_TYPES.has(type))) categories.push('institutional');

  return {
    categories,
    specific_types: specificTypes,
    has_generic_only: normalizedTypes.length > 0 && specificTypes.length === 0,
  };
}

function comparePlaceClassifications(heuristicPlace, providerPlace) {
  const heuristicTypes = normalizeTypes(heuristicPlace?.google_place_types);
  const providerTypes = normalizeTypes([
    providerPlace?.primary_type,
    ...(providerPlace?.types || []),
  ]);

  const heuristicProfile = buildSignalProfile(heuristicTypes);
  const providerProfile = buildSignalProfile(providerTypes);
  const overlapTypes = heuristicTypes.filter((type) => providerTypes.includes(type));
  const overlapSpecificTypes = heuristicProfile.specific_types
    .filter((type) => providerProfile.specific_types.includes(type));

  const disagreementReasons = [];
  if (providerPlace) {
    const heuristicCategories = heuristicProfile.categories.join('|');
    const providerCategories = providerProfile.categories.join('|');

    if (heuristicCategories !== providerCategories) {
      disagreementReasons.push('semantic_category_mismatch');
    }

    if (
      heuristicProfile.specific_types.length > 0
      && providerProfile.specific_types.length > 0
      && overlapSpecificTypes.length === 0
    ) {
      disagreementReasons.push('specific_type_mismatch');
    }

    if (
      providerPlace.primary_type
      && heuristicTypes.length > 0
      && !heuristicTypes.includes(providerPlace.primary_type)
      && heuristicCategories !== providerCategories
    ) {
      disagreementReasons.push('primary_type_mismatch');
    }
  }

  return {
    heuristic: {
      google_place_types: heuristicTypes,
      parcel_type: heuristicPlace?.parcel_type || 'unknown',
      building_type: heuristicPlace?.building_type || 'unknown',
      signal_profile: heuristicProfile,
    },
    provider: providerPlace ? {
      place_id: providerPlace.place_id || null,
      primary_type: providerPlace.primary_type || null,
      google_place_types: normalizeTypes(providerPlace.types),
      business_status: providerPlace.business_status || null,
      display_name: providerPlace.display_name || null,
      lookup_mode: providerPlace.lookup_mode || null,
      signal_profile: providerProfile,
    } : null,
    overlap_types: overlapTypes,
    overlap_specific_types: overlapSpecificTypes,
    disagreement_reasons: disagreementReasons,
    disagrees: providerPlace ? disagreementReasons.length > 0 : null,
  };
}

module.exports = {
  comparePlaceClassifications,
};
