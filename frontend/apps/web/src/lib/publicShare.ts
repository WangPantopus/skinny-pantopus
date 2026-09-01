import { cache } from 'react';
import type { Metadata } from 'next';
import {
  ANDROID_PLAY_STORE_URL,
  API_BASE_URL,
  APP_NAME,
  APP_WEB_URL,
  IOS_APP_STORE_APP_ID,
  IOS_APP_STORE_URL,
} from '@pantopus/utils';

const API_BASE = API_BASE_URL.replace(/\/+$/, '');

export type PublicFetchResult<T> = {
  data: T | null;
  status: number;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizePublicProfileIdentifier(value: string): string {
  return String(value || '').trim().replace(/^@+/, '');
}

async function fetchPublicJson<T>(path: string): Promise<PublicFetchResult<T>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 60 },
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return { data: null, status: response.status };
    }

    return {
      data: (await response.json()) as T,
      status: response.status,
    };
  } catch {
    return { data: null, status: 500 };
  }
}

// React.cache dedupes identical calls within a single server-render pass
// (page.tsx + generateMetadata both fetch the same resource — cache ensures
// they share one network call instead of two).

export const fetchPublicGig = cache(async (id: string): Promise<PublicFetchResult<any>> => {
  const result = await fetchPublicJson<{ gig: any }>(`/api/gigs/${encodeURIComponent(id)}`);
  return { data: result.data?.gig ?? null, status: result.status };
});

export const fetchPublicListing = cache(async (id: string): Promise<PublicFetchResult<any>> => {
  const result = await fetchPublicJson<{ listing: any }>(`/api/listings/${encodeURIComponent(id)}`);
  return { data: result.data?.listing ?? null, status: result.status };
});

export const fetchPublicPost = cache(async (id: string): Promise<PublicFetchResult<any>> => {
  const result = await fetchPublicJson<{ post: any }>(`/api/posts/${encodeURIComponent(id)}`);
  return { data: result.data?.post ?? null, status: result.status };
});

export const fetchPublicSupportTrain = cache(async (id: string): Promise<PublicFetchResult<any>> => {
  const result = await fetchPublicJson<any>(
    `/api/activities/support-trains/${encodeURIComponent(id)}`
  );
  return { data: result.data ?? null, status: result.status };
});

// ── Calendarly public booking reads (mirror fetchPublicSupportTrain) ──
// The page/manage/poll SHELL is fetched server-side here (cache() +
// revalidate:60 via fetchPublicJson) for SEO + generateMetadata. Slots are
// fetched CLIENT-SIDE with no-store (see SlotPicker) so availability is fresh.

export const fetchPublicBooking = cache(
  async (slug: string, tz?: string): Promise<PublicFetchResult<any>> => {
    const qs = tz ? `?tz=${encodeURIComponent(tz)}` : '';
    const result = await fetchPublicJson<any>(
      `/api/public/book/${encodeURIComponent(slug)}${qs}`
    );
    return { data: result.data ?? null, status: result.status };
  }
);

export const fetchPublicOneOff = cache(
  async (token: string, tz?: string): Promise<PublicFetchResult<any>> => {
    const qs = tz ? `?tz=${encodeURIComponent(tz)}` : '';
    const result = await fetchPublicJson<any>(
      `/api/public/book/o/${encodeURIComponent(token)}${qs}`
    );
    return { data: result.data ?? null, status: result.status };
  }
);

export const fetchPublicBookingByToken = cache(
  async (token: string): Promise<PublicFetchResult<any>> => {
    const result = await fetchPublicJson<any>(
      `/api/public/booking/${encodeURIComponent(token)}`
    );
    return { data: result.data ?? null, status: result.status };
  }
);

export const fetchPublicPoll = cache(async (id: string): Promise<PublicFetchResult<any>> => {
  const result = await fetchPublicJson<any>(`/api/public/poll/${encodeURIComponent(id)}`);
  return { data: result.data ?? null, status: result.status };
});

export const fetchPublicUser = cache(async (username: string): Promise<PublicFetchResult<any>> => {
  const identifier = normalizePublicProfileIdentifier(username);
  if (!identifier) return { data: null, status: 404 };

  const result = await fetchPublicJson<any>(
    UUID_REGEX.test(identifier)
      ? `/api/users/id/${encodeURIComponent(identifier)}`
      : `/api/users/username/${encodeURIComponent(identifier)}`
  );

  if (result.data || result.status !== 404 || UUID_REGEX.test(identifier)) {
    return { data: result.data ?? null, status: result.status };
  }

  const legacyResult = await fetchPublicJson<any>(
    `/api/users/${encodeURIComponent(identifier)}`
  );
  return {
    data: legacyResult.data?.user ?? legacyResult.data ?? null,
    status: legacyResult.status,
  };
});

