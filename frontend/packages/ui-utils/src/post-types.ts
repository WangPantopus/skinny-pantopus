// ============================================================
// POST TYPE CONFIGURATION
// Single source of truth — replaces 7+ inline implementations
// ============================================================

export interface PostTypeConfig {
  label: string;
  /** Fill that white text sits on (avatar initials, the composer's submit, active chips, map pins): AA (4.5:1) with white. */
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
    color: '#0369A1',
    textColor: '#0369A1',
    darkTextColor: '#38BDF8',
    bgLight: '#EFF6FF',
    borderColor: '#BAE6FD',
    ctaLabel: 'Reply',
    ctaIcon: 'message-circle',
  },
  recommendation: {
    label: 'Recommendation',
    color: '#B45309',
    textColor: '#92400E',
    darkTextColor: '#FBBF24',
    bgLight: '#FFFBEB',
    borderColor: '#FDE68A',
    ctaLabel: 'Save',
    ctaIcon: 'bookmark',
  },
  event: {
    label: 'Event',
    color: '#7C3AED',
    textColor: '#7C3AED',
    darkTextColor: '#A78BFA',
    bgLight: '#F5F3FF',
    borderColor: '#C4B5FD',
    ctaLabel: 'Reply',
    ctaIcon: 'message-circle',
  },
  lost_found: {
    label: 'Lost & Found',
    color: '#DC2626',
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
    color: '#15803D',
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
    ctaLabel: 'Reply',
    ctaIcon: 'message-circle',
  },
  neighborhood_win: {
    label: 'Win',
    color: '#047857',
    textColor: '#047857',
    darkTextColor: '#34D399',
    bgLight: '#F0FDF4',
    borderColor: '#A7F3D0',
    ctaLabel: 'Reply',
    ctaIcon: 'message-circle',
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
    color: '#4F46E5',
    textColor: '#4F46E5',
    darkTextColor: '#A5B4FC',
    bgLight: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  announcement: {
    label: 'Announcement',
    color: '#0F766E',
    textColor: '#0F766E',
    darkTextColor: '#2DD4BF',
    bgLight: '#F0FDFA',
    borderColor: '#99F6E4',
    ctaLabel: 'Reply',
    ctaIcon: 'message-circle',
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
    color: '#0E7490',
    textColor: '#0E7490',
    darkTextColor: '#22D3EE',
    bgLight: '#ECFEFF',
    borderColor: '#A5F3FC',
    ctaLabel: 'Save',
    ctaIcon: 'bookmark',
  },
  progress_wins: {
    label: 'Progress',
    color: '#047857',
    textColor: '#047857',
    darkTextColor: '#34D399',
    bgLight: '#F0FDF4',
    borderColor: '#A7F3D0',
    ctaLabel: 'Reply',
    ctaIcon: 'message-circle',
  },
};

/**
 * Look up config for a post type, falling back to 'general' for unknown types.
 */
export function getPostTypeConfig(type: string): PostTypeConfig {
  return POST_TYPE_CONFIG[type] || POST_TYPE_CONFIG.general;
}

// ── How people react to a post ──
// One reaction per person (POST /api/posts/:id/like, counted in like_count), the same on web, iPhone and Android and
// in the author's notice (backend/utils/postReaction.js): Going on an event; on every other kind, one of the emoji
// below, and each emoji's count shows under the post.

export type PostReaction = 'going' | 'emoji';

export function postReaction(type: string | null | undefined): PostReaction {
  return type === 'event' ? 'going' : 'emoji';
}

/** The emoji a post can get, in the order the apps offer them; the backend accepts only these. */
export const POST_REACTION_EMOJIS: ReadonlyArray<{ emoji: string; name: string; id: string }> = [
  { emoji: '\u{1F44D}', name: 'Like', id: 'like' },
  { emoji: '\u{2764}\u{FE0F}', name: 'Love', id: 'love' },
  { emoji: '\u{1F602}', name: 'Haha', id: 'haha' },
  { emoji: '\u{1F62E}', name: 'Wow', id: 'wow' },
  { emoji: '\u{1F622}', name: 'Sad', id: 'sad' },
  { emoji: '\u{1F64F}', name: 'Thanks', id: 'thanks' },
  { emoji: '\u{1F389}', name: 'Celebrate', id: 'celebrate' },
];

