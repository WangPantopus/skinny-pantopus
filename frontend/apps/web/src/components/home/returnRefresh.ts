/** Coming back to a Home page (window focus, the tab becoming visible) re-checks it in the background at most this often. */
export const RETURN_REFRESH_MS = 30_000;

/**
 * A background re-check that failed only because the network or server didn't answer keeps what
 * is on screen. Any other failure (access refused, the record gone, a session change, an answer
 * that didn't verify) goes through the page's full reload, which shows the current state.
 */
export function transientFailure(error: unknown): boolean {
  const failure = error as { name?: string; statusCode?: unknown } | null;
  const status = failure?.statusCode;
  if (typeof status === 'number') return status === 408 || status === 429 || status >= 500;
  // Without a status only the API client's own network failure counts; a check that failed in the page doesn't.
  return failure?.name === 'ApiRequestError';
}
