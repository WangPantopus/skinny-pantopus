/**
 * Shared auth form helpers (web + mobile): redirects, API errors, email normalization.
 */

/**
 * Read post-login redirect from common query param names used across the app.
 */
export function readAuthRedirectQuery(params: Pick<URLSearchParams, 'get'> | null | undefined): string | undefined {
  const raw =
    params?.get('redirectTo') ||
    params?.get('redirect') ||
    params?.get('returnUrl');
  return raw?.trim() || undefined;
}

/**
 * Validate a redirect path (+ optional same-origin query) for internal navigation after login/register.
 */
export function safeRedirectPath(redirectTo: string | null | undefined, fallback = '/app/hub'): string {
  if (!redirectTo) return fallback;
  let target = redirectTo.trim();
  // URLSearchParams already decodes the outer query. Only decode a legacy
  // encoded *whole* path here; decoding its query again corrupts nested URLs.
  try {
    if (/^%2f/i.test(target)) target = decodeURIComponent(target);
    if (/[\s\u0000-\u001f\u007f]/.test(target)) return fallback;
    const boundary = target.search(/[?#]/);
    const rawPath = boundary < 0 ? target : target.slice(0, boundary);
    const suffix = boundary < 0 ? '' : target.slice(boundary);
    const path = decodeURIComponent(rawPath);
    if (/[\s\u0000-\u001f\u007f%\\]/.test(path) || path.includes('//') || path.includes('..')) return fallback;
    const allowed = path.startsWith('/app/') ||
      /^\/(?:invite|persona|posts)\/[a-zA-Z0-9_-]+$/.test(path) ||
      /^\/@[a-zA-Z0-9_-]+$/.test(path);
    return allowed ? path + suffix : fallback;
  } catch {
    return fallback;
  }
}

/** Carry only a validated destination across auth screens. */
export function authPageHref(page: string, redirectTo?: string | null, extras: Record<string, string> = {}): string {
  const params = new URLSearchParams(extras);
  params.set('redirectTo', safeRedirectPath(redirectTo, '/app/place'));
  return `${page}?${params.toString()}`;
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
  if (!origin) return undefined;
  try {
    const callback = new URL('/auth/callback', origin);
    callback.searchParams.set('redirectTo', safeRedirectPath(raw, '/app/place'));
    return callback.href;
  } catch {
    return undefined;
  }
}
