// The address lookups' limits (backend/middleware/rateLimiter.js and
// backend/services/geo/signedOutBudget.js) answer 429 with the sentence to
// show: today's free lookups or suggestions are used, or lookups are busy for
// everyone. The API client puts that sentence in the error's `message`.

/** The sentence a lookup's 429 carries, or null for any other failure. */
export function lookupLimitMessage(error: unknown): string | null {
  const failure = error as { statusCode?: unknown; message?: unknown } | null | undefined;
  if (failure?.statusCode !== 429) return null;
  return typeof failure.message === 'string' && failure.message ? failure.message : null;
}

/** The caller used today's five lookups; the UI must check session state separately. */
export function isDailyLookupLimit(error: unknown): boolean {
  return (error as { code?: unknown } | null | undefined)?.code === 'PLACE_LOOKUP_LIMIT';
}
