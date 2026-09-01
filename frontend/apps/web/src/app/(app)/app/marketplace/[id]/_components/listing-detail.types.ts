export const CONDITION_LABELS: Record<string, string> = {
  new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair', poor: 'Poor',
};

export const CATEGORY_LABELS: Record<string, string> = {
  furniture: 'Furniture', electronics: 'Electronics', clothing: 'Clothing',
  kids_baby: 'Kids & Baby', tools: 'Tools', home_garden: 'Home & Garden',
  sports_outdoors: 'Sports', vehicles: 'Vehicles', books_media: 'Books',
  collectibles: 'Collectibles', appliances: 'Appliances', free_stuff: 'Free Stuff',
  other: 'Other',
};

export const LAYER_LABELS: Record<string, string> = {
  goods: 'Goods', gigs: 'Tasks', rentals: 'Rentals', vehicles: 'Vehicles',
};

export const LAYER_COLORS: Record<string, string> = {
  goods: 'bg-purple-100 text-purple-700',
  gigs: 'bg-orange-100 text-orange-700',
  rentals: 'bg-green-100 text-green-700',
  vehicles: 'bg-red-100 text-red-700',
};

export const LISTING_TYPE_LABELS: Record<string, string> = {
  sell_item: 'For Sale', free_item: 'Free', wanted_request: 'Wanted',
  rent_sublet: 'Rental', vehicle_sale: 'Vehicle Sale', vehicle_rent: 'Vehicle Rental',
  service_gig: 'Service',
};

export const REFRESH_COOLDOWN_DAYS = 5;

export const STATUS_OPTIONS = ['active', 'pending_pickup', 'sold', 'archived'] as const;

export function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

export function formatExpiration(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return '< 1 hour left';
  if (hours < 24) return `${hours} hours left`;
  const days = Math.floor(hours / 24);
  return `${days} days left`;
}

export function formatPrice(listing: { is_free?: boolean; price?: number | null }): string {
  if (listing.is_free) return 'FREE';
  if (listing.price == null || listing.price === 0) return 'Free';
  return `$${Number(listing.price).toFixed(2)}`;
}
