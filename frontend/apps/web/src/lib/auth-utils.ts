/**
 * Re-export shared auth form utilities for `@/lib/auth-utils` imports.
 */
export {
  readAuthRedirectQuery,
  safeRedirectPath,
  extractApiError,
  extractFieldErrors,
  normalizeEmail,
  oauthRedirectParamForWeb,
} from '@pantopus/ui-utils';
