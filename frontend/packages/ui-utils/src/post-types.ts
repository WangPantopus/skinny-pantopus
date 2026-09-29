// ============================================================
// POST TYPE CONFIGURATION
// Single source of truth — replaces 7+ inline implementations
// ============================================================

export interface PostTypeConfig {
  label: string;
  color: string;
  /** Text in `color`'s hue that meets WCAG AA (4.5:1) on `bgLight` and on light tints of `color`. */
  textColor: string;
  /** Text in `color`'s hue that meets AA on dark mode's surfaces and on dark tints of `color`. */
  darkTextColor: string;
  bgLight: string;
  borderColor: string;
  ctaLabel?: string;
  ctaIcon?: string; // semantic icon name (not platform-specific)
}

export const POST_TYPE_CONFIG: Record<string, PostTypeConfig> = {
  // ── Place types ──
  ask_local: {
    label: 'Ask Local',
    color: '#0284C7',
    textColor: '#0369A1',
    darkTextColor: '#38BDF8',
    bgLight: '#EFF6FF',
    borderColor: '#BAE6FD',
    ctaLabel: 'Reply',
    ctaIcon: 'message-circle',
  },
  recommendation: {
    label: 'Recommendation',
    color: '#F59E0B',
    textColor: '#B45309',
    darkTextColor: '#FBBF24',
    bgLight: '#FFFBEB',
    borderColor: '#FDE68A',
    ctaLabel: 'Save',
    ctaIcon: 'bookmark',
  },
  event: {
    label: 'Event',
    color: '#8B5CF6',
    textColor: '#7C3AED',
    darkTextColor: '#A78BFA',
    bgLight: '#F5F3FF',
    borderColor: '#C4B5FD',
    ctaLabel: 'Interested',
    ctaIcon: 'hand',
  },
  lost_found: {
    label: 'Lost & Found',
    color: '#EF4444',
    textColor: '#B91C1C',
    darkTextColor: '#F87171',
    bgLight: '#FEF2F2',
    borderColor: '#FECACA',
    ctaLabel: 'I Spotted This',
    ctaIcon: 'map-pin',
  },
  alert: {
    label: 'Alert',
    color: '#DC2626',
    textColor: '#B91C1C',
    darkTextColor: '#F87171',
    bgLight: '#FEF2F2',
    borderColor: '#FECACA',
    ctaLabel: 'Stay Safe',
    ctaIcon: 'alert-triangle',
  },
  deal: {
    label: 'Deal',
    color: '#16A34A',
    textColor: '#166534',
    darkTextColor: '#4ADE80',
    bgLight: '#F0FDF4',
    borderColor: '#BBF7D0',
    ctaLabel: 'View Deal',
    ctaIcon: 'tag',
  },
  local_update: {
    label: 'Update',
    color: '#374151',
    textColor: '#374151',
    darkTextColor: '#9CA3AF',
    bgLight: '#F9FAFB',
    borderColor: '#E5E7EB',
    ctaLabel: 'Good to Know',
    ctaIcon: 'thumbs-up',
  },
  neighborhood_win: {
    label: 'Win',
    color: '#059669',
    textColor: '#047857',
    darkTextColor: '#34D399',
    bgLight: '#F0FDF4',
    borderColor: '#A7F3D0',
    ctaLabel: 'Celebrate',
    ctaIcon: 'party-popper',
  },
  visitor_guide: {
    label: 'Guide',
    color: '#7C3AED',
    textColor: '#7C3AED',
    darkTextColor: '#A78BFA',
    bgLight: '#FAF5FF',
    borderColor: '#DDD6FE',
    ctaLabel: 'Save',
    ctaIcon: 'bookmark',
  },
  // ── Non-Place types ──
  general: {
    label: 'Post',
    color: '#6B7280',
    textColor: '#4B5563',
    darkTextColor: '#9CA3AF',
    bgLight: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  personal_update: {
    label: 'Update',
    color: '#6366F1',
    textColor: '#4F46E5',
    darkTextColor: '#A5B4FC',
    bgLight: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  announcement: {
    label: 'Announcement',
    color: '#0D9488',
    textColor: '#0F766E',
    darkTextColor: '#2DD4BF',
    bgLight: '#F0FDFA',
    borderColor: '#99F6E4',
    ctaLabel: 'Good to Know',
    ctaIcon: 'thumbs-up',
  },
  service_offer: {
    label: 'Service',
    color: '#7C3AED',
    textColor: '#7C3AED',
    darkTextColor: '#A78BFA',
    bgLight: '#FAF5FF',
    borderColor: '#DDD6FE',
    ctaLabel: 'Reach Out',
    ctaIcon: 'message-circle',
  },
  resources_howto: {
    label: 'Resource',
    color: '#0891B2',
    textColor: '#0E7490',
    darkTextColor: '#22D3EE',
    bgLight: '#ECFEFF',
    borderColor: '#A5F3FC',
    ctaLabel: 'Save',
    ctaIcon: 'bookmark',
  },
  progress_wins: {
    label: 'Progress',
    color: '#059669',
    textColor: '#047857',
    darkTextColor: '#34D399',
    bgLight: '#F0FDF4',
    borderColor: '#A7F3D0',
    ctaLabel: 'Celebrate',
    ctaIcon: 'party-popper',
  },
};

/**
 * Look up config for a post type, falling back to 'general' for unknown types.
 */
export function getPostTypeConfig(type: string): PostTypeConfig {
  return POST_TYPE_CONFIG[type] || POST_TYPE_CONFIG.general;
}

// ── Platform-specific icon maps ──
// Web (Lucide) components import POST_TYPE_ICONS_LUCIDE
// Mobile (Ionicons) components import POST_TYPE_ICONS_IONICON

export const POST_TYPE_ICONS_LUCIDE: Record<string, string> = {
  ask_local: 'MessageCircle',
  recommendation: 'Star',
  event: 'CalendarDays',
  lost_found: 'Search',
  alert: 'AlertTriangle',
  deal: 'Tag',
  local_update: 'Newspaper',
  neighborhood_win: 'Trophy',
  visitor_guide: 'Compass',
  general: 'Pencil',
  personal_update: 'User',
  announcement: 'Megaphone',
  service_offer: 'Wrench',
  resources_howto: 'BookOpen',
  progress_wins: 'Trophy',
};

export const POST_TYPE_ICONS_IONICON: Record<string, string> = {
  ask_local: 'help-circle',
  recommendation: 'thumbs-up',
  event: 'calendar',
  lost_found: 'search',
  alert: 'warning',
  deal: 'pricetag',
  local_update: 'newspaper',
  neighborhood_win: 'trophy',
  visitor_guide: 'compass',
  general: 'chatbubble-ellipses',
  personal_update: 'person',
  announcement: 'megaphone',
  service_offer: 'construct',
  resources_howto: 'book',
  progress_wins: 'trophy',
};

// ── Purpose-to-type resolver ──
// Maps composer "purpose" intents to canonical post_type values.
// Shared across web and mobile — single source of truth.
export const PURPOSE_TO_POST_TYPE: Record<string, string> = {
  ask: 'ask_local',
  offer: 'service_offer',
  heads_up: 'alert',
  recommend: 'recommendation',
  lost_found: 'lost_found',
  local_update: 'local_update',
  neighborhood_win: 'neighborhood_win',
  visitor_guide: 'visitor_guide',
  learn: 'general',
  showcase: 'progress_wins',
  story: 'general',
  event: 'event',
  deal: 'deal',
  // Sports topic lane — composer-only keys; stored API `purpose` stays canonical (see mapComposerPurposeToApiPurpose).
  sports_anyone_watching: 'ask_local',
  sports_best_place_watch: 'ask_local',
  sports_youth_signups: 'ask_local',
  sports_pickup_weekend: 'ask_local',
};

/** Canonical `purpose` values accepted by POST /api/posts (Post_purpose_check). */
const SPORTS_COMPOSER_TO_API_PURPOSE: Record<string, 'ask'> = {
  sports_anyone_watching: 'ask',
  sports_best_place_watch: 'ask',
  sports_youth_signups: 'ask',
  sports_pickup_weekend: 'ask',
};

/** Stable keys aligned with Pulse empty-state starters → post_metadata.starter_key */
const SPORTS_COMPOSER_TO_STARTER_KEY: Record<string, string> = {
  sports_anyone_watching: 'anyone_watching',
  sports_best_place_watch: 'best_place_watch',
  sports_youth_signups: 'youth_signups',
  sports_pickup_weekend: 'pickup_weekend',
};

export function isSportsComposerPurpose(purpose: string | null | undefined): boolean {
  return typeof purpose === 'string' && purpose.startsWith('sports_');
}

/** Map internal composer purpose (including sports_* keys) to API / DB purpose enum. */
export function mapComposerPurposeToApiPurpose(purpose: string | null | undefined): string | undefined {
  if (purpose == null || purpose === '') return undefined;
  return SPORTS_COMPOSER_TO_API_PURPOSE[purpose] ?? purpose;
}

/** When set, callers should merge into sports postMetadata for analytics / UX continuity. */
export function sportsComposerPurposeToStarterKey(purpose: string | null | undefined): string | undefined {
  if (purpose == null) return undefined;
  return SPORTS_COMPOSER_TO_STARTER_KEY[purpose];
}

/**
 * Resolve a composer purpose to its canonical post_type.
 * Falls back to 'general' for unknown purposes.
 */
export function resolvePostType(purpose: string): string {
  return PURPOSE_TO_POST_TYPE[purpose] || 'general';
}
