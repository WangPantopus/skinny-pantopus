// ============================================================
// @pantopus/ui-utils — Shared UI utility functions
// Single source of truth for formatting, status styles, and filters
// ============================================================

export { formatTimeAgo, formatDate, formatTimestamp, getDateKey, formatDateLabel, formatExpiration } from './time';
export { getInitials } from './text';
export {
  POST_TYPE_CONFIG,
  getPostTypeConfig,
  POST_TYPE_ICONS_LUCIDE,
  POST_TYPE_ICONS_IONICON,
  PURPOSE_TO_POST_TYPE,
  resolvePostType,
  isSportsComposerPurpose,
  mapComposerPurposeToApiPurpose,
  sportsComposerPurposeToStarterKey,
} from './post-types';
export type { PostTypeConfig } from './post-types';
export { formatPrice, toPriceLabel, getGigPrice } from './price';
export type { FormatPriceOptions } from './price';
export { formatDistance, radiusMilesToLatDelta } from './distance';
export {
  GIG_STATUS_STYLES,
  BID_STATUS_STYLES,
  PAYMENT_STATUS_STYLES,
  LISTING_STATUS_STYLES,
  CHANGE_ORDER_STATUS_STYLES,
  statusClasses,
  statusLabel,
  getStatusColor,
} from './status';
export type { StatusStyle } from './status';
export {
  matchesPriceFilter,
  gigMatchesFilters,
  sortGigs,
} from './filters';
export type { PriceFilterKey, SortKey } from './filters';
export {
  MARKETPLACE_LAYERS,
  LISTING_TYPE_TEMPLATES,
  MARKETPLACE_CATEGORIES,
  CONDITIONS,
  CONDITION_LABELS,
  FILTER_PILLS,
  LAYER_COLORS,
  MARKETPLACE_TABS,
  LAYER_LABELS,
  LISTING_TYPE_LABELS,
} from './marketplace-constants';
export type {
  LayerKey,
  ListingTypeKey,
  CategoryKey,
  ConditionKey,
  FilterPillKey,
  MarketplaceTab,
} from './marketplace-constants';
// Canonical marketplace contract — single source of truth for enums
export {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_CATEGORY_KEYS,
  LISTING_CONDITION_KEYS,
  CATEGORY_LABELS,
  LISTING_LAYERS,
  LISTING_TYPES,
  LOCATION_PRECISIONS,
  REVEAL_POLICIES,
  VISIBILITY_SCOPES,
} from './marketplace-contract';
export type {
  ListingCategory,
  ListingCondition,
  ListingLayer,
  ListingType,
  ListingLocationPrecision,
  ListingRevealPolicy,
  ListingVisibilityScope,
} from './marketplace-contract';
export { GIG_CATEGORIES, GIG_BROWSE_CATEGORIES, PRO_CATEGORIES, DELIVERY_CATEGORIES } from './gig-constants';
export type { GigCategory } from './gig-constants';
export { SEARCH_RESULT_TYPE_CONFIG } from './search-constants';
export type { SearchResultTypeStyle } from './search-constants';
export { COMMUNITY_TYPE_CONFIG, MAP_PIN_TYPE_CONFIG } from './mailbox-constants';
export type { CommunityTypeStyle } from './mailbox-constants';
export { WALLET_TX_TYPE_CONFIG } from './wallet-constants';
export type { WalletTxTypeStyle } from './wallet-constants';
export { buildBackendPayload, validateComposeState } from './compose-payload-builder';
export { getCurrentSeason, getStationeryConfig, INK_CONFIGS } from './stationery';
export type { InkConfig, StationeryConfig } from './stationery';
export {
  readAuthRedirectQuery,
  safeRedirectPath,
  extractApiError,
  extractFieldErrors,
  normalizeEmail,
  oauthRedirectParamForWeb,
} from './auth-form';
