'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { formatTimeAgo as timeAgo } from '@pantopus/ui-utils';
import type { MailItem, DeliverableMeta } from './legacy-detail-types';
import { MAIL_TYPE_ICON, DELIVERABLE_META } from './legacy-detail-constants';
import { getSenderName, getDisplayTitle, resolveDeliverableType, deliveryScopeLabel } from './legacy-detail-utils';

function MailDetailBadges({
  mail,
  deliverableMeta,
  totalLinkedTargets,
  autoLinkedTargets,
}: {
  mail: MailItem;
  deliverableMeta: DeliverableMeta;
  totalLinkedTargets: number;
  autoLinkedTargets: number;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded ${deliverableMeta.badge}`}>
        {deliverableMeta.label}
      </span>
      {mail.action_required && (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700">
          Action Required
        </span>
      )}
      {mail.ack_required && (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-700">
          Certified
        </span>
      )}
      {mail.object_id && (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">
          Object-backed
        </span>
      )}
      {totalLinkedTargets > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-700">
          {totalLinkedTargets} Linked Target{totalLinkedTargets > 1 ? 's' : ''}
        </span>
      )}
      {autoLinkedTargets > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-violet-100 text-violet-700">
          Auto Fanout
        </span>
      )}
    </div>
  );
}

function MailDetailMeta({
  mail,
  scopeLabel,
  addressHomeId,
  homeLabelFor,
}: {
  mail: MailItem;
  scopeLabel: string;
  addressHomeId: string | null;
  homeLabelFor: (id?: string | null) => string;
}) {
  return (
    <>
      <div className="text-sm text-app-text-strong">
        <span className="font-medium">Sender:</span> {getSenderName(mail)}
      </div>
      <div className="text-sm text-app-text-strong">
        <span className="font-medium">Delivered to:</span> {scopeLabel}
        {addressHomeId ? ` • ${homeLabelFor(addressHomeId)}` : ''}
        {mail.attn_label ? ` • Attn: ${mail.attn_label}` : ''}
      </div>
      <div className="text-xs text-app-text-secondary">
        {new Date(mail.created_at).toLocaleString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })}
      </div>
    </>
  );
}

export function MailDetailActionBar({
  mail,
  backHref,
  onStar,
  onArchiveToggle,
  onDelete,
}: {
  mail: MailItem;
  backHref: string;
  onStar: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <PageHeader
      title={getDisplayTitle(mail)}
      subtitle={`${getSenderName(mail)} • ${timeAgo(mail.created_at)}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={backHref}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-app-border text-app-text-strong hover:bg-app-hover"
        >
          Back
        </Link>
        <button
          onClick={onStar}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-app-border text-app-text-strong hover:bg-app-hover"
        >
          <Star className={`w-4 h-4 inline ${mail.starred ? 'fill-amber-400 text-amber-400' : ''}`} /> {mail.starred ? 'Starred' : 'Star'}
        </button>
        <button
          onClick={onArchiveToggle}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-app-border text-app-text-strong hover:bg-app-hover"
        >
          {mail.archived ? 'Move to Inbox' : 'Archive'}
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </PageHeader>
  );
}

export default function MailDetailMetaBar({
  mail,
  homeLabelFor,
}: {
  mail: MailItem;
  homeLabelFor: (id?: string | null) => string;
}) {
  const deliverableType = resolveDeliverableType(mail);
  const deliverableMeta = DELIVERABLE_META[deliverableType] || DELIVERABLE_META.other;
  const scopeLabel = deliveryScopeLabel(mail);
  const addressHomeId = mail.address_home_id || mail.address_id || mail.recipient_home_id || null;
  const totalLinkedTargets = (mail.links || []).length;
  const autoLinkedTargets = (mail.links || []).filter((link) => link.created_by === 'system').length;

  return (
    <div className="px-5 py-4 border-b border-app-border-subtle flex items-start justify-between gap-4">
      <div className="space-y-2 min-w-0">
        <MailDetailBadges
          mail={mail}
          deliverableMeta={deliverableMeta}
          totalLinkedTargets={totalLinkedTargets}
          autoLinkedTargets={autoLinkedTargets}
        />
        <MailDetailMeta
          mail={mail}
          scopeLabel={scopeLabel}
          addressHomeId={addressHomeId}
          homeLabelFor={homeLabelFor}
        />
      </div>
      <div className="text-4xl">{MAIL_TYPE_ICON[mail.type] || MAIL_TYPE_ICON.other}</div>
    </div>
  );
}
