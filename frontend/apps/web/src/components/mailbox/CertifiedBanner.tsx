'use client';

import type { CertifiedMail } from '@/types/mailbox';
import AuditTrailTimeline from './AuditTrailTimeline';

type CertifiedBannerProps = {
  item: CertifiedMail;
  onAcknowledge?: () => void;
  loading?: boolean;
};

export default function CertifiedBanner({
  item,
  onAcknowledge,
  loading = false,
}: CertifiedBannerProps) {
  const acknowledged = !!item.acknowledged_at;

  return (
    <div className="space-y-3">
      {/* Main banner */}
      {acknowledged ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Acknowledged
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {new Date(item.acknowledged_at!).toLocaleString()}
              {item.acknowledged_by && ` by ${item.acknowledged_by}`}
            </p>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Content blur overlay */}
          <div className="absolute inset-0 bg-app-surface/60 backdrop-blur-sm rounded-lg z-10 flex flex-col items-center justify-center p-4">
            <svg className="w-8 h-8 text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-sm font-semibold text-red-800 dark:text-red-300 text-center">
              Requires your acknowledgment
            </p>
            <p className="text-xs text-app-text-secondary dark:text-app-text-muted text-center mt-1">
              Legally timestamped certified mail
            </p>

            <button
              type="button"
              onClick={onAcknowledge}
              disabled={loading}
              className={`mt-3 px-6 py-2 text-sm font-semibold rounded-md transition-colors ${
                loading
                  ? 'bg-gray-300 text-app-text-secondary cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {loading ? 'Acknowledging...' : 'Acknowledge Receipt'}
            </button>

            {/* Legal disclaimer */}
            <p className="text-[10px] text-app-text-muted mt-2 text-center max-w-xs">
              By acknowledging, you confirm receipt of this certified mail. A legally timestamped record will be created.
            </p>
          </div>

          {/* Blurred content preview behind overlay */}
          <div className="px-4 py-6 bg-app-surface-raised border border-red-200 dark:border-red-800 rounded-lg min-h-[120px] blur-sm select-none" aria-hidden="true">
            <div className="h-3 bg-app-surface-sunken rounded w-3/4 mb-2" />
            <div className="h-3 bg-app-surface-sunken rounded w-1/2 mb-2" />
            <div className="h-3 bg-app-surface-sunken rounded w-2/3" />
          </div>
        </div>
      )}

      {/* Audit trail — shown after acknowledgment */}
      {acknowledged && item.audit_trail.length > 0 && (
        <AuditTrailTimeline events={item.audit_trail} />
      )}
    </div>
  );
}
