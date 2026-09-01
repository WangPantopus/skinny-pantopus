// ============================================================
// SEARCH / DISCOVER CONSTANTS
// Entity type display config for universal search results
// ============================================================

export interface SearchResultTypeStyle {
  icon: string;   // Ionicon name (mobile)
  color: string;  // hex color
  label: string;
}

export const SEARCH_RESULT_TYPE_CONFIG: Record<string, SearchResultTypeStyle> = {
  gig:      { icon: 'hammer',     color: '#FB923C', label: 'Task' },
  person:   { icon: 'person',     color: '#4F8EF7', label: 'Person' },
  beacon:   { icon: 'radio',      color: '#C026D3', label: 'Beacon' },
  business: { icon: 'storefront', color: '#34D399', label: 'Business' },
  home:     { icon: 'home',       color: '#A78BFA', label: 'Home' },
};
