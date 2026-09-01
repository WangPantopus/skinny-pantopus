import Link from 'next/link';
import { Star } from 'lucide-react';
import { formatTimeAgo as timeAgo } from '@pantopus/ui-utils';
import type { MailItem } from './mailbox-types';
import { MAIL_TYPES, PRIORITY_COLORS } from './mailbox-constants';

interface MailListItemProps {
  item: MailItem;
  isSelected: boolean;
  detailQuery: string;
  onClick: (item: MailItem) => void;
  onStar: (e: React.MouseEvent, item: MailItem) => void;
  getSenderName: (item: MailItem) => string;
  getDisplayTitle: (item: MailItem) => string;
  getPreviewText: (item: MailItem) => string;
  getDeliverableMeta: (item: MailItem) => { label: string; color: string };
  getPrimaryActionLabel: (item: MailItem) => string;
}

export default function MailListItem({
  item, isSelected, detailQuery, onClick, onStar,
  getSenderName, getDisplayTitle, getPreviewText, getDeliverableMeta, getPrimaryActionLabel,
}: MailListItemProps) {
  const typeInfo = MAIL_TYPES[item.type] || MAIL_TYPES.other;
  const deliverableMeta = getDeliverableMeta(item);
  const priorityBorder = PRIORITY_COLORS[item.priority] || '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(item); }
      }}
      className={`w-full text-left px-4 py-3 rounded-lg border transition group cursor-pointer ${
        isSelected
          ? 'bg-blue-50 border-blue-200'
          : !item.viewed
            ? 'bg-app-surface border-app-border hover:border-app-border hover:shadow-sm'
            : 'bg-app-surface-raised/50 border-app-border-subtle hover:bg-app-hover'
      } ${priorityBorder ? `border-l-4 ${priorityBorder}` : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0 mt-0.5">{typeInfo.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${!item.viewed ? 'font-semibold text-app-text' : 'font-medium text-app-text-strong'}`}>
              {getSenderName(item)}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-app-text-muted whitespace-nowrap">{timeAgo(item.created_at)}</span>
              <Link
                href={detailQuery ? `/app/mailbox/${item.id}?${detailQuery}` : `/app/mailbox/${item.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border border-app-border text-app-text-secondary bg-app-surface hover:bg-app-hover transition"
              >
                {getPrimaryActionLabel(item)}
              </Link>
            </div>
          </div>
          <p className={`text-sm truncate mt-0.5 ${!item.viewed ? 'text-app-text' : 'text-app-text-secondary'}`}>
            {getDisplayTitle(item)}
          </p>
          <p className="text-xs text-app-text-muted truncate mt-0.5">
            {getPreviewText(item).slice(0, 120)}
          </p>
        </div>
        <button
          onClick={(e) => onStar(e, item)}
          className="flex-shrink-0 p-1 opacity-0 group-hover:opacity-100 transition"
          title={item.starred ? 'Unstar' : 'Star'}
        >
          <Star className={`w-4 h-4 ${item.starred ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 ml-8">
        <span className={`inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded ${deliverableMeta.color}`}>
          {deliverableMeta.label}
        </span>
        {item.payout_amount && item.payout_amount > 0 && (
          <span className="inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded bg-green-100 text-green-700">
            +${item.payout_amount.toFixed(2)}
          </span>
        )}
        {item.priority === 'urgent' && (
          <span className="inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded bg-red-100 text-red-700">
            Urgent
          </span>
        )}
        {item.action_required && (
          <span className="inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded bg-amber-100 text-amber-700">
            Action Needed
          </span>
        )}
        {!item.viewed && (
          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
        )}
      </div>
    </div>
  );
}
