const freshValidatedAt = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function makeGoogle(overrides = {}) {
  const normalized = overrides.normalized || {};
  return {
    normalized: {
      line1: '123 Main St',
      line2: '',
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      lat: 45.5152,
      lng: -122.6784,
      ...normalized,
    },
    components: {
      route: { text: normalized.line1 || 'Main St' },
    },
    geocode: { lat: 45.5152, lng: -122.6784 },
    granularity: 'PREMISE',
    missing_component_types: [],
    verdict: {
      hasUnconfirmedComponents: false,
      hasInferredComponents: false,
      hasReplacedComponents: false,
    },
    ...overrides,
  };
}

function makeSmarty(overrides = {}) {
  return {
    from_cache: false,
    inconclusive: false,
    dpv_match_code: 'Y',
    rdi_type: 'residential',
    missing_secondary: false,
    commercial_mailbox: false,
    vacant_flag: false,
    footnotes: ['AA'],
    ...overrides,
  };
}

function makePlace(overrides = {}) {
  return {
    google_place_types: ['premise'],
    parcel_type: 'residential',
    building_type: 'single_family',
    ...overrides,
  };
}

function makeProviderPlace(overrides = {}) {
  return {
    provider: 'google_places',
    provider_version: 'places_v1',
    place_id: 'place-1',
    primary_type: 'corporate_office',
    types: ['corporate_office', 'point_of_interest', 'establishment'],
    business_status: 'OPERATIONAL',
    display_name: 'Acme HQ',
    confidence: 0.93,
    is_named_poi: true,
    lookup_mode: 'place_details',
    verification_level: 'shadow_provider_observed',
    risk_flags: ['named_poi'],
    validated_at: freshValidatedAt(),
    ...overrides,
  };
}

function makeParcelIntel(overrides = {}) {
  return {
    provider: 'attom',
    provider_version: 'parcel_shadow_v1',
    parcel_id: 'parcel-1',
    land_use: 'Industrial Warehouse',
    property_type: 'Warehouse',
    building_count: 1,
    residential_unit_count: 0,
    non_residential_unit_count: 1,
    usage_class: 'industrial',
    confidence: 0.94,
    lookup_mode: 'property_detail',
    from_cache: false,
    validated_at: freshValidatedAt(),
    ...overrides,
  };
}

