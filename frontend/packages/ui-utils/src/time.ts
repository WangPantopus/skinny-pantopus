// ============================================================
// TIME / DATE FORMATTING UTILITIES
// Single source of truth — replaces 25+ inline implementations
// ============================================================

/**
 * Format a date string as a relative time label.
 *
 * compact (default): "3m", "5h", "2d", "3w"
 * full:              "3m ago", "5h ago", "2d ago", "3w ago"
 *
 * Older dates fall through to absolute format regardless of style:
 * - > 30 d (same year)  → "Jan 15"
 * - > 365 d             → "Jan 15, 2024"
 */
export function formatTimeAgo(dateStr: string, style: 'compact' | 'full' = 'compact'): string {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';

  const suffix = style === 'full' ? ' ago' : '';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m${suffix}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h${suffix}`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d${suffix}`;

  const weeks = Math.floor(days / 7);
  if (weeks <= 4) return `${weeks}w${suffix}`;

  const d = new Date(dateStr);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();

  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();

  return sameYear ? `${month} ${day}` : `${month} ${day}, ${d.getFullYear()}`;
}

type DateFormat = 'short' | 'medium' | 'long';

/**
 * Format a date string in a named format.
 *
 * - short:  "Jan 15"
 * - medium: "Jan 15, 2025"  (default)
 * - long:   "January 15, 2025 at 3:45 PM"
 */
export function formatDate(dateStr: string, format: DateFormat = 'medium'): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';

  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'long':
      return d.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    case 'medium':
    default:
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
  }
}

/**
 * Format a date as a time-only string.
 *
 * - short:  "2:30 PM"
 * - medium: "Jan 15, 2:30 PM"
 * - long:   "January 15, 2025 at 2:30 PM"
 */
export function formatTimestamp(dateStr: string, style: 'short' | 'medium' | 'long' = 'short'): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';

  switch (style) {
    case 'short':
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    case 'medium':
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    case 'long':
      return d.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
  }
}

/**
 * Return "YYYY-MM-DD" for grouping messages/notifications by date.
 */
export function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Convert a "YYYY-MM-DD" date key into a human-readable label.
 *
 * - Today → "Today"
 * - Yesterday → "Yesterday"
 * - Same year → "Mon, Jan 15"
 * - Different year → "Jan 15, 2024"
 */
export function formatDateLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateKey;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  const sameYear = d.getFullYear() === now.getFullYear();
  if (sameYear) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format how much time remains until an expiration date.
 *
 * Returns null if there is no expiration date.
 */
export function formatExpiration(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return '< 1h left';
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}
