'use client';

import { Siren, PartyPopper, CircleAlert, AlertTriangle, AlertCircle } from 'lucide-react';

const SEVERITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-app-surface-raised text-app-text-secondary border-app-border',
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  open: { text: 'Open', color: 'text-emerald-700' },
  scheduled: { text: 'Scheduled', color: 'text-violet-700' },
  in_progress: { text: 'In Progress', color: 'text-amber-700' },
  resolved: { text: 'Resolved', color: 'text-teal-700' },
  canceled: { text: 'Canceled', color: 'text-app-text-muted' },
};

export default function IssuesList({
  issues,
  onAdd,
  onViewIssue,
}: {
  issues: Record<string, any>[];
  onAdd?: () => void;
  onViewIssue?: (issue: Record<string, any>) => void;
}) {
  const activeIssues = issues.filter((i) => i.status !== 'resolved' && i.status !== 'canceled');
  const resolvedCount = issues.filter((i) => i.status === 'resolved').length;

  return (
    <div className="bg-app-surface rounded-xl border border-app-border shadow-sm">
      <div className="px-5 py-4 border-b border-app-border-subtle flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-app-text">Issues & Repairs</h3>
          <p className="text-xs text-app-text-secondary mt-0.5">
            {activeIssues.length} open · {resolvedCount} resolved
          </p>
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition"
          >
            <Siren className="w-4 h-4 inline mr-1" /> Report
          </button>
        )}
      </div>

      {activeIssues.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="mb-2"><PartyPopper className="w-8 h-8 mx-auto text-app-text-muted" /></div>
          <p className="text-sm text-app-text-secondary">No open issues. Everything&apos;s good!</p>
        </div>
      ) : (
        <div className="divide-y divide-app-border-subtle">
          {activeIssues.map((issue) => {
            const sev = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.medium;
            const st = STATUS_LABEL[issue.status] || STATUS_LABEL.open;
            return (
              <button
                key={issue.id}
                onClick={() => onViewIssue?.(issue)}
                className="w-full text-left px-5 py-3.5 hover:bg-app-hover/50 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="text-lg flex-shrink-0 mt-0.5">
                    {issue.severity === 'urgent' ? <CircleAlert className="w-5 h-5 text-red-500" /> : issue.severity === 'high' ? <AlertTriangle className="w-5 h-5 text-orange-500" /> : <AlertCircle className="w-5 h-5 text-yellow-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-app-text">{issue.title}</span>
                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${sev}`}
                      >
                        {issue.severity}
                      </span>
                    </div>
                    {issue.description && (
                      <p className="text-xs text-app-text-secondary mt-0.5 line-clamp-1">
                        {issue.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-xs font-medium ${st.color}`}>{st.text}</span>
                      {issue.estimated_cost && (
                        <span className="text-xs text-app-text-muted">
                          Est. ${Number(issue.estimated_cost).toFixed(0)}
                        </span>
                      )}
                      <span className="text-xs text-app-text-muted">
                        {new Date(issue.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
