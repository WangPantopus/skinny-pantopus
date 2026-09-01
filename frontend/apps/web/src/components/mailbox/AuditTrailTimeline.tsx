'use client';

import type { AuditEvent } from '@/types/mailbox';

type AuditTrailTimelineProps = {
  events: AuditEvent[];
  proofPdfUrl?: string;
};

export default function AuditTrailTimeline({
  events,
  proofPdfUrl,
}: AuditTrailTimelineProps) {
  if (events.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-3">
        Audit Trail
      </h3>

      <ol className="relative border-l-2 border-app-border ml-2">
        {events.map((event, i) => {
          const isLast = i === events.length - 1;
          return (
            <li key={i} className="mb-4 last:mb-0 ml-4">
              {/* Timeline dot */}
              <div className={`absolute -left-[9px] mt-1 w-4 h-4 rounded-full border-2 border-white ${
                isLast ? 'bg-green-500' : 'bg-gray-300'
              }`} />

              <div>
                <p className="text-sm font-medium text-app-text">
                  {event.event}
                </p>
                {event.actor_id && (
                  <p className="text-xs text-app-text-secondary mt-0.5">{event.actor_id}</p>
                )}
                <p className="text-xs text-app-text-muted mt-0.5">
                  {new Date(event.timestamp).toLocaleString()}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Proof PDF download */}
      {proofPdfUrl && (
        <a
          href={proofPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Proof PDF
        </a>
      )}
    </div>
  );
}
