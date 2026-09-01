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

export const CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
);

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
