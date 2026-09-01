'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { payments } from '@pantopus/api';
const { retryAuthorization } = payments;

interface AuthorizationRetryBannerProps {
  gigId: string;
  /** Called when retry returns a clientSecret for on-session SCA completion. */
  onRetryClientSecret: (clientSecret: string) => void;
  /** Optional: called when retry is fully successful (no SCA needed). */
  onRetrySuccess?: () => void;
}

/**
 * Banner displayed when payment authorization failed (off-session SCA).
 * Provides a retry CTA that triggers an on-session authorization flow.
 */
export default function AuthorizationRetryBanner({
  gigId,
  onRetryClientSecret,
  onRetrySuccess,
}: AuthorizationRetryBannerProps) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setError(null);

    try {
      const result = await retryAuthorization(gigId);

      if (result.clientSecret) {
        // Need on-session confirmation (SCA)
        onRetryClientSecret(result.clientSecret);
      } else {
        // Auth succeeded without SCA
        onRetrySuccess?.();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retry authorization.';
      setError(message);
    } finally {
      setRetrying(false);
    }
  }, [gigId, onRetryClientSecret, onRetrySuccess]);

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="text-red-500 flex-shrink-0"><AlertTriangle className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-red-800 text-sm">Payment Authorization Failed</h4>
          <p className="text-sm text-red-700 mt-1">
            Your bank requires additional verification to authorize this payment.
            The worker cannot start until payment is authorized.
          </p>

          {error && (
            <p className="text-sm text-red-600 mt-2 bg-red-100 rounded p-2">
              {error}
            </p>
          )}

          <button
            onClick={handleRetry}
            disabled={retrying}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {retrying ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Retrying...
              </span>
            ) : (
              'Retry Payment Authorization'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