const addressVerificationGroundTruthCorpus = [
  {
    key: 'single_family_home',
    category: 'valid_single_family_home',
    expectedStatus: 'OK',
    decisionInput: {
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace(),
    },
  },
  {
    key: 'apartment_with_unit',
    category: 'apartment_with_unit',
    expectedStatus: 'OK',
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '500 Riverfront Ave', line2: 'Apt 4A' } }),
      smarty: makeSmarty(),
      place: makePlace({
        google_place_types: ['premise', 'subpremise'],
        building_type: 'multi_unit',
      }),
    },
  },
  {
    key: 'apartment_missing_unit',
    category: 'apartment_missing_unit',
    expectedStatus: 'MISSING_UNIT',
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '500 Riverfront Ave', line2: '' } }),
      smarty: makeSmarty({
        dpv_match_code: 'S',
        missing_secondary: true,
      }),
      place: makePlace({
        google_place_types: ['premise'],
        building_type: 'multi_unit',
      }),
    },
  },
  {
    key: 'condo_with_unit',
    category: 'condo',
    expectedStatus: 'OK',
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '81 Pearl St', line2: 'Unit 7C' } }),
      smarty: makeSmarty(),
      place: makePlace({
        google_place_types: ['premise', 'subpremise'],
        building_type: 'multi_unit',
      }),
    },
  },
  {
    key: 'mixed_use_building',
    category: 'mixed_use_address',
    expectedStatus: 'MIXED_USE',
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '100 Main St' } }),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace({
        google_place_types: ['premise', 'store'],
        parcel_type: 'mixed',
        building_type: 'mixed_use',
      }),
    },
  },
  {
    key: 'corporate_office',
    category: 'office',
    expectedStatus: 'BUSINESS',
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '200 Business Plaza' } }),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace(),
      provider_place: makeProviderPlace(),
      use_provider_place_for_business: true,
    },
  },
  {
    key: 'school',
    category: 'school',
    expectedStatus: 'BUSINESS',
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '101 School Ln' } }),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace(),
      provider_place: makeProviderPlace({
        place_id: 'school-1',
        primary_type: 'school',
        types: ['school', 'point_of_interest', 'establishment'],
        display_name: 'Lincoln High School',
      }),
      use_provider_place_for_business: true,
    },
  },
  {
    key: 'church',
    category: 'church',
    expectedStatus: 'BUSINESS',
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '90 Worship Way' } }),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace(),
      provider_place: makeProviderPlace({
        place_id: 'church-1',
        primary_type: 'church',
        types: ['church', 'point_of_interest', 'establishment'],
        display_name: 'St. Mark Church',
      }),
      use_provider_place_for_business: true,
    },
  },
  {
    key: 'hospital',
    category: 'hospital',
    expectedStatus: 'BUSINESS',
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '500 Medical Center Dr' } }),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace(),
      provider_place: makeProviderPlace({
        place_id: 'hospital-1',
        primary_type: 'hospital',
        types: ['hospital', 'medical_center', 'point_of_interest', 'establishment'],
        display_name: 'Providence Medical Center',
      }),
      use_provider_place_for_business: true,
    },
  },
  {
    key: 'stadium',
    category: 'stadium_or_arena',
    expectedStatus: 'BUSINESS',
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '1 Arena Way' } }),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace(),
      provider_place: makeProviderPlace({
        place_id: 'stadium-1',
        primary_type: 'stadium',
        types: ['stadium', 'event_venue', 'point_of_interest', 'establishment'],
        display_name: 'Moda Center',
      }),
      use_provider_place_for_business: true,
    },
  },
  {
    key: 'warehouse',
    category: 'warehouse_or_factory',
    expectedStatus: 'BUSINESS',
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '700 Logistics Dr' } }),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace(),
      parcel_intel: makeParcelIntel(),
      use_provider_parcel_for_classification: true,
      provider_parcel_max_age_days: 30,
    },
  },
  {
    key: 'shopping_mall',
    category: 'mall_or_shopping_center',
    expectedStatus: 'BUSINESS',
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '7000 SW Bridgeport Rd' } }),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace(),
      provider_place: makeProviderPlace({
        place_id: 'mall-1',
        primary_type: 'shopping_mall',
        types: ['shopping_mall', 'store', 'point_of_interest', 'establishment'],
        display_name: 'Bridgeport Village',
      }),
      use_provider_place_for_business: true,
    },
  },
  {
    key: 'government_building',
    category: 'government_building',
    expectedStatus: 'BUSINESS',
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '1221 SW 4th Ave' } }),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace(),
      provider_place: makeProviderPlace({
        place_id: 'gov-1',
        primary_type: 'city_hall',
        types: ['city_hall', 'local_government_office', 'point_of_interest', 'establishment'],
        display_name: 'Portland City Hall',
      }),
      use_provider_place_for_business: true,
    },
  },
  {
    key: 'hotel_lodging_fixture',
    category: 'hotel_or_lodging',
    classificationOnly: true,
    decisionInput: {
      google: makeGoogle({ normalized: { line1: '300 Hotel Row' } }),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace({
        google_place_types: ['lodging'],
        parcel_type: 'commercial',
        building_type: 'commercial',
      }),
      provider_place: makeProviderPlace({
        place_id: 'hotel-1',
        primary_type: 'lodging',
        types: ['lodging', 'point_of_interest', 'establishment'],
        display_name: 'Riverfront Hotel',
      }),
      use_provider_place_for_business: false,
    },
  },
];

module.exports = {
  addressVerificationGroundTruthCorpus,
};
