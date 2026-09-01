// ============================================================
// SHARED UTILITY FUNCTIONS
// Used by both web and mobile applications
// ============================================================

// ============ CONSTANTS ============

export const APP_NAME = 'Pantopus';
export const APP_VERSION = '1.0.0';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

// API Configuration
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export const APP_WEB_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_APP_URL ||
    process.env.EXPO_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.EXPO_PUBLIC_SITE_URL ||
    'https://www.pantopus.com'
);

export const IOS_APP_STORE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_IOS_APP_STORE_URL ||
    process.env.EXPO_PUBLIC_IOS_APP_STORE_URL ||
    'https://apps.apple.com/us/app/pantopus/id6760512315'
);

export const IOS_APP_STORE_APP_ID =
  process.env.NEXT_PUBLIC_IOS_APP_STORE_APP_ID ||
  process.env.EXPO_PUBLIC_IOS_APP_STORE_APP_ID ||
  '6760512315';

export const ANDROID_PLAY_STORE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL ||
    process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_URL ||
    'https://play.google.com/store/apps/details?id=com.pantopus.app'
);

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL || process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8000';

// Public share URL helpers
export function buildGigPath(gigId: string): string {
  return `/gigs/${encodeURIComponent(gigId)}`;
}

export function buildGigShareUrl(gigId: string): string {
  return `${APP_WEB_URL}${buildGigPath(gigId)}`;
}

export function buildGigAppUrl(gigId: string): string {
  return `pantopus:///gig/${encodeURIComponent(gigId)}`;
}

export function buildSupportTrainPath(supportTrainId: string): string {
  return `/support-trains/${encodeURIComponent(supportTrainId)}`;
}

export function buildSupportTrainShareUrl(supportTrainId: string): string {
  return `${APP_WEB_URL}${buildSupportTrainPath(supportTrainId)}`;
}

export function buildSupportTrainAppUrl(supportTrainId: string): string {
  return `pantopus:///support-trains/${encodeURIComponent(supportTrainId)}`;
}

// ─── Calendarly booking links (mirror buildSupportTrain*) ────

/** Public booking page path: /book/:slug (slug = booking PAGE slug). */
export function buildBookingPagePath(slug: string): string {
  return `/book/${encodeURIComponent(slug)}`;
}

export function buildBookingPageUrl(slug: string): string {
  return `${APP_WEB_URL}${buildBookingPagePath(slug)}`;
}

/** Public event path: /book/:slug/:eventTypeSlug. */
export function buildBookingEventPath(slug: string, eventTypeSlug: string): string {
  return `/book/${encodeURIComponent(slug)}/${encodeURIComponent(eventTypeSlug)}`;
}

/** One-off booking link path: /book/o/:token. */
export function buildOneOffBookingPath(token: string): string {
  return `/book/o/${encodeURIComponent(token)}`;
}

/** Invitee manage path: /booking/:token (token = one-time manage token). */
export function buildBookingManagePath(token: string): string {
  return `/booking/${encodeURIComponent(token)}`;
}

export function buildBookingManageUrl(token: string): string {
  return `${APP_WEB_URL}${buildBookingManagePath(token)}`;
}

export function buildBookingPageAppUrl(slug: string): string {
  return `pantopus:///book/${encodeURIComponent(slug)}`;
}

export function buildBookingManageAppUrl(token: string): string {
  return `pantopus:///booking/${encodeURIComponent(token)}`;
}

export function buildListingPath(listingId: string): string {
  return `/listing/${encodeURIComponent(listingId)}`;
}

export function buildListingShareUrl(listingId: string): string {
  return `${APP_WEB_URL}${buildListingPath(listingId)}`;
}

export function buildListingAppUrl(listingId: string): string {
  return `pantopus:///listing/${encodeURIComponent(listingId)}`;
}

export function buildPostPath(postId: string): string {
  return `/posts/${encodeURIComponent(postId)}`;
}

export function buildPostShareUrl(postId: string): string {
  return `${APP_WEB_URL}${buildPostPath(postId)}`;
}

/**
 * Public web path for sharing a feed post. When the post promotes a task or
 * marketplace listing, use the canonical gig/listing URL (industry standard:
 * one stable URL per entity for SEO and link previews).
 */
