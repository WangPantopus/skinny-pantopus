// Shared constants for the Discover feature

export const CATEGORIES = [
  { value: 'lawn_care', label: 'Lawn Care' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'handyman', label: 'Handyman' },
  { value: 'pet_care', label: 'Pet Care' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'moving', label: 'Moving' },
  { value: 'tutoring', label: 'Tutoring' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'food_catering', label: 'Food & Catering' },
  { value: 'photography', label: 'Photography' },
  { value: 'other', label: 'Other' },
] as const;

// The slugs the phone apps' Create business saved before it saved names. A
// business created then still carries one, so it reads as its name here, as on
// iOS (`BusinessCategory.label(forLegacySlug:)`) and Android
// (`BusinessCategory.labelForLegacySlug`).
const LEGACY_PHONE_CATEGORY_NAMES: Record<string, string> = {
  home_services: 'Home services',
  personal_services: 'Personal services',
  tech_repair: 'Tech & repair',
  delivery_errands: 'Delivery & errands',
  goods_retail: 'Goods & retail',
  rentals: 'Rentals',
  vehicles_rideshare: 'Vehicles & rideshare',
  other: 'Other',
};

/** How a saved business category reads: `CATEGORY_MAP[category] || category`. */
export const CATEGORY_MAP: Record<string, string> = {
  ...LEGACY_PHONE_CATEGORY_NAMES,
  ...Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])),
};

export type DiscoverySort = 'relevance' | 'distance' | 'rating' | 'fastest_response';

export const TRUST_LENS_OPTIONS: {
  value: DiscoverySort;
  label: string;
}[] = [
  { value: 'distance', label: 'Closest' },
  { value: 'relevance', label: 'Most hired nearby' },
  { value: 'rating', label: 'Best rated' },
  { value: 'fastest_response', label: 'Fastest response' },
];

export const LS_TRUST_LENS_KEY = 'pantopus_trust_lens';

export const DEFAULT_RADIUS_MILES = 5;
export const MIN_RADIUS_MILES = 0.5;
export const MAX_RADIUS_MILES = 25;
