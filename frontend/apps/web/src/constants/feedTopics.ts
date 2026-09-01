// Sports topic lane constants for the web Pulse feed.
// Mirrors `frontend/apps/mobile/src/constants/feed.ts`.

export type TopicKey = 'sports';

export type SportsMode = 'for_you' | 'local' | 'event' | 'watch';

export const PLACE_TOPICS: { key: TopicKey; label: string }[] = [
  { key: 'sports', label: 'Sports' },
];

export const SPORTS_MODES: { key: SportsMode; label: string }[] = [
  { key: 'for_you', label: 'For You' },
  { key: 'local',   label: 'Local' },
  // The "event" chip label is replaced at runtime with the active event's
  // short_label (e.g. "NBA Playoffs", "World Cup"). Hidden when no event.
  { key: 'event',   label: 'Event' },
  { key: 'watch',   label: 'Watch' },
];

export const SPORTS_LEAGUES = [
  'nba', 'nfl', 'mls', 'nwsl', 'mlb', 'nhl', 'college', 'youth', 'other',
] as const;

export const SPORTS_SCOPES = [
  'local', 'regional', 'national', 'youth', 'school', 'rec', 'watch',
] as const;

export interface SportsStarter {
  key: string;
  label: string;
  scope?: string;
  isWatchPrompt?: boolean;
  isGameThread?: boolean;
  placeholder?: string;
}

export const SPORTS_STARTERS: SportsStarter[] = [
  { key: 'anyone_watching', label: 'Anyone watching tonight?', isGameThread: true,
    placeholder: 'Who are you watching tonight? Anyone want to join?' },
  { key: 'best_place_watch', label: 'Best place to watch?', scope: 'watch', isWatchPrompt: true,
    placeholder: 'Any good spots to watch around here?' },
  { key: 'youth_signups', label: 'Youth sports signups?', scope: 'youth',
    placeholder: 'Looking for youth league signups or tryouts…' },
  { key: 'pickup_weekend', label: 'Pickup game this weekend?', scope: 'rec',
    placeholder: 'Anyone want to run a pickup game this weekend?' },
];

/** Inline / modal Place composer — same four intents as Pulse starters (mobile `sportsLane` purposes). */
export const SPORTS_COMPOSER_INLINE_INTENTS: {
  starter_key: NonNullable<SportsComposerMetadata['starter_key']>;
  label: string;
  icon: string;
  bg: string;
  color: string;
  scope: string | null;
  meta: { is_game_thread?: boolean; is_watch_prompt?: boolean };
}[] = [
  {
    starter_key: 'anyone_watching',
    label: 'Anyone watching tonight?',
    icon: '🏀',
    bg: '#EFF6FF',
    color: '#2563EB',
    scope: null,
    meta: { is_game_thread: true, is_watch_prompt: false },
  },
  {
    starter_key: 'best_place_watch',
    label: 'Best place to watch?',
    icon: '📺',
    bg: '#F0F9FF',
    color: '#0284C7',
    scope: 'watch',
    meta: { is_watch_prompt: true, is_game_thread: false },
  },
  {
    starter_key: 'youth_signups',
    label: 'Youth sports signups?',
    icon: '🎒',
    bg: '#FEFCE8',
    color: '#CA8A04',
    scope: 'youth',
    meta: { is_game_thread: false, is_watch_prompt: false },
  },
  {
    starter_key: 'pickup_weekend',
    label: 'Pickup game this weekend?',
    icon: '📅',
    bg: '#F0FDF4',
    color: '#16A34A',
    scope: 'rec',
    meta: { is_game_thread: false, is_watch_prompt: false },
  },
];

export interface SportsQuickPrompt {
  key: string;
  label: string;
  placeholder: string;
  scope?: string;
  meta?: Record<string, unknown>;
}

export const SPORTS_QUICK_PROMPTS: SportsQuickPrompt[] = [
  { key: 'game_thread',    label: 'Game thread',
    placeholder: 'Who are you watching tonight? What are you hoping to see?',
    meta: { is_game_thread: true } },
  { key: 'where_to_watch', label: 'Where to watch?',
    placeholder: 'Best spots to watch around here?',
    scope: 'watch', meta: { is_watch_prompt: true } },
  { key: 'youth_sports',   label: 'Youth sports',
    placeholder: 'Signups, tryouts, or questions about youth leagues…',
    scope: 'youth' },
  { key: 'pickup_rec',     label: 'Pickup / rec',
    placeholder: 'Looking for a pickup game or rec league?',
    scope: 'rec' },
  { key: 'school_sports',  label: 'School sports',
    placeholder: 'Local high school / college sports update…',
    scope: 'school' },
  { key: 'postgame',       label: 'Postgame thoughts',
    placeholder: 'How did the game go? What did you think?' },
];

export interface SportsComposerMetadata {
  league?: string;
  team_tag?: string;
  event_key?: string;
  is_game_thread?: boolean;
  is_watch_prompt?: boolean;
  fresh_until?: string;
  /** Pulse Sports empty-state starter key — keep in sync with mobile `SPORTS_PULSE_STARTERS`. */
  starter_key?: 'anyone_watching' | 'best_place_watch' | 'youth_signups' | 'pickup_weekend';
}
