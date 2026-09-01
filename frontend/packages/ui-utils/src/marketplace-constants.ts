// ============================================================
// MARKETPLACE CONSTANTS — Shared, platform-agnostic
// No icon references — platforms add their own icon maps.
// ============================================================

import {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  CONDITION_LABELS as CONTRACT_CONDITION_LABELS,
  type ListingCategory,
  type ListingCondition,
} from './marketplace-contract';

// ─── Layers ──────────────────────────────────────────────────

export const MARKETPLACE_LAYERS = [
  { key: 'all', label: 'All Layers' },
  { key: 'goods', label: 'Goods' },
  { key: 'gigs', label: 'Tasks' },
  { key: 'rentals', label: 'Rentals' },
  { key: 'vehicles', label: 'Vehicles' },
] as const;

export type LayerKey = (typeof MARKETPLACE_LAYERS)[number]['key'];

// ─── Listing type templates ─────────────────────────────────

export const LISTING_TYPE_TEMPLATES = {
  sell_item: { label: 'Sell Item', layer: 'goods', requiresPrice: true, requiresCondition: true },
  free_item: { label: 'Give Away', layer: 'goods', requiresPrice: false, requiresCondition: true },
  wanted_request: { label: 'Wanted', layer: 'goods', requiresPrice: false, requiresCondition: false, requiresBudgetMax: true },
  rent_sublet: { label: 'Rent / Sublet', layer: 'rentals', requiresPrice: true, requiresCondition: false },
  vehicle_sale: { label: 'Sell Vehicle', layer: 'vehicles', requiresPrice: true, requiresCondition: true },
  vehicle_rent: { label: 'Rent Vehicle', layer: 'vehicles', requiresPrice: true, requiresCondition: true },
  service_gig: { label: 'Offer Service', layer: 'gigs', requiresPrice: true, requiresCondition: false },
  pre_order: { label: 'Pre-Order', layer: 'goods', requiresPrice: true, requiresCondition: false },
  recurring: { label: 'Recurring', layer: 'goods', requiresPrice: true, requiresCondition: false },
  trade_swap: { label: 'Trade / Swap', layer: 'goods', requiresPrice: false, requiresCondition: true },
  flash_sale: { label: 'Flash Sale', layer: 'goods', requiresPrice: true, requiresCondition: true },
} as const;

export type ListingTypeKey = keyof typeof LISTING_TYPE_TEMPLATES;

// ─── Categories ──────────────────────────────────────────────
// Derived from the canonical marketplace contract.
// The 'all' entry is a UI-only filter, not a real category.

export const MARKETPLACE_CATEGORIES = [
  { key: 'all' as const, label: 'All' },
  ...LISTING_CATEGORIES.map(c => ({ key: c.key, label: c.label })),
] as const;

export type CategoryKey = 'all' | ListingCategory;

// ─── Conditions ──────────────────────────────────────────────

export const CONDITIONS = LISTING_CONDITIONS.map(c => c.key);

export type ConditionKey = ListingCondition;

export const CONDITION_LABELS: Record<string, string> = { ...CONTRACT_CONDITION_LABELS };

// ─── Filter pills ────────────────────────────────────────────

export const FILTER_PILLS = [
  { key: 'all', label: 'All' },
  { key: 'free', label: 'Free' },
  { key: 'wanted', label: 'Wanted' },
  { key: 'nearby', label: '< 1 mi' },
  { key: 'trusted', label: 'Verified' },
  { key: 'new_today', label: 'New Today' },
  { key: 'remote', label: 'Remote' },
  { key: 'price_0_25', label: 'Under $25' },
  { key: 'price_25_100', label: '$25–100' },
  { key: 'price_100_up', label: '$100+' },
] as const;

export type FilterPillKey = (typeof FILTER_PILLS)[number]['key'];

// ─── Layer colors (for map pins) ─────────────────────────────

export const LAYER_COLORS: Record<string, string> = {
  goods: '#7c3aed',     // purple
  gigs: '#f97316',      // orange
  rentals: '#16a34a',   // green
  vehicles: '#dc2626',  // red
};

// ─── Tabs ────────────────────────────────────────────────────

export const MARKETPLACE_TABS = [
  { key: 'global', label: 'Global Finds' },
  { key: 'near', label: 'Near My Home' },
  { key: 'gigs', label: 'Skills & Tasks' },
] as const;

export type MarketplaceTab = (typeof MARKETPLACE_TABS)[number]['key'];

// ─── Label maps ──────────────────────────────────────────────

export const LAYER_LABELS: Record<string, string> = {
  goods: 'Goods',
  gigs: 'Tasks',
  rentals: 'Rentals',
  vehicles: 'Vehicles',
};

export const LISTING_TYPE_LABELS: Record<string, string> = {
  sell_item: 'For Sale',
  free_item: 'Free',
  wanted_request: 'Wanted',
  rent_sublet: 'Rental',
  vehicle_sale: 'Vehicle Sale',
  vehicle_rent: 'Vehicle Rental',
  service_gig: 'Service',
  pre_order: 'Pre-Order',
  recurring: 'Recurring',
  trade_swap: 'Trade',
  flash_sale: 'Flash Sale',
};
