import { ChevronLeft, Archive, Trash2, Star, Paperclip } from 'lucide-react';
import type { MailItem } from './mailbox-types';
import { MAIL_TYPES } from './mailbox-constants';
import MailContentRenderer from './MailContentRenderer';

interface MailDetailProps {
  mail: MailItem;
  detailBodyRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onStar: (e: React.MouseEvent, item: MailItem) => void;
  onArchive: (item: MailItem) => void;
  onDelete: (item: MailItem) => void;
  onScroll: () => void;
  getSenderName: (item: MailItem) => string;
  getDisplayTitle: (item: MailItem) => string;
}

export default function MailDetail({
  mail, detailBodyRef, onClose, onStar, onArchive, onDelete, onScroll,
  getSenderName, getDisplayTitle,
}: MailDetailProps) {
  return (
    <div className="flex-1 bg-app-surface rounded-xl border border-app-border overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-app-border-subtle flex items-center justify-between">
        <button
          onClick={onClose}
          className="sm:hidden p-1 text-app-text-secondary hover:text-app-text-strong"
        >
          <ChevronLeft className="w-4 h-4 inline" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => onStar(e, mail)}
            className="p-1.5 hover:bg-app-hover rounded-lg transition"
            title="Star"
          >
            <Star className={`w-5 h-5 ${mail.starred ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
          </button>
          <button
            onClick={() => onArchive(mail)}
            className="p-1.5 hover:bg-app-hover rounded-lg transition text-app-text-secondary"
            title="Archive"
          >
            <Archive className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDelete(mail)}
            className="p-1.5 hover:bg-app-hover rounded-lg transition text-app-text-secondary"
            title="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        ref={detailBodyRef}
        onScroll={onScroll}
        className="px-6 py-5 max-h-[calc(100vh-260px)] overflow-y-auto"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="text-3xl">{(MAIL_TYPES[mail.type] || MAIL_TYPES.other).icon}</div>
          <div>
            <h2 className="text-lg font-semibold text-app-text">{getDisplayTitle(mail)}</h2>
            <p className="text-sm text-app-text-secondary mt-0.5">
              From: {getSenderName(mail)}
            </p>
            <p className="text-xs text-app-text-muted mt-0.5">
              {new Date(mail.created_at).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
              })}
            </p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {mail.object_id && (
                <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-100 text-blue-700">
                  Object-backed
                </span>
              )}
              {typeof mail.view_count === 'number' && (
                <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-app-surface-sunken text-app-text-strong">
                  Views: {mail.view_count}
                </span>
              )}
              {typeof mail.total_read_time_ms === 'number' && (
                <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-app-surface-sunken text-app-text-strong">
                  Read time: {(mail.total_read_time_ms / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-sm max-w-none text-app-text-strong border-t border-app-border-subtle pt-4">
          <MailContentRenderer content={mail.content} format={mail.content_format} />
        </div>

        {/* Attachments */}
        {mail.attachments && mail.attachments.length > 0 && (
          <div className="mt-6 pt-4 border-t border-app-border-subtle">
            <h4 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Attachments</h4>
            <div className="flex flex-wrap gap-2">
              {mail.attachments.map((att, i) => (
                <a
                  key={i}
                  href={att}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-app-surface-raised border border-app-border rounded-lg text-sm text-app-text-strong hover:bg-app-hover transition"
                >
                  <Paperclip className="w-4 h-4 inline" /> Attachment {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Ad payout info */}
        {mail.type === 'ad' && mail.payout_amount && (
          <div className="mt-6 pt-4 border-t border-app-border-subtle">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">You earned for viewing this ad</p>
                <p className="text-xs text-green-600">Credits added to your balance</p>
              </div>
              <div className="text-xl font-bold text-green-700">+${mail.payout_amount.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
