'use client';

/**
 * NoticesTab — Send official notices to units or building, view sent notices
 * with read receipts. Notices are separate objects from private mail.
 */

import { useEffect, useState, useCallback } from 'react';
import * as api from '@pantopus/api';
import type { landlord } from '@pantopus/api';

type Props = {
  homeId: string;
  units: landlord.PropertyUnit[];
};

const NOTICE_TYPES = [
  { value: 'general', label: 'General Notice' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'rule_change', label: 'Rule Change' },
  { value: 'rent_update', label: 'Rent Update' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'move_out', label: 'Move-Out Notice' },
];

// ── Compose form ────────────────────────────────────────────

function ComposeNotice({
  homeId,
  units,
  onSent,
}: {
  homeId: string;
  units: landlord.PropertyUnit[];
  onSent: () => void;
}) {
  const [recipientType, setRecipientType] = useState<'building' | 'unit'>('building');
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [noticeType, setNoticeType] = useState('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.landlord.sendNotice(homeId, {
        recipient_type: recipientType,
        recipient_id: recipientType === 'unit' ? recipientId : null,
        subject: subject.trim(),
        body: body.trim(),
        notice_type: noticeType,
      });
      setSubject('');
      setBody('');
      setRecipientType('building');
      setRecipientId('');
      setNoticeType('general');
      onSent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send notice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5 space-y-4">
      <h4 className="font-semibold text-app-text">New Notice</h4>

      {/* Recipient */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Send to</label>
          <select
            value={recipientType}
            onChange={(e) => setRecipientType(e.target.value as 'building' | 'unit')}
            className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-app-surface"
          >
            <option value="building">Entire Building</option>
            <option value="unit">Specific Unit</option>
          </select>
        </div>

        {recipientType === 'unit' && (
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Unit</label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-app-surface"
            >
              <option value="">Select unit...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Notice type */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-1">Type</label>
        <div className="flex flex-wrap gap-2">
          {NOTICE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setNoticeType(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                noticeType === t.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-1">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Notice subject"
          className="w-full px-4 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Body */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-1">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Write your notice..."
          className="w-full px-4 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSend}
        disabled={!subject.trim() || !body.trim() || loading || (recipientType === 'unit' && !recipientId)}
        className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Sending...' : 'Send Notice'}
      </button>
    </div>
  );
}

// ── Sent notices list ───────────────────────────────────────

function SentNotices({ notices }: { notices: landlord.Notice[] }) {
  if (notices.length === 0) {
    return (
      <p className="text-sm text-app-text-secondary text-center py-6">No notices sent yet.</p>
    );
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="space-y-2">
      {notices.map((notice) => (
        <div key={notice.id} className="rounded-xl border border-app-border bg-app-surface px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-app-text text-sm truncate">{notice.subject}</p>
                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-app-surface-sunken text-app-text-secondary capitalize whitespace-nowrap">
                  {notice.notice_type.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-app-text-secondary line-clamp-2">{notice.body}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-xs text-app-text-muted">{formatDate(notice.created_at)}</span>
              {/* Read receipt */}
              {notice.read_at ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Read
                </span>
              ) : (
                <span className="text-[10px] text-app-text-muted">Unread</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────

export default function NoticesTab({ homeId, units }: Props) {
  const [notices, setNotices] = useState<landlord.Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.landlord.getNotices(homeId);
      setNotices(res.notices || []);
    } catch {
      // Endpoint may not be deployed yet
      setNotices([]);
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  return (
    <div className="space-y-6">
      {/* Compose */}
      <ComposeNotice homeId={homeId} units={units} onSent={loadNotices} />

      {/* Sent notices */}
      <div>
        <h4 className="font-semibold text-app-text mb-3">Sent Notices</h4>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-app-border border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : (
          <SentNotices notices={notices} />
        )}
      </div>
    </div>
  );
}
