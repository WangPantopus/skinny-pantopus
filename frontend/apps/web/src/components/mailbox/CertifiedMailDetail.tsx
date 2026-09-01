'use client';

import type { AuditEvent, CertifiedMail } from '@/types/mailbox';
import AuditTrailTimeline from './AuditTrailTimeline';

type CertifiedMailDetailProps = {
  item: CertifiedMail;
  currentUserId: string;
  /** The intended recipient's user ID (from wrapper.recipient_user_id) */
  recipientUserId?: string;
  /** The intended recipient's display name */
  recipientName?: string;
  auditTrail: AuditEvent[];
  proofPdfUrl?: string;
  onAcknowledge: () => void;
  acknowledging?: boolean;
  acknowledged?: boolean;
};

export default function CertifiedMailDetail({
  item,
  currentUserId,
  recipientUserId,
  recipientName,
  auditTrail,
  proofPdfUrl,
  onAcknowledge,
  acknowledging,
  acknowledged,
}: CertifiedMailDetailProps) {
  const isIntendedRecipient = !recipientUserId || currentUserId === recipientUserId;
  const isAcknowledged = acknowledged || !!item.acknowledged_at;

  return (
    <div className="mx-6 my-4 border border-indigo-200 dark:border-indigo-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
          Certified Mail
        </span>
        {isAcknowledged && (
          <span className="ml-auto px-2 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full">
            Acknowledged
          </span>
        )}
      </div>

      {/* Acknowledge section */}
      {!isAcknowledged && (
        <div className="px-4 py-4 border-b border-indigo-100 dark:border-indigo-900/30">
          {isIntendedRecipient ? (
            <>
              <p className="text-sm text-app-text-strong mb-3">
                This certified mail requires your acknowledgment to confirm receipt.
              </p>
              <button
                type="button"
                onClick={onAcknowledge}
                disabled={acknowledging}
                className={`w-full py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  acknowledging
                    ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {acknowledging ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
                    Acknowledging...
                  </span>
                ) : (
                  'Acknowledge Receipt'
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-7V9m0 0V7m0 2h2m-2 0H10" />
              </svg>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                This item requires acknowledgment by{' '}
                <span className="font-semibold">{recipientName || 'the intended recipient'}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Audit trail */}
      {(isAcknowledged || auditTrail.length > 0) && (
        <div className="px-4 py-4">
          <AuditTrailTimeline
            events={auditTrail}
            proofPdfUrl={proofPdfUrl}
          />
        </div>
      )}
    </div>
  );
}
