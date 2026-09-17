// The shared API client rejects with a plain object ({ message, code, statusCode,
// data }), never an Error, so `err instanceof Error` silently discards the share
// API's actual reason and recovery code. Both share screens need the real text;
// the repo has no shared reader for this shape yet (ClaimEvidenceReview keeps a
// private one), so this single-purpose helper is scoped to the share folder.
export interface ShareFailure {
  message: string;
  code: string;
  statusCode: number | null;
  /** True when the response body itself carried an API error envelope. */
  fromApi: boolean;
  /** The share API's passcode challenge flag (403 SHARE_PASSCODE_REQUIRED). */
  requiresPasscode: boolean;
}

export function shareFailure(failure: unknown): ShareFailure {
  const value = (failure && typeof failure === 'object'
    ? failure as { message?: unknown; code?: unknown; statusCode?: unknown; data?: unknown }
    : {});
  const body = (value.data && typeof value.data === 'object'
    ? value.data as { code?: unknown; error?: unknown; requiresPasscode?: unknown } : {});
  const bodyCode = typeof body.code === 'string' ? body.code : '';
  return {
    message: typeof value.message === 'string' ? value.message : '',
    code: bodyCode || (typeof value.code === 'string' ? value.code : ''),
    statusCode: typeof value.statusCode === 'number' ? value.statusCode : null,
    fromApi: Boolean(bodyCode) || typeof body.error === 'string',
    requiresPasscode: body.requiresPasscode === true,
  };
}

/**
 * The API's own copy when the response carried an error envelope; otherwise the
 * caller's fallback, so a transport or proxy failure never shows a raw client
 * string such as "Request failed with status code 500".
 */
export function failureMessage(failure: unknown, fallback: string): string {
  const details = shareFailure(failure);
  return details.fromApi && details.message ? details.message : fallback;
}
