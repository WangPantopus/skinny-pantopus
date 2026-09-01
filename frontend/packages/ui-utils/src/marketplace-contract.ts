// ============================================================
// MARKETPLACE CONTRACT — Single source of truth
// All marketplace enum arrays, labels, and TypeScript types.
//
// Backend validation arrays (backend/routes/listings.js) must
// match these definitions exactly. When adding a new category
// or condition, update THIS file and the backend validation.
// ============================================================

// ─── Categories ──────────────────────────────────────────────

export const LISTING_CATEGORIES = [
  { key: 'furniture', label: 'Furniture' },
  { key: 'electronics', label: 'Electronics' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'kids_baby', label: 'Kids & Baby' },
  { key: 'tools', label: 'Tools' },
  { key: 'home_garden', label: 'Home & Garden' },
  { key: 'sports_outdoors', label: 'Sports & Outdoors' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'books_media', label: 'Books & Media' },
  { key: 'collectibles', label: 'Collectibles' },
  { key: 'appliances', label: 'Appliances' },
  { key: 'free_stuff', label: 'Free Stuff' },
  { key: 'food_baked_goods', label: 'Food & Baked Goods' },
  { key: 'plants_garden', label: 'Plants & Garden' },
  { key: 'pet_supplies', label: 'Pet Supplies' },
  { key: 'arts_crafts', label: 'Arts & Crafts' },
  { key: 'tickets_events', label: 'Tickets & Events' },
  { key: 'other', label: 'Other' },
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number]['key'];

/** Flat array of category keys — handy for validation loops */
export const LISTING_CATEGORY_KEYS = LISTING_CATEGORIES.map(c => c.key) as unknown as ListingCategory[];

/** key → label lookup */
export const CATEGORY_LABELS: Record<ListingCategory, string> = Object.fromEntries(
  LISTING_CATEGORIES.map(c => [c.key, c.label]),
) as Record<ListingCategory, string>;

// ─── Conditions ──────────────────────────────────────────────

export const LISTING_CONDITIONS = [
  { key: 'new', label: 'New' },
  { key: 'like_new', label: 'Like New' },
  { key: 'good', label: 'Good' },
  { key: 'fair', label: 'Fair' },
  { key: 'for_parts', label: 'For Parts' },
] as const;

export type ListingCondition = (typeof LISTING_CONDITIONS)[number]['key'];

export const LISTING_CONDITION_KEYS = LISTING_CONDITIONS.map(c => c.key) as unknown as ListingCondition[];

export const CONDITION_LABELS: Record<ListingCondition, string> = Object.fromEntries(
  LISTING_CONDITIONS.map(c => [c.key, c.label]),
) as Record<ListingCondition, string>;

// ─── Layers ──────────────────────────────────────────────────

export const LISTING_LAYERS = ['goods', 'gigs', 'rentals', 'vehicles'] as const;
export type ListingLayer = (typeof LISTING_LAYERS)[number];

// ─── Listing types ───────────────────────────────────────────

export const LISTING_TYPES = [
  'sell_item', 'free_item', 'wanted_request',
  'rent_sublet', 'vehicle_sale', 'vehicle_rent', 'service_gig',
  'pre_order', 'recurring', 'trade_swap', 'flash_sale',
] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

// ─── Location precisions ─────────────────────────────────────

export const LOCATION_PRECISIONS = ['exact_place', 'approx_area', 'neighborhood_only', 'none'] as const;
export type ListingLocationPrecision = (typeof LOCATION_PRECISIONS)[number];

// ─── Reveal policies ─────────────────────────────────────────

export const REVEAL_POLICIES = ['public', 'after_interest', 'after_assignment', 'never_public'] as const;
export type ListingRevealPolicy = (typeof REVEAL_POLICIES)[number];

// ─── Visibility scopes ──────────────────────────────────────

export const VISIBILITY_SCOPES = ['neighborhood', 'city', 'radius', 'global'] as const;
export type ListingVisibilityScope = (typeof VISIBILITY_SCOPES)[number];