/** A mark made before emoji reactions has no emoji and shows as this one. */
const DEFAULT_REACTION = POST_REACTION_EMOJIS[0].emoji;

const emojiOrder = (emoji: string) => {
  const index = POST_REACTION_EMOJIS.findIndex((option) => option.emoji === emoji);
  return index < 0 ? POST_REACTION_EMOJIS.length : index;
};

/** The emoji's name for screen readers ("Love"); one this build doesn't know reads as itself. */
export function postReactionName(emoji: string): string {
  return POST_REACTION_EMOJIS.find((option) => option.emoji === emoji)?.name ?? emoji;
}

/** The emoji's id for test ids ("love"). */
export function postReactionId(emoji: string): string {
  return POST_REACTION_EMOJIS.find((option) => option.emoji === emoji)?.id ?? 'other';
}

/** The reaction's count in words: "2 going", "3 reactions". */
export function postReactionCount(type: string | null | undefined, count: number): string {
  if (postReaction(type) === 'going') return `${count} going`;
  return `${count} ${count === 1 ? 'reaction' : 'reactions'}`;
}

export interface PostReactionCount {
  reaction: string;
  count: number;
}

type ReactedPost = {
  reactions?: PostReactionCount[] | null;
  like_count?: number | null;
  userReaction?: string | null;
  userHasLiked?: boolean | null;
};

/** Most used first; ties in the order the apps offer them. */
function sortReactions(reactions: PostReactionCount[]): PostReactionCount[] {
  return [...reactions].sort((a, b) => b.count - a.count || emojiOrder(a.reaction) - emojiOrder(b.reaction));
}

/**
 * Each emoji's count as the post shows it: the server's counts, or every mark as 👍 when it sent none (a server from
 * before emoji reactions; older marks are 👍).
 */
export function shownPostReactions(post: ReactedPost): PostReactionCount[] {
  const counts = (post.reactions ?? []).filter((entry) => entry.count > 0);
  if (counts.length) return sortReactions(counts);
  const total = post.like_count ?? 0;
  return total > 0 ? [{ reaction: DEFAULT_REACTION, count: total }] : [];
}

/** How many people reacted. */
export function postReactionTotal(post: ReactedPost): number {
  return shownPostReactions(post).reduce((sum, entry) => sum + entry.count, 0);
}

/** The viewer's own emoji: what the server said, or 👍 for a like from before emoji reactions. */
export function viewerPostReaction(post: ReactedPost): string | null {
  return post.userReaction ?? (post.userHasLiked ? DEFAULT_REACTION : null);
}

/** The counts after the viewer switches from `from` to `to` (either can be none), to show a tap at once. */
export function withViewerReaction(
  reactions: PostReactionCount[],
  from: string | null,
  to: string | null,
): PostReactionCount[] {
  const counts = new Map(reactions.map((entry) => [entry.reaction, entry.count]));
  if (from) counts.set(from, Math.max(0, (counts.get(from) ?? 0) - 1));
  if (to) counts.set(to, (counts.get(to) ?? 0) + 1);
  return sortReactions([...counts.entries()].map(([reaction, count]) => ({ reaction, count })).filter((entry) => entry.count > 0));
}

/** The card's few emoji: the most used first, up to `max`, the viewer's own always among them. */
export function summaryReactionEmojis(reactions: PostReactionCount[], viewer: string | null, max = 3): string[] {
  const top = reactions.slice(0, max).map((entry) => entry.reaction);
  if (!viewer || top.includes(viewer)) return top;
  return [viewer, ...top].slice(0, max);
}

/** What a screen reader hears for the counts: "3 Like, 2 Love". */
export function postReactionsSpoken(reactions: PostReactionCount[]): string {
  return reactions.map((entry) => `${entry.count} ${postReactionName(entry.reaction)}`).join(', ');
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
