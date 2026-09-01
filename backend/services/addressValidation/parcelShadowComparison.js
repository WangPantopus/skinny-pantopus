function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveHeuristicUsageClass(parcelType, buildingType) {
  if (parcelType === 'mixed' || buildingType === 'mixed_use') return 'mixed';
  if (parcelType === 'residential' || ['single_family', 'multi_unit'].includes(buildingType)) return 'residential';
  if (parcelType === 'commercial' || buildingType === 'commercial') return 'commercial';
  return 'unknown';
}

function compareParcelIntelligence(heuristicPlace, providerPlace, parcelIntel) {
  const heuristicParcelType = heuristicPlace?.parcel_type || 'unknown';
  const heuristicBuildingType = heuristicPlace?.building_type || 'unknown';
  const providerPlacePrimaryType = providerPlace?.primary_type || null;
  const disagreementReasons = new Set();

  if (parcelIntel) {
    const parcelUsageClass = parcelIntel.usage_class || 'unknown';
    const heuristicUsageClass = deriveHeuristicUsageClass(
      heuristicParcelType,
      heuristicBuildingType,
    );
    const residentialUnitCount = toFiniteNumber(parcelIntel.residential_unit_count);
    const nonResidentialUnitCount = toFiniteNumber(parcelIntel.non_residential_unit_count);
    const parcelLooksMixedUse =
      parcelUsageClass === 'mixed'
      || (
        residentialUnitCount !== null &&
        residentialUnitCount > 0 &&
        nonResidentialUnitCount !== null &&
        nonResidentialUnitCount > 0
      );
    const parcelLooksClearlyResidential =
      parcelUsageClass === 'residential'
      || (
        residentialUnitCount !== null &&
        residentialUnitCount > 0 &&
        (!nonResidentialUnitCount || nonResidentialUnitCount === 0)
      );
    const parcelLooksClearlyNonResidential =
      ['commercial', 'institutional', 'industrial', 'lodging'].includes(parcelUsageClass)
      && !parcelLooksMixedUse;

    if (
      heuristicUsageClass !== 'unknown'
      && parcelUsageClass !== 'unknown'
      && heuristicUsageClass !== parcelUsageClass
    ) {
      disagreementReasons.add('usage_class_mismatch');
    }

    if (
      (heuristicUsageClass === 'mixed' && parcelUsageClass !== 'mixed' && parcelUsageClass !== 'unknown')
      || (heuristicUsageClass !== 'mixed' && parcelLooksMixedUse)
    ) {
      disagreementReasons.add('mixed_use_mismatch');
    }

    if (
      heuristicBuildingType === 'single_family' &&
      residentialUnitCount !== null &&
      residentialUnitCount > 1
    ) {
      disagreementReasons.add('residential_unit_count_mismatch');
    }

    if (
      heuristicBuildingType === 'multi_unit' &&
      residentialUnitCount !== null &&
      residentialUnitCount === 1 &&
      !parcelLooksMixedUse
    ) {
      disagreementReasons.add('residential_unit_count_mismatch');
    }

    if (
      ['single_family', 'multi_unit'].includes(heuristicBuildingType)
      && parcelLooksMixedUse
    ) {
      disagreementReasons.add('building_use_mismatch');
    }

    if (
      heuristicBuildingType === 'commercial' &&
      parcelLooksClearlyResidential
    ) {
      disagreementReasons.add('building_use_mismatch');
    }

    if (
      heuristicBuildingType === 'mixed_use' &&
      (parcelLooksClearlyResidential || parcelLooksClearlyNonResidential)
    ) {
      disagreementReasons.add('building_use_mismatch');
    }
  }

  return {
    heuristic: {
      parcel_type: heuristicParcelType,
      building_type: heuristicBuildingType,
      provider_place_primary_type: providerPlacePrimaryType,
    },
    parcel: parcelIntel ? {
      provider: parcelIntel.provider || null,
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
    } : null,
    disagreement_reasons: [...disagreementReasons],
    disagrees: parcelIntel ? disagreementReasons.size > 0 : null,
  };
}

module.exports = {
  compareParcelIntelligence,
};
