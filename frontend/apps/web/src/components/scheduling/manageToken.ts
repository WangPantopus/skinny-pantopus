// One-time manage-token persistence. The invitee's manage/reschedule/cancel/
// .ics token is returned ONCE on booking create — persist it keyed by the
// booking-page slug so the invitee can manage their booking later even
// without the link. (localStorage, browser-only, fails soft.)

const PREFIX = "pantopus.calendarly.manageToken.";

function key(slug: string): string {
  return `${PREFIX}${slug}`;
}

export function saveManageToken(slug: string, token: string): void {
  if (typeof window === "undefined" || !slug || !token) return;
  try {
    window.localStorage.setItem(key(slug), token);
  } catch {
    // ignore quota / privacy-mode failures
  }
}

export function getManageToken(slug: string): string | null {
  if (typeof window === "undefined" || !slug) return null;
  try {
    return window.localStorage.getItem(key(slug));
  } catch {
    return null;
  }
}

export function clearManageToken(slug: string): void {
  if (typeof window === "undefined" || !slug) return;
  try {
    window.localStorage.removeItem(key(slug));
  } catch {
    // ignore
  }
}
