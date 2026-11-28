import type { plans } from '@pantopus/api';
import { cache } from 'react';
import type { Metadata } from 'next';
import type { CardJourneyGoal } from '@pantopus/api';
import { ANDROID_PLAY_STORE_URL, API_BASE_URL, APP_NAME, APP_WEB_URL, IOS_APP_STORE_APP_ID, IOS_APP_STORE_URL, chosenUsername } from '@pantopus/utils';

const API_BASE = API_BASE_URL.replace(/\/+$/, '');

export type PublicFetchResult<T> = {
  data: T | null;
  status: number;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizePublicProfileIdentifier(value: string): string {
  return String(value || '').trim().replace(/^@+/, '');
}

export async function fetchPublicJson<T>(
  path: string,
  options: { noStore?: boolean } = {},
): Promise<PublicFetchResult<T>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, options.noStore ? {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    } : {
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

export type PublicCardDesigns = {
  year: number;
  /** In shelf order; `short`, `slug`, `line`, `pick` and `parts` as on HolidayCardCollection. */
  collections?: { id: string; name: string; short?: string; slug?: string; line?: string; designs: string[]; pick?: string;
    parts?: { name: string; designs: string[] }[] }[];
  designs: { id: string; number: number; slug: string; caption: string; paper: string; collection?: string | null; table: string;
    mood?: 'reverence' | 'santa' | 'nostalgia' | null; verse?: string | null;
    /** Set here on a thank-you design taken from `thank_you` (openThankYou); the server never sends it in `designs`. */
    kind?: 'thank_you' }[];
  /** With digital stamps on: the free cards an account starts with. Absent: sending is free, one card a day. */
  free_cards?: number;
  /** The shelves and a page per collection (server key card_shelves). Absent: today's pages. */
  shelves?: boolean;
  /** The order "One from each collection" draws the collections in (SPEC E2); absent: the collections' order. */
  opening?: string[];
  /**
   * Thank-you cards (Wave 5, only while the card improvements are on): every thank-you collection there is, `open` by
   * Pacific time, and their designs (square pictures, `number` null). The web builds a collection's pages while open.
   */
  thank_you?: {
    collections: { id: string; name: string; short?: string; slug?: string; line?: string; designs: string[]; pick?: string;
      opens_on: string; closes_on: string | null; open: boolean }[];
    designs: { id: string; number: number | null; slug: string; caption: string; paper: string; collection?: string | null; table: string;
      mood?: 'reverence' | 'santa' | 'nostalgia' | null }[];
  };
};

/** The shelves are on (server key card_shelves, card shelves SPEC Part D) and the collections carry their facts. */
export function publicShelvesOn(data: Pick<PublicCardDesigns, 'shelves' | 'collections'>): boolean {
  const collections = data.collections ?? [];
  return data.shelves === true && collections.length > 0 && collections.every((c) => typeof c.slug === 'string' && Boolean(c.slug));
}

/**
 * The thank-you collections open now and their designs (Wave 5), shaped as the Christmas ones and marked `kind`; none
 * while the read has no `thank_you` or nothing is open. Their pages exist only while this lists them.
 */
export function openThankYou(data: Pick<PublicCardDesigns, 'thank_you'> | null) {
  const collections = (data?.thank_you?.collections ?? []).filter((c) => c.open && c.slug);
  const ids = new Set(collections.flatMap((c) => c.designs));
  const designs = (data?.thank_you?.designs ?? []).filter((d) => ids.has(d.id) && d.slug)
    .map((d) => ({ ...d, number: d.number ?? 0, kind: 'thank_you' as const }));
  return { collections, designs };
}

/** Every Christmas card, for the public card pages (on with Christmas cards; 404 while they're off). */
export const fetchPublicCardDesigns = cache(async (): Promise<PublicFetchResult<PublicCardDesigns>> => (
  fetchPublicJson<PublicCardDesigns>('/api/mailbox/cards/designs')
));

/** All cards this Christmas (D3), for /cards (404 while the travelling card is off). */
export const fetchCardJourneyGoal = cache(async (): Promise<PublicFetchResult<CardJourneyGoal>> => {
  const result = await fetchPublicJson<{ goal: CardJourneyGoal }>('/api/mailbox/cards/journeys');
  return { data: result.data?.goal ?? null, status: result.status };
});

/** The invite code a shared card's link carries in `ref`, if it looks like one. It's only ever passed on to sign-up. */
export function shareRefFrom(value: string | string[] | undefined): string | null {
  const ref = Array.isArray(value) ? value[0] : value;
  return ref && /^[A-Za-z0-9]{4,32}$/.test(ref) ? ref : null;
}

export const fetchPublicGig = cache(async (id: string): Promise<PublicFetchResult<any>> => {
  const result = await fetchPublicJson<{ gig: any }>(`/api/gigs/${encodeURIComponent(id)}`);
  return { data: result.data?.gig ?? null, status: result.status };
});

export const fetchPublicListing = cache(async (id: string): Promise<PublicFetchResult<any>> => {
  const result = await fetchPublicJson<{ listing: any }>(`/api/listings/${encodeURIComponent(id)}`);
  return { data: result.data?.listing ?? null, status: result.status };
});

export const fetchPublicPost = cache(async (id: string): Promise<PublicFetchResult<any>> => {
  const result = await fetchPublicJson<{ post: any }>(
    `/api/posts/${encodeURIComponent(id)}`,
    { noStore: true },
  );
  return { data: result.data?.post ?? null, status: result.status };
});

/**
 * A friend's invite link: who sent it (as neighbors see them), or valid: false for a code nobody has. `creator`: the
 * code is one the founder gave a creator (admin creator links).
 */
export type PublicJoin = { valid: boolean; referrer_name?: string; referrer_avatar?: string | null; code?: string; creator?: boolean };

export const fetchPublicJoin = cache(async (code: string): Promise<PublicFetchResult<PublicJoin>> =>
  fetchPublicJson<PublicJoin>(`/api/users/public/join/${encodeURIComponent(code)}`, { noStore: true }));

/**
 * What a Christmas card page's store button carries through the install. With a `ref` that is a creator's code (admin
 * creator links), its join link: both apps open `/join/<code>` into Create account with the code, so the account is
 * recorded against the creator. The apps can take only one link, so that person starts on the app's first screen rather
 * than on the cards. Anything else (no `ref`, a person's own invite code from a shared card, a code nobody has): the
 * sending flow (`path`), exactly as before.
 */
export async function cardsStoreLink(path: string, ref: string | null): Promise<{ path: string; joins: boolean }> {
  if (!ref) return { path, joins: false };
  const { data } = await fetchPublicJoin(ref);
  return data?.valid && data.creator === true && data.code
    ? { path: `/join/${encodeURIComponent(data.code)}`, joins: true }
    : { path, joins: false };
}

export const fetchPublicSupportTrain = cache(async (id: string): Promise<PublicFetchResult<any>> => {
  const result = await fetchPublicJson<any>(
    `/api/activities/support-trains/${encodeURIComponent(id)}`,
    { noStore: true },
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

/**
 * A Nearby Plans share link: the plan's public card (area only), or `{ kind: 'playdate', city }`. A business's plan
 * (board D6) is the same card plus `business`, `label`, `label_text`, `place` and `price`, and comes as the whole
 * card for a playdate too (a kids' class); a person's plan has none of those keys.
 *
 * A private plan (only the people its host invites can see it) answers `{ private: true }` and nothing else, unless
 * the link carries a live invitation to it: then the same card, with `private: true`.
 */
export type PublicPlan = {
  id?: string;
  kind:
    | 'watch_party'
    | 'playdate'
    | 'pickup_game'
    | 'walk_coffee'
    | 'study_group'
    | 'food_drinks'
    | 'game_night'
    | 'outdoors'
    | 'something_else';
  title?: string;
  about?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  /** "Picking a date" while the host picks one (08-extras section 2): the page shows it in place of the time. */
  time_text?: string | null;
  starts_on?: string | null;
  day_part?: string | null;
  timezone?: string;
  area?: { label: string; city: string | null; precision: string };
  /** 'online': people join with a link, which this page never gets. */
  place_kind?: 'public' | 'home' | 'online';
  host?: { display_name: string; avatar_url: string | null; verified_address: boolean; plans_hosted: number };
  spots?: number;
  going_count?: number;
  spots_left?: number;
  is_full?: boolean;
  waitlist_count?: number;
  details?: Record<string, unknown>;
  state?: 'upcoming' | 'live' | 'ended' | 'cancelled';
  city?: string | null;
  /** With ?invite=<token>: whose invitation it is, and for an email invitation a hint of the address it went to. */
  invite?: PublicPlanInvite;
  /** A business's plan: the business that hosts it (`host.display_name` is its name too). */
  business?: PublicPlanBusiness | null;
  /** A business's plan: what it calls the plan, a key from a fixed list per kind, and the words to show for it. */
  label?: string | null;
  label_text?: string | null;
  /** A business's plan: its place by name and street address, the business's own. Never a point. */
  place?: { name: string; address: string | null } | null;
  /** A business's plan: null is Free. */
  price?: PublicPlanPrice | null;
  /** A repeating plan: how often ("Every Tue and Thu") and its last date (YYYY-MM-DD). */
  repeat?: { text: string; short: string; last_on: string } | null;
  /** A private plan. Without a live invitation in the link this is the only key, and there is no card to show. */
  private?: boolean;
  /** The occasion that started it (H3): its name stands where the kind's would. */
  occasion?: { key: string; text: string } | null;
  /**
   * Plans for the holidays (H1), while the host has the switch: with a way in (an invitation's token, the open link)
   * or the guest's own key, the form and the guest's own answer. Absent otherwise: the page is today's.
   */
  answer?: PublicPlanAnswer | null;
  /** With the guest's own key, while they are in: the place, the note for people in and who is going. */
  for_guest?: PublicPlanForGuest | null;
  /** The guest's key is a guest's the host removed: the invitation is no longer open, and nothing else. */
  removed?: boolean;
};

export type PublicPlanGuestState = 'in' | 'waiting_ok' | 'maybe' | 'cant';

export type PublicPlanAnswer = {
  can: boolean;
  via: 'open' | 'email' | 'link';
  needs_email: boolean;
  kids_welcome: boolean;
  room_left: number;
  host_says_yes_first: boolean;
  /** The page was opened with the plan's live open link (contract 6.9): "Open app" carries it into the app. */
  open_live?: boolean;
  /** Find a date (the extras): while the host picks, the times to tick in place of the three answers. */
  dates?: PublicPlanDates | null;
  /** Photos afterwards (the extras): a guest who was in may look, on a plan that is over. */
  photos?: { count: number; add_text: string; note: string } | null;
  mine: {
    state: PublicPlanGuestState;
    name: string;
    adults: number;
    kids: number;
    email_hint: string | null;
    /** What changed since this guest answered; a waiting guest's page says so too (a move to the host's home). */
    changed?: 'time' | 'place' | 'both' | null;
  } | null;
};

export type PublicPlanForGuest = {
  place: { name: string; address: string | null; latitude: number | null; longitude: number | null; link?: string | null };
  guest_note: string | null;
  going: string[];
  /** The bring list (H2), while the host has it on. */
  bring: PublicPlanBring | null;
  changed: 'time' | 'place' | 'both' | null;
  /** Chip in (the extras, 08-extras section 3), while the host has it on. Every word is the server's. */
  chip_in?: PublicPlanChipIn | null;
  /** The gift exchange (the extras): whom this guest drew is in their own page only. */
  gift?: PublicPlanGift | null;
};

export type PublicPlanGift = plans.Gift;

export type PublicPlanDates = {
  state: 'picking';
  host_line: string;
  /** The line under "Save my times": "You’re in when {Host} picks a time you ticked." or, for someone who will wait for
   * the host's yes, "When {Host} picks a time you ticked, {Host} lets you in." (08-extras section 2). */
  mine_text?: string;
  answered: number;
  invited: number;
  answered_text: string;
  options: { id: string; starts_at: string; ends_at: string; text: string; can: number; can_text: string; mine?: boolean }[];
  mine?: { answered: boolean };
};

export type PublicPlanChipIn = plans.ChipIn;

export type PublicPlanBring = plans.Bring;

export type PublicPlanBusiness = {
  name: string;
  avatar_url: string | null;
  verified: boolean;
  page_url: string | null;
  plans_hosted: number;
};

export type PublicPlanPrice = {
  cents: number;
  currency: string;
  per: 'person' | 'family';
  // Sent while the business takes payment for spots (Plans for the holidays B2/B3): the server's own words.
  text?: string;
  line?: string;
  join_text?: string;
  refund_until?: string;
  refund_text?: string;
};

export type PublicPlanInvite = {
  host_first_name: string;
  available: boolean;
  channel: 'account' | 'email' | 'link';
  email_hint: string | null;
};

/** An invitation's token as it rides in ?invite= (43 base64url characters), or null. */
export function planInviteToken(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

/** A guest's key or the open link's token: 43 base64url characters, as an invitation's token. */
export const planSecret = planInviteToken;

/**
 * The plan's public answer. `invite` and `open` are the page's ways in; `guest` is the guest's own key, which the page
 * reads from its HttpOnly cookie and sends from the server only (never in a link the page shows).
 */
export const fetchPublicPlan = cache(async (
  id: string,
  invite: string | null = null,
  open: string | null = null,
  guest: string | null = null,
): Promise<PublicFetchResult<PublicPlan>> => {
  const params = new URLSearchParams();
  if (invite) params.set('invite', invite);
  if (open) params.set('open', open);
  if (guest) params.set('guest', guest);
  const query = params.toString() ? `?${params.toString()}` : '';
  const result = await fetchPublicJson<PublicPlan>(
    `/api/public/plans/${encodeURIComponent(id)}${query}`,
    { noStore: true },
  );
  return { data: result.data ?? null, status: result.status };
});

export const fetchPublicPoll = cache(async (id: string): Promise<PublicFetchResult<any>> => {
  const result = await fetchPublicJson<any>(`/api/public/poll/${encodeURIComponent(id)}`);
  return { data: result.data ?? null, status: result.status };
});

export const fetchPublicUser = cache(async (username: string): Promise<PublicFetchResult<any>> => {
  const identifier = normalizePublicProfileIdentifier(username);
  if (!identifier) return { data: null, status: 404 };

  // Not cached: Next keeps serving the last 200 after the API answers 403 or 404, so a profile made
  // private, a deleted account or a closed business would stay in the page title.
  const result = await fetchPublicJson<any>(
    UUID_REGEX.test(identifier)
      ? `/api/users/id/${encodeURIComponent(identifier)}`
      : `/api/users/username/${encodeURIComponent(identifier)}`,
    { noStore: true },
  );

  if (result.data || result.status !== 404 || UUID_REGEX.test(identifier)) {
    return { data: result.data ?? null, status: result.status };
  }

  const legacyResult = await fetchPublicJson<any>(
    `/api/users/${encodeURIComponent(identifier)}`,
    { noStore: true },
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
    `/api/personas/${encodeURIComponent(handle.replace(/^@/, ''))}`,
    { noStore: true },
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
  /**
   * False leaves out Safari's app banner. Installing from it drops the link, so a page that exists for people
   * new to Pantopus (an invitation) sends them through its own app buttons, which carry the link.
   */
  smartBanner?: boolean;
}): Metadata {
  const url = `${APP_WEB_URL}${opts.path}`;
  const imageList =
    opts.images && opts.images.length > 0 ? opts.images : opts.image ? [opts.image] : [];
  const primaryImage = imageList[0];
  const smartBannerContent = IOS_APP_STORE_APP_ID && opts.smartBanner !== false
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

// Posts, tasks and listings name their author with the public identity the signed-in app shows (type, handle,
// displayName, avatarUrl); profiles and Support Train organizers send the person's name and username.
export function displayNameForUser(user: any, fallback = 'Pantopus member'): string {
  if (!user || typeof user !== 'object') return fallback;
  // A made-up username is never shown as the person's name: user_…, or one the server flags (the pre-October-7 kind
  // built from the email address).
  const handle = user.usernameIsGenerated ? null : chosenUsername(user.username || user.handle);
  return user.displayName || user.name || user.first_name || user.firstName || handle || fallback;
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
  /**
   * On an iPhone, the page's link to copy on the way to the App Store. The App Store passes nothing to the new
   * app, so its first screen offers the copied link back with a Paste button.
   */
  copyPath?: string | null;
};

/** The phone a store button is for, read from the user agent; null for anything else. */
export function storePlatform(userAgent: string): 'ios' | 'android' | null {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return null;
}

/** A page's own path (`/join/abc`, `/plans/x?invite=…`): the only links a store button carries. */
function carriedPath(path: string | null | undefined): string | null {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
}

/**
 * The Google Play address with the page's link in its install referrer. Google Play hands the referrer to the
 * app on its first launch, which opens the link as if it had been tapped (Android `InstallReferrerLink`).
 */
export function playStoreUrlCarrying(storeUrl: string, path: string | null | undefined): string {
  const carried = carriedPath(path);
  if (!carried) return storeUrl;
  try {
    const url = new URL(storeUrl);
    url.searchParams.set('referrer', `pantopus_link=${encodeURIComponent(carried)}`);
    return url.toString();
  } catch {
    return storeUrl;
  }
}

/**
 * The store button for this phone. With `path` (the page's own link), the button carries the link through the
 * install: in Google Play's install referrer on Android, copied on the way to the App Store on an iPhone.
 */
export function getStoreDownloadCta(userAgent: string, path?: string | null): StoreDownloadCta | null {
  const platform = storePlatform(userAgent);

  if (platform === 'ios') {
    return IOS_APP_STORE_URL
      ? { href: IOS_APP_STORE_URL, label: 'Download on App Store', copyPath: carriedPath(path) }
      : null;
  }

  if (platform === 'android') {
    return ANDROID_PLAY_STORE_URL
      ? { href: playStoreUrlCarrying(ANDROID_PLAY_STORE_URL, path), label: 'Get it on Google Play' }
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
