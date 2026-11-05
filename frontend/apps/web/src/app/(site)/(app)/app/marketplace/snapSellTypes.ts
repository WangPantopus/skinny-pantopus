import type { ListingTypeKey } from './constants';

/** Payload from Snap & Sell (FAB) after photo upload + AI draft — opens create flow with fields + files. */
export type SnapSellListingBootstrap = {
  files: File[];
  /** If the model did not return a known listing type, user picks type first (fields still prefilled on form). */
  needsTypeStep: boolean;
  title?: string;
  description?: string;
  category?: string;
  condition?: string;
  price?: string;
  budgetMax?: string;
  meetupPreference?: string;
  deliveryAvailable?: boolean;
  listingType?: ListingTypeKey;
  priceSuggestion?: { low: number; high: number } | null;
};
