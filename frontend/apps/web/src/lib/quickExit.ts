// ============================================================
// Quick exit — the discreet "leave this page now" control used by
// Unlisted (and any surface aimed at someone who may be being watched).
//
// `replace`, never `assign` or a link: the page must not be left sitting
// in the back stack where one press of Back brings it up again.
//
// WHAT IT DOES NOT DO, and what the UI must therefore never claim: it
// cannot clear browsing history. Ohio's own Address Confidentiality
// Program page carries the same control with the same honest caveat.
// ============================================================

/** A neutral destination that is unremarkable in anyone's history. */
export const QUICK_EXIT_URL = 'https://www.google.com';

/**
 * Leave immediately, without adding a history entry.
 *
 * `target` is injectable so the behaviour is testable — jsdom's
 * `window.location` is unforgeable and cannot be stubbed in place.
 */
export function leaveNow(
  target: { replace(url: string): void } = window.location,
  url: string = QUICK_EXIT_URL,
): void {
  target.replace(url);
}
