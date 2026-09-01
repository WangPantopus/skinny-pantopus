/**
 * Shared auth form helpers (web + mobile): redirects, API errors, email normalization.
 */

/**
 * Read post-login redirect from common query param names used across the app.
 */
export function readAuthRedirectQuery(params: URLSearchParams): string | undefined {
  const raw =
    params.get('redirectTo') ||
    params.get('redirect') ||
    params.get('returnUrl');
  return raw?.trim() || undefined;
}

/**
 * Validate a redirect path (+ optional same-origin query) for internal navigation after login/register.
 */
export function safeRedirectPath(redirectTo: string | null | undefined, fallback = '/app/hub'): string {
  if (!redirectTo) return fallback;

  let decoded = redirectTo.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // use trimmed raw
  }

  const q = decoded.indexOf('?');
  const path = q === -1 ? decoded : decoded.slice(0, q);
  const search = q === -1 ? '' : decoded.slice(q);

  if (path.includes('//') || path.includes('..') || path.includes('@') || path.includes('\\')) {
    return fallback;
  }

  if (path.startsWith('/app/')) {
    return path + search;
  }

  // Invite flows: /invite/:token or /invite/seat?token=…
  if (/^\/invite\/[a-zA-Z0-9_-]+$/.test(path)) {
    return path + search;
  }

  return fallback;
}

export function extractApiError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback;

  const errObj = err as Record<string, unknown> | null;

  const validationErrors = Array.isArray(errObj?.validationErrors) ? errObj.validationErrors : [];
  if (validationErrors.length > 0) {
    return validationErrors.map((m: unknown) => `- ${m}`).join('\n');
  }

  if (typeof errObj?.message === 'string' && errObj.message) {
    return errObj.message;
  }

  const data = errObj?.data as Record<string, unknown> | undefined;
  if (typeof data?.error === 'string' && data.error) {
    return data.error;
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return fallback;
}

export function extractFieldErrors(err: unknown): Record<string, string> {
  const errObj = err as Record<string, unknown> | null;
  const details = Array.isArray(errObj?.validationDetails) ? errObj.validationDetails : [];
  const fieldErrors: Record<string, string> = {};
  for (const d of details) {
    const detail = d as Record<string, unknown>;
    if (typeof detail?.field === 'string' && typeof detail?.message === 'string' && !fieldErrors[detail.field]) {
      fieldErrors[detail.field] = detail.message;
    }
  }
  return fieldErrors;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Backend OAuth validates `redirectTo` with `new URL(...)` — must be absolute same-origin on web.
 */
export function oauthRedirectParamForWeb(
  raw: string | undefined,
  origin: string | undefined
): string | undefined {
  if (!raw || !origin) return undefined;
  try {
    const abs = new URL(raw, origin).href;
    const o = new URL(origin).origin;
    if (new URL(abs).origin !== o) return undefined;
    return abs;
  } catch {
    return undefined;
  }
}
