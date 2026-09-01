// ============================================================
// MAILBOX / COMMUNITY CONSTANTS
// Display configs for community mail items and map pins
// ============================================================

export interface CommunityTypeStyle {
  emoji: string;
  label: string;
  color: string;  // hex color
}

export const COMMUNITY_TYPE_CONFIG: Record<string, CommunityTypeStyle> = {
  civic_notice:           { emoji: '🏛', label: 'Civic Notice',  color: '#1E40AF' },
  neighborhood_event:     { emoji: '🎉', label: 'Event',         color: '#7C3AED' },
  local_business:         { emoji: '🏪', label: 'Business',      color: '#065F46' },
  building_announcement:  { emoji: '🏢', label: 'Announcement',  color: '#92400E' },
};

export const MAP_PIN_TYPE_CONFIG: Record<string, CommunityTypeStyle> = {
  permit:       { emoji: '📜', label: 'Building Permit', color: '#B91C1C' },
  delivery:     { emoji: '📦', label: 'Delivery',        color: '#D97706' },
  notice:       { emoji: '📋', label: 'Notice',          color: '#92400E' },
  civic:        { emoji: '🏛', label: 'Civic Notice',    color: '#1E40AF' },
  utility_work: { emoji: '⚡', label: 'Utility Work',    color: '#065F46' },
  community:    { emoji: '👥', label: 'Community',        color: '#7C3AED' },
};
