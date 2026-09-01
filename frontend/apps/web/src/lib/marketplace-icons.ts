// ============================================================
// MARKETPLACE ICONS — Web (Lucide icon names)
// Maps shared constant keys to Lucide component names.
// ============================================================

import type { CategoryKey, ListingTypeKey, LayerKey, FilterPillKey } from '@pantopus/ui-utils';

/** Lucide icon name per marketplace layer */
export const LAYER_ICONS: Record<LayerKey, string> = {
  all: 'LayoutGrid',
  goods: 'Package',
  gigs: 'Wrench',
  rentals: 'Home',
  vehicles: 'Car',
};

/** Lucide icon name per marketplace category */
export const CATEGORY_ICONS: Record<CategoryKey, string> = {
  all: 'LayoutGrid',
  furniture: 'BedDouble',
  electronics: 'Laptop',
  clothing: 'Shirt',
  kids_baby: 'Baby',
  tools: 'Hammer',
  home_garden: 'Leaf',
  sports_outdoors: 'Trophy',
  vehicles: 'Car',
  books_media: 'BookOpen',
  collectibles: 'Gem',
  appliances: 'Refrigerator',
  free_stuff: 'Gift',
  food_baked_goods: 'Utensils',
  plants_garden: 'Sprout',
  pet_supplies: 'PawPrint',
  arts_crafts: 'Palette',
  tickets_events: 'Ticket',
  other: 'Package',
};

/** Lucide icon name per listing type */
export const LISTING_TYPE_ICONS: Record<ListingTypeKey, string> = {
  sell_item: 'Tag',
  free_item: 'Gift',
  wanted_request: 'Search',
  rent_sublet: 'Key',
  vehicle_sale: 'Car',
  vehicle_rent: 'Car',
  service_gig: 'Hammer',
  pre_order: 'CalendarClock',
  recurring: 'Repeat',
  trade_swap: 'RefreshCw',
  flash_sale: 'Zap',
};

/** Lucide icon name per filter pill */
export const FILTER_PILL_ICONS: Record<FilterPillKey, string> = {
  all: 'LayoutGrid',
  free: 'Gift',
  wanted: 'Search',
  nearby: 'MapPin',
  trusted: 'ShieldCheck',
  new_today: 'Sparkles',
  remote: 'Globe',
  price_0_25: 'DollarSign',
  price_25_100: 'BadgeDollarSign',
  price_100_up: 'CircleDollarSign',
};
