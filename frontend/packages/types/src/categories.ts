// ============================================================
// GIG CATEGORIES — Single source of truth
// ============================================================

// ── Browse categories (original 13) ─────────────────────────
export const GIG_BROWSE_CATEGORIES = [
  'Handyman',
  'Cleaning',
  'Moving',
  'Pet Care',
  'Child Care',
  'Tutoring',
  'Photography',
  'Cooking',
  'Delivery',
  'Tech Support',
  'Gardening',
  'Event Help',
  'Other',
] as const;

// ── Pro-service categories ───────────────────────────────────
export const PRO_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Roofing',
  'General Contractor',
  'Landscaping Pro',
  'Home Inspector',
  'Painting Pro',
  'Flooring',
] as const;

// ── Delivery/errand categories ───────────────────────────────
export const DELIVERY_CATEGORIES = [
  'Delivery',
  'Errands',
  'Grocery Pickup',
] as const;

// ── Full category list (all 24, no duplicates) ───────────────
export const GIG_CATEGORIES = [
  // Original browse categories
  'Handyman', 'Cleaning', 'Moving', 'Pet Care', 'Child Care',
  'Tutoring', 'Photography', 'Cooking', 'Delivery', 'Tech Support',
  'Gardening', 'Event Help', 'Other',
  // Pro-service additions
  'Plumbing', 'Electrical', 'HVAC', 'Roofing', 'General Contractor',
  'Landscaping Pro', 'Home Inspector', 'Painting Pro', 'Flooring',
  // Delivery additions
  'Errands', 'Grocery Pickup',
] as const;

export type GigCategory = (typeof GIG_CATEGORIES)[number];
export type GigBrowseCategory = (typeof GIG_BROWSE_CATEGORIES)[number];
export type ProCategory = (typeof PRO_CATEGORIES)[number];
export type DeliveryCategory = (typeof DELIVERY_CATEGORIES)[number];
