'use client';

import { useState, useEffect, useRef } from 'react';
import SlidePanel from './SlidePanel';

const SEVERITIES = [
  { value: 'low', label: 'Low', icon: '🟢' },
  { value: 'medium', label: 'Medium', icon: '🟡' },
  { value: 'high', label: 'High', icon: '🟠' },
  { value: 'urgent', label: 'Urgent', icon: '🔴' },
];

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'canceled', label: 'Canceled' },
];

/** What the member has typed into a new issue: their own text, never the Home's existing records. */
export type IssueDraft = { title: string; description: string; severity: string; estimatedCost: string };

export default function IssueSlidePanel({
  open,
  onClose,
  onSave,
  issue,
  canEdit = true,
  draft,
  onDraftUnmount,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => Promise<void>;
  issue?: Record<string, any>; // null = create, object = edit
  /** false shows an existing issue without edit controls (the viewer can't update issues). */
  canEdit?: boolean;
  /** A new issue's kept draft to start from (create only). */
  draft?: IssueDraft | null;
  /** Receives a new issue's typed draft if the panel unmounts while open (the dashboard's access re-check). */
  onDraftUnmount?: (draft: IssueDraft) => void;
}) {
  const isEdit = !!issue;
  const readOnly = isEdit && !canEdit;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [status, setStatus] = useState('open');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pendingCreate = useRef<{ draft: string; id: string } | null>(null);

  useEffect(() => {
    if (issue) {
      setTitle(issue.title || '');
      setDescription(issue.description || '');
      setSeverity(issue.severity || 'medium');
      setStatus(issue.status || 'open');
      setEstimatedCost(issue.estimated_cost != null ? String(issue.estimated_cost) : '');
    } else {
      setTitle(draft?.title ?? '');
      setDescription(draft?.description ?? '');
      setSeverity(draft?.severity ?? 'medium');
      setStatus('open');
      setEstimatedCost(draft?.estimatedCost ?? '');
    }
    setError('');
    pendingCreate.current = null;
  }, [issue, open, draft]);

  // The last rendered create-mode form, handed back only if the panel unmounts while open.
  const latest = useRef<{ keep: boolean; draft: IssueDraft } | null>(null);
  useEffect(() => {
    latest.current = { keep: open && !issue, draft: { title, description, severity, estimatedCost } };
  });
  useEffect(() => () => {
    if (latest.current?.keep) onDraftUnmount?.(latest.current.draft);
  }, [onDraftUnmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        description: description.trim(),
        severity,
        estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
      };
      if (isEdit) {
        payload.status = status;
        // Send only what changed since the panel opened, so an edit here can't
        // quietly undo another member's change to a field left untouched.
        const opened: Record<string, unknown> = {
          title: (issue?.title || '').trim(),
          description: (issue?.description || '').trim(),
          severity: issue?.severity || 'medium',
          estimated_cost: issue?.estimated_cost != null ? Number(issue.estimated_cost) : null,
          status: issue?.status || 'open',
        };
        for (const field of Object.keys(payload)) {
          if (payload[field] === opened[field]) delete payload[field];
        }
        if (Object.keys(payload).length === 0) {
          onClose();
          return;
        }
      } else {
        const draft = JSON.stringify(payload);
        if (pendingCreate.current?.draft !== draft) {
          pendingCreate.current = { draft, id: crypto.randomUUID() };
        }
        payload.clientRequestId = pendingCreate.current.id;
      }
      await onSave(payload);
      pendingCreate.current = null;
      onClose();
    } catch (err: unknown) {
      // The SDK rejects with a plain { message } object, not an Error; keep the
      // server's reason (e.g. a permission denial) instead of the generic copy.
      const message = err instanceof Error ? err.message
        : typeof (err as { message?: unknown } | null)?.message === 'string' ? (err as { message: string }).message : '';
      setError(message || 'Failed to save issue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={readOnly ? 'Issue' : isEdit ? 'Edit Issue' : 'Report Issue'}
      subtitle={isEdit ? issue?.title : 'Report a maintenance issue or repair need'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
            {error}
          </div>
        )}

        <fieldset disabled={readOnly} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Leaky faucet in kitchen"
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
              maxLength={200}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={4}
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-2">Severity</label>
            <div className="flex gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSeverity(s.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition ${
                    severity === s.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border'
                  }`}
                >
                  <span>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Cost */}
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Estimated Repair Cost ($)</label>
            <input
              type="number"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">Status</label>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStatus(s.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
                      status === s.value
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </fieldset>

        {/* Actions */}
        <div className="flex gap-3 pt-3 border-t border-app-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition"
          >
            Cancel
          </button>
          {!readOnly && (
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : isEdit ? 'Update Issue' : 'Report Issue'}
            </button>
          )}
        </div>
      </form>
    </SlidePanel>
  );
}
