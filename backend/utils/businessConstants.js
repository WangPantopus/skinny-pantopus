/**
 * Business constants shared across routes and utilities.
 */

// Usernames that conflict with application routes or reserved paths.
const RESERVED_USERNAMES = new Set([
  'search', 'map', 'new', 'api', 'admin', 'settings', 'public', 'private',
  'dashboard', 'discover', 'explore', 'login', 'signup', 'register', 'auth',
  'account', 'help', 'support', 'about', 'terms', 'privacy', 'billing',
  'team', 'inbox', 'chat', 'mail', 'mailbox', 'gigs', 'feed', 'pulse',
  'home', 'homes', 'businesses', 'business', 'notifications', 'profile',
  'pantopus', 'app', 'status', 'docs', 'blog', 'press', 'careers', 'verify',
  'founding', 'reviews', 'catalog', 'pages', 'insights', 'payments', 'locations',
]);

// Valid business entity types. Drives fee rates, payment modes, and UX flows.
const ENTITY_TYPES = new Set([
  'for_profit',
  'home_service',
  'nonprofit_501c3',
  'religious_org',
  'community_group',
  'sole_proprietor',
  'pop_up_temporary',
  'franchise_location',
]);

// Entity type config for backend fee/validation logic
const ENTITY_TYPE_CONFIG = {
  for_profit:         { defaultFeePct: 15, requiresPhysicalLocation: true },
  home_service:       { defaultFeePct: 15, requiresPhysicalLocation: false },
  nonprofit_501c3:    { defaultFeePct: 3,  requiresPhysicalLocation: false },
  religious_org:      { defaultFeePct: 0,  requiresPhysicalLocation: false },
  community_group:    { defaultFeePct: 0,  requiresPhysicalLocation: false },
  sole_proprietor:    { defaultFeePct: 10, requiresPhysicalLocation: false },
  pop_up_temporary:   { defaultFeePct: 5,  requiresPhysicalLocation: false },
  franchise_location: { defaultFeePct: 12, requiresPhysicalLocation: true },
};

const VERIFICATION_STATUSES = {
  UNVERIFIED: 'unverified',
  SELF_ATTESTED: 'self_attested',
  DOCUMENT_VERIFIED: 'document_verified',
  GOVERNMENT_VERIFIED: 'government_verified',
};

const VERIFICATION_RANK = {
  unverified: 0,
  self_attested: 1,
  document_verified: 2,
  government_verified: 3,
};

const VERIFICATION_MULTIPLIERS = {
  unverified: 0.85,
  self_attested: 1.0,
  document_verified: 1.10,
  government_verified: 1.15,
};

// Founding businesses get a 20% discovery boost (stacks with verification multiplier)
const FOUNDING_BUSINESS_MULTIPLIER = 1.20;

// Legacy static array — kept for backwards compatibility in tests
const PUBLISH_REQUIREMENTS = [
  { key: 'description', label: 'Description (50+ characters)', check: 'description_length' },
  { key: 'categories', label: 'At least one category', check: 'categories_non_empty' },
  { key: 'location', label: 'At least one geocoded location', check: 'geocoded_location' },
];

// Entity types that can substitute service_area for geocoded location
const SERVICE_AREA_LOCATION_TYPES = new Set([
  'home_service', 'nonprofit_501c3', 'religious_org', 'community_group', 'sole_proprietor',
]);

// Entity types where catalog is not required to publish
const CATALOG_OPTIONAL_TYPES = new Set(['pop_up_temporary', 'community_group']);

// Entity types that can use donation-kind items to satisfy catalog requirement
const DONATION_CATALOG_TYPES = new Set(['nonprofit_501c3', 'religious_org']);

/**
 * Get entity-specific publish requirements.
 *
 * @param {string} entityType - Business entity type
 * @returns {Array<{key: string, label: string, check: string}>}
 */
function getPublishRequirements(entityType) {
  const reqs = [
    // Universal requirements
    { key: 'description', label: 'Description (50+ characters)', check: 'description_length' },
    { key: 'categories', label: 'At least one category', check: 'categories_non_empty' },
  ];

  // Location requirement: physical location or service area
  if (SERVICE_AREA_LOCATION_TYPES.has(entityType)) {
    reqs.push({
      key: 'location',
      label: 'At least one geocoded location or defined service area',
      check: 'geocoded_location_or_service_area',
    });
  } else {
    reqs.push({
      key: 'location',
      label: 'At least one geocoded location',
      check: 'geocoded_location',
    });
  }

  // Catalog requirement: entity-type-aware
  if (!CATALOG_OPTIONAL_TYPES.has(entityType)) {
    if (DONATION_CATALOG_TYPES.has(entityType)) {
      reqs.push({
        key: 'catalog',
        label: 'At least one catalog or donation item',
        check: 'catalog_or_donation_item',
      });
    } else {
      reqs.push({
        key: 'catalog',
        label: 'At least one active catalog item',
        check: 'catalog_item',
      });
    }
  }

  // Pop-up: requires at least one future special hours entry
  if (entityType === 'pop_up_temporary') {
    reqs.push({
      key: 'popup_date',
      label: 'At least one upcoming event date (special hours)',
      check: 'future_special_hours',
    });
  }

  return reqs;
}

// Human-readable labels for entity types (used in signals, notifications)
const ENTITY_TYPE_LABELS = {
  for_profit: 'Business',
  home_service: 'Home Service',
  nonprofit_501c3: 'Nonprofit',
  religious_org: 'Religious Organization',
  community_group: 'Community Group',
  sole_proprietor: 'Sole Proprietor',
  pop_up_temporary: 'Pop-up',
  franchise_location: 'Franchise Location',
};

module.exports = {
  RESERVED_USERNAMES,
  ENTITY_TYPES,
  ENTITY_TYPE_CONFIG,
  ENTITY_TYPE_LABELS,
  VERIFICATION_STATUSES,
  VERIFICATION_RANK,
  VERIFICATION_MULTIPLIERS,
  FOUNDING_BUSINESS_MULTIPLIER,
  PUBLISH_REQUIREMENTS,
  getPublishRequirements,
  SERVICE_AREA_LOCATION_TYPES,
  CATALOG_OPTIONAL_TYPES,
  DONATION_CATALOG_TYPES,
};
