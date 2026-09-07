'use strict';
// Keep the destination allowlist aligned with ui-utils/auth-form.ts.
function safeRedirectPath(redirectTo, fallback = '/app/place') {
  if (typeof redirectTo !== 'string' || !redirectTo) return fallback;
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

module.exports = { safeRedirectPath };
