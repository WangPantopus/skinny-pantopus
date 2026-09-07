/**
 * Re-export shared auth form utilities for `@/lib/auth-utils` imports.
 */
export {
  readAuthRedirectQuery,
  authPageHref,
  safeRedirectPath,
  extractApiError,
  extractFieldErrors,
  normalizeEmail,
  oauthRedirectParamForWeb,
} from '@pantopus/ui-utils';
