// ============================================================
// MARKETPLACE CONSTANTS (Web)
// Re-exports shared constants from @pantopus/ui-utils with
// platform-specific icon augmentation.
// ============================================================

import {
  MARKETPLACE_LAYERS,
  MARKETPLACE_CATEGORIES,
  FILTER_PILLS as SHARED_FILTER_PILLS,
  MARKETPLACE_TABS as SHARED_MARKETPLACE_TABS,
} from '@pantopus/ui-utils';
import { CATEGORY_ICONS } from '@/lib/marketplace-icons';

// Re-export data-only constants directly
export {
  LISTING_TYPE_TEMPLATES,
  CONDITIONS,
  CONDITION_LABELS,
  LAYER_COLORS,
  LAYER_LABELS,
  LISTING_TYPE_LABELS,
} from '@pantopus/ui-utils';
export type {
  LayerKey,
  ListingTypeKey,
  CategoryKey,
  FilterPillKey,
  MarketplaceTab,
} from '@pantopus/ui-utils';

// ─── Layers with Lucide icon names ───────────────────────────

const LAYER_ICON_MAP: Record<string, string> = {
  all: 'LayoutGrid',
  goods: 'Package',
  gigs: 'Wrench',
  rentals: 'Home',
  vehicles: 'Car',
};

export const LAYERS = MARKETPLACE_LAYERS.map((l) => ({
  ...l,
  icon: LAYER_ICON_MAP[l.key] ?? 'Package',
}));

// ─── Categories with Lucide icon name (kept as 'emoji' for compatibility) ─

export const CATEGORIES = MARKETPLACE_CATEGORIES.map((c) => ({
  ...c,
  emoji: CATEGORY_ICONS[c.key] ?? 'Package',
}));

// ─── Filter pills ────────────────────────────────────────────

export const FILTER_PILLS = SHARED_FILTER_PILLS;

// ─── Tabs ────────────────────────────────────────────────────

export const MARKETPLACE_TABS = SHARED_MARKETPLACE_TABS;

// Helpers — re-exported from shared package
export { formatTimeAgo, formatDistance, formatExpiration } from '@pantopus/ui-utils';