export const fetchPublicLocalProfile = cache(async (handle: string): Promise<PublicFetchResult<any>> => {
  const result = await fetchPublicJson<{ profile: any }>(
    `/api/local-profiles/${encodeURIComponent(handle)}`
  );
  return { data: result.data?.profile ?? null, status: result.status };
});

export const fetchPublicPersona = cache(async (handle: string): Promise<PublicFetchResult<any>> => {
  const result = await fetchPublicJson<{ persona: any; channel: any }>(
    `/api/personas/${encodeURIComponent(handle.replace(/^@/, ''))}`
  );
  return { data: result.data ?? null, status: result.status };
});

export function absoluteMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `${API_BASE}${value}`;
  return `${API_BASE}/${value.replace(/^\/+/, '')}`;
}

export function pickPreviewImage(...collections: unknown[]): string | null {
  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;
    for (const item of collection) {
      const resolved = absoluteMediaUrl(item);
      if (resolved) return resolved;
    }
  }
  return null;
}

const MAX_SHARE_PREVIEW_IMAGES = 10;

/** Distinct absolute image URLs from the same sources as {@link pickPreviewImage}, capped for OG + gallery. */
export function collectPreviewImages(...collections: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;
    for (const item of collection) {
      const resolved = absoluteMediaUrl(item);
      if (!resolved || seen.has(resolved)) continue;
      seen.add(resolved);
      out.push(resolved);
      if (out.length >= MAX_SHARE_PREVIEW_IMAGES) return out;
    }
  }
  return out;
}

export function summarizeText(value: unknown, max = 160, fallback = ''): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!text) return fallback;
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function buildShareMetadata(opts: {
  title: string;
  description: string;
  path: string;
  /** Primary image; ignored when `images` is non-empty. */
  image?: string | null;
  /** Multiple OG images (e.g. gallery); first is primary for Twitter. */
  images?: string[] | null;
  appArgument?: string | null;
}): Metadata {
  const url = `${APP_WEB_URL}${opts.path}`;
  const imageList =
    opts.images && opts.images.length > 0 ? opts.images : opts.image ? [opts.image] : [];
  const primaryImage = imageList[0];
  const smartBannerContent = IOS_APP_STORE_APP_ID
    ? [
        `app-id=${IOS_APP_STORE_APP_ID}`,
        opts.appArgument ? `app-argument=${opts.appArgument}` : null,
      ]
        .filter(Boolean)
        .join(', ')
    : null;

  return {
    title: `${opts.title} | ${APP_NAME}`,
    description: opts.description,
    alternates: {
      canonical: opts.path,
    },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: APP_NAME,
      type: 'website',
      images: imageList.length > 0 ? imageList.map((u) => ({ url: u })) : undefined,
    },
    twitter: {
      card: primaryImage ? 'summary_large_image' : 'summary',
      title: opts.title,
      description: opts.description,
      images: primaryImage ? [primaryImage] : undefined,
    },
    other: smartBannerContent
      ? {
          'apple-itunes-app': smartBannerContent,
        }
      : undefined,
  };
}

export function displayNameForUser(user: any, fallback = 'Pantopus member'): string {
  if (!user || typeof user !== 'object') return fallback;
  return user.name || user.first_name || user.firstName || user.username || fallback;
}

export function formatMoney(value: unknown): string | null {
  if (value == null || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatLocationLine(...parts: unknown[]): string | null {
  const cleaned = parts
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => String(part).trim());
  return cleaned.length > 0 ? cleaned.join(', ') : null;
}

export type StoreDownloadCta = {
  href: string;
  label: string;
};

export function getStoreDownloadCta(userAgent: string): StoreDownloadCta | null {
  const ua = userAgent.toLowerCase();
  const isAndroid = /android/.test(ua);
  const isIos = /iphone|ipad|ipod/.test(ua);

  if (isIos) {
    return IOS_APP_STORE_URL ? { href: IOS_APP_STORE_URL, label: 'Download on App Store' } : null;
  }

  if (isAndroid) {
    return ANDROID_PLAY_STORE_URL
      ? { href: ANDROID_PLAY_STORE_URL, label: 'Get it on Google Play' }
      : null;
  }

  if (IOS_APP_STORE_URL) {
    return { href: IOS_APP_STORE_URL, label: 'Download on App Store' };
  }

  if (ANDROID_PLAY_STORE_URL) {
    return { href: ANDROID_PLAY_STORE_URL, label: 'Get it on Google Play' };
  }

  return null;
}
