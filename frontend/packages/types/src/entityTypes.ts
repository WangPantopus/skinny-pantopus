// ============================================================
// BUSINESS ENTITY TYPE TAXONOMY
// Structured config that drives fee rates, payment modes,
// catalog kinds, and UX flows per business entity type.
// ============================================================

import type { CatalogItemKind } from './business';

// ─── EntityType union ────────────────────────────────────────

export type EntityType =
  | 'for_profit'
  | 'home_service'
  | 'nonprofit_501c3'
  | 'religious_org'
  | 'community_group'
  | 'sole_proprietor'
  | 'pop_up_temporary'
  | 'franchise_location';

// ─── Payment modes ───────────────────────────────────────────

export type PaymentMode = 'charge' | 'donation' | 'dues';

// ─── Entity type config entry ────────────────────────────────

export interface EntityTypeConfig {
  label: string;
  defaultFeePct: number;
  allowedPaymentModes: PaymentMode[];
  catalogKindsAllowed: CatalogItemKind[];
  requiresPhysicalLocation: boolean;
  onboardingDescription: string;
}

// ─── All catalog kinds for convenience ───────────────────────

const ALL_CATALOG_KINDS: CatalogItemKind[] = [
  'service', 'product', 'menu_item', 'class', 'rental', 'membership', 'other',
];

// ─── Entity type configuration ───────────────────────────────

export const ENTITY_TYPE_CONFIG: Record<EntityType, EntityTypeConfig> = {
  for_profit: {
    label: 'For-Profit Business',
    defaultFeePct: 15,
    allowedPaymentModes: ['charge'],
    catalogKindsAllowed: ALL_CATALOG_KINDS,
    requiresPhysicalLocation: true,
    onboardingDescription: 'Standard business — salon, restaurant, retail, contractor, etc.',
  },
  home_service: {
    label: 'Home Service',
    defaultFeePct: 15,
    allowedPaymentModes: ['charge'],
    catalogKindsAllowed: ['service', 'other'],
    requiresPhysicalLocation: false,
    onboardingDescription: 'Lawn care, cleaning, handyman, or other service you bring to the customer.',
  },
  nonprofit_501c3: {
    label: 'Nonprofit (501c3)',
    defaultFeePct: 3,
    allowedPaymentModes: ['charge', 'donation'],
    catalogKindsAllowed: ALL_CATALOG_KINDS,
    requiresPhysicalLocation: false,
    onboardingDescription: 'Food bank, shelter, arts org, or other tax-exempt nonprofit.',
  },
  religious_org: {
    label: 'Religious Organization',
    defaultFeePct: 0,
    allowedPaymentModes: ['donation', 'dues'],
    catalogKindsAllowed: ['other'],
    requiresPhysicalLocation: false,
    onboardingDescription: 'Church, mosque, temple, synagogue, or other place of worship.',
  },
  community_group: {
    label: 'Community Group',
    defaultFeePct: 0,
    allowedPaymentModes: ['dues'],
    catalogKindsAllowed: ['membership', 'other'],
    requiresPhysicalLocation: false,
    onboardingDescription: 'HOA, neighborhood association, club, or community organization.',
  },
  sole_proprietor: {
    label: 'Sole Proprietor',
    defaultFeePct: 10,
    allowedPaymentModes: ['charge'],
    catalogKindsAllowed: ['service', 'product', 'other'],
    requiresPhysicalLocation: false,
    onboardingDescription: 'Freelancer, independent contractor, or person-as-business.',
  },
  pop_up_temporary: {
    label: 'Pop-Up / Temporary',
    defaultFeePct: 5,
    allowedPaymentModes: ['charge'],
    catalogKindsAllowed: ['product', 'service', 'other'],
    requiresPhysicalLocation: false,
    onboardingDescription: 'Farmers market vendor, garage sale, seasonal pop-up, or temporary business.',
  },
  franchise_location: {
    label: 'Franchise Location',
    defaultFeePct: 12,
    allowedPaymentModes: ['charge'],
    catalogKindsAllowed: ALL_CATALOG_KINDS,
    requiresPhysicalLocation: true,
    onboardingDescription: 'Chain restaurant branch, gym franchise, or other franchise-operated location.',
  },
};

// ─── Helpers ─────────────────────────────────────────────────

/** All valid entity type keys */
export const ENTITY_TYPES: EntityType[] = Object.keys(ENTITY_TYPE_CONFIG) as EntityType[];

/** Get config for an entity type, with fallback to for_profit */
export function getEntityTypeConfig(type: string): EntityTypeConfig {
  return ENTITY_TYPE_CONFIG[type as EntityType] ?? ENTITY_TYPE_CONFIG.for_profit;
}
