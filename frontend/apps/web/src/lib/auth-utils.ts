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
  OAUTH_NONCE_PARAM,
  oauthRedirectParamForWeb,
} from '@pantopus/ui-utils';
