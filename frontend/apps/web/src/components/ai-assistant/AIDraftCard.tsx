'use client';

import { useRouter } from 'next/navigation';
import {
  Briefcase,
  ShoppingBag,
  MessageSquare,
  Mail,
  DollarSign,
  Clock,
  Tag,
  Sparkles,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  FileText,
  CreditCard,
  Bell,
  FolderOpen,
  Share2,
} from 'lucide-react';
import type {
  AIChatDraft,
  GigDraft,
  ListingDraft,
  PostDraft,
  MailSummary,
} from '@pantopus/types';

interface AIDraftCardProps {
  draft: AIChatDraft;
}

export function AIDraftCard({ draft }: AIDraftCardProps) {
  switch (draft.type) {
    case 'gig':
      return <GigDraftCard draft={draft.draft as GigDraft} />;
    case 'listing':
      return <ListingDraftCard draft={draft.draft as ListingDraft} />;
    case 'post':
      return <PostDraftCard draft={draft.draft as PostDraft} />;
    case 'mail_summary':
      return <MailSummaryCard summary={draft.draft as MailSummary} />;
    default:
      return null;
  }
}

// ─── Gig Draft Card ──────────────────────────────────────────

function GigDraftCard({ draft }: { draft: GigDraft }) {
  const router = useRouter();

  const handleEdit = () => {
    const params = new URLSearchParams();
    params.set(
      'prefill',
      JSON.stringify({
        title: draft.title,
        description: draft.description,
        category: draft.category,
        price: draft.price,
        tags: draft.tags,
        is_urgent: draft.is_urgent,
      })
    );
    router.push(`/app/gigs/new?${params.toString()}`);
  };

  return (
    <div className="w-full rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2 bg-violet-100/50 border-b border-violet-100">
        <Briefcase className="w-3.5 h-3.5 text-violet-600" />
        <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
          Gig Draft
        </span>
        <Sparkles className="w-3 h-3 text-violet-400 ml-auto" />
      </div>

      {/* Body */}
      <div className="px-3.5 py-3 space-y-2">
        <h4 className="font-semibold text-gray-900 text-sm leading-snug">
          {draft.title}
        </h4>
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
          {draft.description}
        </p>

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {draft.price != null && (
            <Chip icon={<DollarSign className="w-3 h-3" />} label={`$${draft.price}`} />
          )}
          {draft.category && (
            <Chip icon={<Tag className="w-3 h-3" />} label={draft.category} />
          )}
          {draft.schedule_type && (
            <Chip
              icon={<Clock className="w-3 h-3" />}
              label={
                draft.schedule_type === 'asap'
                  ? '⚡ ASAP'
                  : draft.schedule_type === 'today'
                  ? '📅 Today'
                  : draft.schedule_type === 'scheduled'
                  ? '🗓️ Scheduled'
                  : '🕒 Flexible'
              }
            />
          )}
          {draft.is_urgent && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-medium">
              Urgent
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t border-violet-100">
        <button
          onClick={handleEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Edit &amp; Post as Gig
        </button>
      </div>
    </div>
  );
}

// ─── Listing Draft Card ──────────────────────────────────────

function ListingDraftCard({ draft }: { draft: ListingDraft }) {
  // Copy to clipboard for manual form fill (CreateListingModal is a modal, so deep-linking is complex)
  const handleUse = () => {
    // Store in sessionStorage so the modal can pick it up
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ai_listing_draft', JSON.stringify(draft));
      // Dispatch a custom event so the marketplace page knows to open the modal
      window.dispatchEvent(new CustomEvent('ai:open-listing-modal', { detail: draft }));
    }
  };

  return (
    <div className="w-full rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-100/50 border-b border-emerald-100">
        <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
          Listing Draft
        </span>
        <Sparkles className="w-3 h-3 text-emerald-400 ml-auto" />
      </div>

      <div className="px-3.5 py-3 space-y-2">
        <h4 className="font-semibold text-gray-900 text-sm leading-snug">
          {draft.title}
        </h4>
        {draft.description && (
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
            {draft.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 pt-1">
          {draft.isFree ? (
            <Chip icon={<DollarSign className="w-3 h-3" />} label="Free" color="green" />
          ) : draft.price != null ? (
            <Chip icon={<DollarSign className="w-3 h-3" />} label={`$${draft.price}`} />
          ) : null}
          {draft.category && (
            <Chip icon={<Tag className="w-3 h-3" />} label={draft.category} />
          )}
          {draft.condition && (
            <Chip label={draft.condition.replace('_', ' ')} />
          )}
        </div>
      </div>

      <div className="flex border-t border-emerald-100">
        <button
          onClick={handleUse}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Create Listing
        </button>
      </div>
    </div>
  );
}

// ─── Post Draft Card ─────────────────────────────────────────

function PostDraftCard({ draft }: { draft: PostDraft }) {
  const handleUse = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ai_post_draft', JSON.stringify(draft));
      window.dispatchEvent(new CustomEvent('ai:open-post-composer', { detail: draft }));
    }
  };

  return (
    <div className="w-full rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2 bg-blue-100/50 border-b border-blue-100">
        <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
          Post Draft
        </span>
        <Sparkles className="w-3 h-3 text-blue-400 ml-auto" />
      </div>

      <div className="px-3.5 py-3 space-y-2">
        {draft.title && (
          <h4 className="font-semibold text-gray-900 text-sm leading-snug">
            {draft.title}
          </h4>
        )}
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">
          {draft.content}
        </p>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {draft.purpose && (
            <Chip label={draft.purpose} />
          )}
          {draft.visibility && (
            <Chip label={`📍 ${draft.visibility}`} />
          )}
          {draft.postType && draft.postType !== 'general' && (
            <Chip label={draft.postType.replace(/_/g, ' ')} />
          )}
        </div>
      </div>

      <div className="flex border-t border-blue-100">
        <button
          onClick={handleUse}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Create Post
        </button>
      </div>
    </div>
  );
}

// ─── Mail Summary Card ───────────────────────────────────────

function MailSummaryCard({ summary }: { summary: MailSummary }) {
  const urgencyColors = {
    none: 'bg-gray-100 text-gray-600',
    due_soon: 'bg-amber-100 text-amber-700',
    overdue: 'bg-red-100 text-red-700',
    time_sensitive: 'bg-orange-100 text-orange-700',
  };

  const actionIcons: Record<string, React.ReactNode> = {
    pay: <CreditCard className="w-3 h-3" />,
    remind: <Bell className="w-3 h-3" />,
    file: <FolderOpen className="w-3 h-3" />,
    create_task: <CheckCircle className="w-3 h-3" />,
    acknowledge: <FileText className="w-3 h-3" />,
    dispute: <AlertTriangle className="w-3 h-3" />,
    share_household: <Share2 className="w-3 h-3" />,
  };

  return (
    <div className="w-full rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/80 to-white overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2 bg-amber-100/50 border-b border-amber-100">
        <Mail className="w-3.5 h-3.5 text-amber-600" />
        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
          Mail Summary
        </span>
        <span
          className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium ${
            urgencyColors[summary.urgency] || urgencyColors.none
          }`}
        >
          {summary.urgency === 'none' ? 'No urgency' : summary.urgency.replace('_', ' ')}
        </span>
      </div>

      <div className="px-3.5 py-3 space-y-3">
        <p className="text-sm text-gray-800 leading-relaxed">
          {summary.summary}
        </p>

        {/* Key facts */}
        {summary.key_facts?.length > 0 && (
          <div className="space-y-1">
            {summary.key_facts.map((fact, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 font-medium min-w-[80px]">
                  {fact.field}:
                </span>
                <span className="text-gray-800">{fact.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recommended actions */}
        {summary.recommended_actions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {summary.recommended_actions.map((action, i) => (
              <button
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-xs font-medium text-amber-800 hover:bg-amber-50 transition-colors"
                title={action.reason}
              >
                {actionIcons[action.type] || <CheckCircle className="w-3 h-3" />}
                {action.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared Chip Component ───────────────────────────────────

function Chip({
  icon,
  label,
  color,
}: {
  icon?: React.ReactNode;
  label: string;
  color?: 'green';
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
        color === 'green'
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-600'
      }`}
    >
      {icon}
      {label}
    </span>
  );
}
