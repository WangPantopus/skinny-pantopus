'use client';

import type { PageRevision } from './types';

interface RevisionDrawerProps {
  revisions: PageRevision[];
  publishedRevision: number;
  onClose: () => void;
}

export default function RevisionDrawer({ revisions, publishedRevision, onClose }: RevisionDrawerProps) {
  return (
    <div className="absolute top-0 right-0 w-72 h-full bg-app-surface border-l border-app-border shadow-xl z-30 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
        <div className="text-sm font-semibold text-app-text">Revision History</div>
        <button onClick={onClose} className="text-app-text-muted hover:text-app-text-secondary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {revisions.length === 0 ? (
          <div className="p-4 text-sm text-app-text-muted text-center">No published revisions yet.</div>
        ) : (
          <div className="divide-y divide-app-border-subtle">
            {revisions.map((rev) => (
              <div key={rev.id} className={`px-4 py-3 ${rev.revision === publishedRevision ? 'bg-green-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-app-text">v{rev.revision}</span>
                  {rev.revision === publishedRevision && (
                    <span className="text-[9px] font-semibold text-green-700 bg-green-100 rounded-full px-1.5 py-0.5">Current</span>
                  )}
                </div>
                <div className="text-xs text-app-text-secondary mt-0.5">
                  {rev.published_at ? new Date(rev.published_at).toLocaleString() : ''}
                </div>
                {rev.publisher && (
                  <div className="text-[10px] text-app-text-muted mt-0.5">
                    by {rev.publisher.name || rev.publisher.username}
                  </div>
                )}
                {rev.notes && (
                  <div className="text-xs text-app-text-secondary mt-1 italic">{rev.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
