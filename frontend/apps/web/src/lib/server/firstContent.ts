// Server only: reads a tab's first content with the visitor's own session (lib/firstContent.ts).
//
// Every read is the visitor's: it carries only their access cookie, is never kept
// in any fetch cache (`no-store`, on pages that render per request), and a refusal
// or failure leaves the screen to load its data in the browser, as it does without
// first content. Nothing here may be shared between requests.
import { cookies, headers } from 'next/headers';
import { QueryClient, dehydrate, type DehydratedState, type QueryKey } from '@tanstack/react-query';
import { FIRST_CONTENT_ENABLED, FIRST_CONTENT_HEADER, firstContentTag } from '@/lib/firstContent';

// The API the web's rewrites forward to (next.config.js), read directly from here.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
// A document's reads hold its first bytes (components/first-content/FirstContentHold.tsx),
// so they share a short deadline: normally they answer in tens of milliseconds. A read
// still unanswered then (PlaceIntelligence's providers may take 3.5 s by design) is
// left to the browser, so a slow API never holds up the frame.
const READ_BUDGET_MS = 400;

export type FirstContentSession = {
  access: string;
  /** firstContentTag of the request's CSRF cookie: which account the content is for. */
  tag: string;
  /** The visitor's address, forwarded as the web's rewrites do (with the edge secret only). */
  forwardedFor: string | null;
  /** Ends every read of this page's request once its budget is spent. */
  deadline: AbortSignal;
};

/**
 * The session of a tab's document request (the middleware marks those), or null:
 * first content off, a client navigation or prefetch, or no access cookie (signed
 * out, or an expired session the document recovers in place).
 */
export async function firstContentSession(): Promise<FirstContentSession | null> {
  if (!FIRST_CONTENT_ENABLED) return null;
  const [requestHeaders, requestCookies] = await Promise.all([headers(), cookies()]);
  if (requestHeaders.get(FIRST_CONTENT_HEADER) !== '1') return null;
  const access = requestCookies.get('pantopus_access')?.value;
  if (!access || requestCookies.get('pantopus_session')?.value !== '1') return null;
  const forwarded = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  return {
    access,
    tag: firstContentTag(requestCookies.get('pantopus_csrf')?.value),
    forwardedFor: forwarded,
    deadline: AbortSignal.timeout(READ_BUDGET_MS),
  };
}

export class FirstContentReadError extends Error {
  constructor(readonly status: number | null) {
    super(`First content read failed (${status ?? 'no response'})`);
    this.name = 'FirstContentReadError';
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

/** GET an API path as the visitor. Throws FirstContentReadError on any non-2xx answer. */
export async function readAsVisitor<T>(session: FirstContentSession, path: string, params?: Params): Promise<T> {
  const url = new URL(path, API_BASE);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.append(key, String(value));
  }
  const edgeSecret = process.env.EDGE_PROXY_SECRET;
  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'x-token-transport': 'cookie',
      cookie: `pantopus_access=${session.access}`,
      ...(edgeSecret ? { 'x-pantopus-edge': edgeSecret, ...(session.forwardedFor ? { 'x-forwarded-for': session.forwardedFor } : {}) } : {}),
    },
    cache: 'no-store',
    redirect: 'manual',
    signal: session.deadline,
  }).catch(() => null);
  if (!response?.ok) throw new FirstContentReadError(response?.status ?? null);
  return (await response.json()) as T;
}

/** A read's answer, or undefined when it failed (that entry is left to the browser). */
export async function settled<T>(read: Promise<T>): Promise<T | undefined> {
  try {
    return await read;
  } catch {
    return undefined;
  }
}

/** Query-cache entries, as React Query hands them to the browser. */
export class FirstContentEntries {
  private readonly client = new QueryClient();
  private count = 0;

  set(queryKey: QueryKey, data: unknown, updatedAt = Date.now()): void {
    if (data === undefined) return;
    this.client.setQueryData(queryKey, data, { updatedAt });
    this.count += 1;
  }

  dehydrate(): DehydratedState | null {
    const state = this.count > 0 ? dehydrate(this.client) : null;
    this.client.clear();
    return state;
  }
}
