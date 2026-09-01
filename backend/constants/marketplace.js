// ============================================================
// MARKETPLACE CONSTANTS — Backend canonical values
// Keep in sync with frontend/packages/ui-utils/src/marketplace-contract.ts
// ============================================================

const LISTING_CATEGORIES = [
  'furniture', 'electronics', 'clothing', 'kids_baby', 'tools',
  'home_garden', 'sports_outdoors', 'vehicles', 'books_media',
  'collectibles', 'appliances', 'free_stuff',
  'food_baked_goods', 'plants_garden', 'pet_supplies', 'arts_crafts', 'tickets_events',
  'other',
];

const LISTING_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'for_parts'];

const LISTING_STATUSES = ['draft', 'active', 'pending_pickup', 'sold', 'archived', 'reserved', 'traded'];

const LOCATION_PRECISIONS = ['exact_place', 'approx_area', 'neighborhood_only', 'none'];

const REVEAL_POLICIES = ['public', 'after_interest', 'after_assignment', 'never_public'];

const VISIBILITY_SCOPES = ['neighborhood', 'city', 'radius', 'global'];

const LISTING_LAYERS = ['goods', 'gigs', 'rentals', 'vehicles'];

const LISTING_TYPES = [
  'sell_item', 'free_item', 'wanted_request',
  'rent_sublet', 'vehicle_sale', 'vehicle_rent', 'service_gig',
  'pre_order', 'recurring', 'trade_swap', 'flash_sale',
];

module.exports = {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_STATUSES,
  LOCATION_PRECISIONS,
  REVEAL_POLICIES,
  VISIBILITY_SCOPES,
  LISTING_LAYERS,
  LISTING_TYPES,
};