export function buildCanonicalPathForPost(post: {
  id: string;
  ref_task_id?: string | null;
  ref_listing_id?: string | null;
}): string {
  if (post.ref_task_id) return buildGigPath(post.ref_task_id);
  if (post.ref_listing_id) return buildListingPath(post.ref_listing_id);
  return buildPostPath(post.id);
}

export function buildCanonicalShareUrlForPost(post: {
  id: string;
  ref_task_id?: string | null;
  ref_listing_id?: string | null;
}): string {
  return `${APP_WEB_URL}${buildCanonicalPathForPost(post)}`;
}

/** Deep link aligned with {@link buildCanonicalShareUrlForPost} (task, listing, or post). */
export function buildCanonicalAppUrlForPost(post: {
  id: string;
  ref_task_id?: string | null;
  ref_listing_id?: string | null;
}): string {
  if (post.ref_task_id) return buildGigAppUrl(post.ref_task_id);
  if (post.ref_listing_id) return buildListingAppUrl(post.ref_listing_id);
  return buildPostAppUrl(post.id);
}

export function buildPostAppUrl(postId: string): string {
  return `pantopus:///post/${encodeURIComponent(postId)}`;
}

export function buildUserProfilePath(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

export function buildUserProfileShareUrl(username: string): string {
  return `${APP_WEB_URL}${buildUserProfilePath(username)}`;
}

export function buildPersonaPath(handle: string): string {
  return `/@${encodeURIComponent(handle.replace(/^@/, ''))}`;
}

export function buildPersonaShareUrl(handle: string): string {
  return `${APP_WEB_URL}${buildPersonaPath(handle)}`;
}

export function buildPersonaAppUrl(handle: string): string {
  return `pantopus:///persona/${encodeURIComponent(handle.replace(/^@/, ''))}`;
}

// Map Configuration
export const DEFAULT_MAP_CENTER = {
  latitude: 45.5152, // Portland, OR
  longitude: -122.6784,
};

export const DEFAULT_MAP_ZOOM = 12;
export const DEFAULT_SEARCH_RADIUS_KM = 10;

// Gig Categories — re-exported from @pantopus/types (single source of truth)
export {
  GIG_CATEGORIES,
  GIG_BROWSE_CATEGORIES,
  PRO_CATEGORIES,
  DELIVERY_CATEGORIES,
} from '@pantopus/types';

// File Upload Limits
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

// ============ DATE/TIME UTILITIES ============

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** @deprecated Use `formatTimeAgo` from `@pantopus/ui-utils` instead. */
export function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;

  return formatDate(date);
}

export function isToday(date: string | Date): boolean {
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

export function isYesterday(date: string | Date): boolean {
  const d = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toDateString() === yesterday.toDateString();
}

// ============ CURRENCY UTILITIES ============

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0;
}

// ============ STRING UTILITIES ============

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** @deprecated Use `getInitials` from `@pantopus/ui-utils` instead. */
export function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============ VALIDATION UTILITIES ============

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function isValidZipCode(zip: string): boolean {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zip);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const minLength = 12;

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============ GEOSPATIAL UTILITIES ============

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Haversine formula - returns distance in kilometers
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m away`;
  }
  return `${distanceKm.toFixed(1)}km away`;
}

// ============ FILE UTILITIES ============

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}

export function isImageFile(filename: string): boolean {
  const ext = getFileExtension(filename).toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext);
}

export function isVideoFile(filename: string): boolean {
  const ext = getFileExtension(filename).toLowerCase();
  return ['mp4', 'mov', 'avi', 'webm'].includes(ext);
}

// ============ ARRAY UTILITIES ============

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============ DEBOUNCE/THROTTLE ============

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============ LOCAL STORAGE UTILITIES ============

export function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setInStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

export function removeFromStorage(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing from localStorage:', error);
  }
}

// ============ ERROR HANDLING ============

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

// ============ RATING UTILITIES ============

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function getRatingColor(rating: number): string {
  if (rating >= 4.5) return 'green';
  if (rating >= 3.5) return 'yellow';
  return 'red';
}

// ============ COLOR UTILITIES ============

export function generateColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = hash % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

// ============ CLIPBOARD UTILITIES ============

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export {
  buildAttomDisplaySections,
  humanizeAttomKey,
  type AttomDisplayRow,
  type AttomDisplaySection,
  type AttomPayloadLike,
} from './attomPropertyDisplay';

export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];
