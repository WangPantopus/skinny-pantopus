'use client';

import { AlertCircle } from 'lucide-react';
import type { ClaimInfoRequest } from '@pantopus/api';

/**
 * What a Pantopus reviewer asked for (Request info), on My Homes and the claim's upload pages, until the claimant
 * sends a document. The apps show the same note in the claim's waiting room.
 */
export default function ClaimInfoRequestNote({ request, className = '' }: { request: ClaimInfoRequest; className?: string }) {
  const asked = new Date(request.requested_at);
  const day = Number.isNaN(asked.getTime()) ? null : asked.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <div role="status" className={`rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Pantopus needs one more thing</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Note from Pantopus{day ? ` · ${day}` : ''}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-amber-900 dark:text-amber-100">
            {request.note ? `“${request.note}”` : 'A reviewer needs another document before they can finish your claim.'}
          </p>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">Upload what they asked for and the review continues.</p>
        </div>
      </div>
    </div>
  );
}
