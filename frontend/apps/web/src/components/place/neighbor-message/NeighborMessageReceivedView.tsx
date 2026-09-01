// ============================================================
// Neighbor message · received (W2.6) — presentational.
//
// The web mirror of place-message-received.jsx. The receiving side of a
// verified-neighbor message: no identity is shown ("a verified neighbor
// nearby"); the body is the same neutral template the sender picked.
// Replies are templated and stay anonymous both ways. Feedback, block, and
// report are calm, in-control, and never notify the sender.
//
// Pure + presentational: the container owns the fetch and the mutations.
// Tokens only — home-green accent, sky CTAs.
// ============================================================

'use client';

import {
  ShieldCheck,
  EyeOff,
  Check,
  ThumbsDown,
  Ban,
  Flag,
  Shield,
  ChevronRight,
} from 'lucide-react';
import type { ReceivedNeighborMessage, NeighborReplyTemplate } from '@pantopus/api';
import { DetailHeader, DetailSectionLabel } from '@/components/archetypes/place';
import Chip from '@/components/archetypes/primitives/Chip';

export interface ManageFlags {
  notHelpful: boolean;
  blocked: boolean;
  reported: boolean;
}

export interface NeighborMessageReceivedViewProps {
  message: ReceivedNeighborMessage;
  replies: NeighborReplyTemplate[];
  onReply: (replyTemplateId: string) => void;
  onChangeReply: () => void;
  onNotHelpful: () => void;
  onBlock: () => void;
  onReport: () => void;
  replying: boolean;
  flags: ManageFlags;
  /** Local edit toggle: re-show the quick-reply bar over an existing reply. */
  editingReply: boolean;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'just now';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

// ── Anonymized sender row — verified, never named ──
function AnonSender({ time }: { time: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-11 h-11 rounded-full bg-app-surface-sunken border border-app-border flex items-center justify-center shrink-0 text-app-home">
        <ShieldCheck size={23} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-app-text -tracking-[0.012em]">From a verified neighbor nearby</div>
        <div className="text-[12.5px] text-app-text-muted mt-px">On your block · {time}</div>
      </div>
      <Chip label="Verified" variant="success" icon={ShieldCheck} />
    </div>
  );
}

function ReceivedCard({ message }: { message: ReceivedNeighborMessage }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[17px]">
      <AnonSender time={relativeTime(message.created_at)} />
      <div className="text-base leading-6 text-app-text mt-4">{message.body}</div>
      <div className="flex items-start gap-2 mt-4 pt-3.5 border-t border-app-border-subtle text-[12.5px] text-app-text-muted leading-[17px]">
        <EyeOff size={14} strokeWidth={2} className="mt-px shrink-0" />
        <span>
          They chose this from a set of pre-written notes — they can&apos;t type freely, and they don&apos;t know who you
          are either.
        </span>
      </div>
    </div>
  );
}

function QuickReplyBar({
  replies,
  onReply,
  replying,
}: {
  replies: NeighborReplyTemplate[];
  onReply: (id: string) => void;
  replying: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {replies.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={replying}
            onClick={() => onReply(r.id)}
            className="text-sm font-semibold text-primary-600 bg-app-info-bg border border-app-info-light rounded-full px-3.5 py-2 whitespace-nowrap hover:bg-app-info-light/40 disabled:opacity-60 transition-colors"
          >
            {r.body}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2.5 px-0.5 text-[12.5px] text-app-text-muted">
        <EyeOff size={13} strokeWidth={2} />
        Replies are templated and stay anonymous.
      </div>
    </div>
  );
}

function ReplySent({ body, onChange }: { body: string; onChange: () => void }) {
  return (
    <div className="bg-app-success-bg border border-app-success-light rounded-2xl shadow-sm p-3.5">
      <div className="flex items-center gap-3">
        <span className="w-[34px] h-[34px] rounded-[9px] bg-app-home-bg border border-app-success-light flex items-center justify-center shrink-0 text-app-home">
          <Check size={19} strokeWidth={2.75} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-semibold text-app-text">Reply sent</div>
          <div className="text-[13px] text-app-text-secondary mt-px">&ldquo;{body}&rdquo;</div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-app-success-light">
        <span className="text-[12.5px] text-app-home inline-flex items-center gap-1.5">
          <EyeOff size={13} strokeWidth={2} /> Delivered anonymously
        </span>
        <button
          type="button"
          onClick={onChange}
          className="text-[13.5px] font-semibold text-primary-600 hover:text-primary-700 transition-colors"
        >
          Change reply
        </button>
      </div>
    </div>
  );
}

interface ManageRowConfig {
  key: keyof ManageFlags;
  icon: typeof ThumbsDown;
  tone: 'neutral' | 'danger';
  title: string;
  sub: string;
  doneTitle: string;
  onClick: () => void;
}

function ManageRow({ config, done, isLast }: { config: ManageRowConfig; done: boolean; isLast: boolean }) {
  const danger = config.tone === 'danger';
  const fg = danger ? 'text-app-error' : 'text-app-text-secondary';
  const tile = danger ? 'bg-app-error-bg border-app-error-light text-app-error' : 'bg-app-surface-sunken border-app-border text-app-text-muted';
  return (
    <button
      type="button"
      disabled={done}
      onClick={config.onClick}
      className={`w-full text-left flex items-center gap-3 px-3.5 py-3 transition-colors disabled:cursor-default hover:bg-app-hover disabled:hover:bg-transparent ${
        isLast ? '' : 'border-b border-app-border-subtle'
      }`}
    >
      <span className={`w-[34px] h-[34px] rounded-[9px] border flex items-center justify-center shrink-0 ${tile}`}>
        {done ? <Check size={18} strokeWidth={2.25} /> : <config.icon size={18} strokeWidth={2} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-[14.5px] font-semibold ${done ? 'text-app-text-muted' : fg}`}>
          {done ? config.doneTitle : config.title}
        </div>
        {!done ? <div className="text-[12.5px] text-app-text-muted leading-[17px] mt-px">{config.sub}</div> : null}
      </div>
      {!done ? <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-app-text-muted" /> : null}
    </button>
  );
}

export default function NeighborMessageReceivedView({
  message,
  replies,
  onReply,
  onChangeReply,
  onNotHelpful,
  onBlock,
  onReport,
  replying,
  flags,
  editingReply,
}: NeighborMessageReceivedViewProps) {
  const hasReply = !!message.reply && !editingReply;
  const canReply = message.can_reply && !flags.blocked;

  const manageRows: ManageRowConfig[] = [
    {
      key: 'notHelpful',
      icon: ThumbsDown,
      tone: 'neutral',
      title: "This isn't helpful",
      sub: "Tell us this note wasn't useful. The sender won't be told.",
      doneTitle: 'Thanks for the feedback',
      onClick: onNotHelpful,
    },
    {
      key: 'blocked',
      icon: Ban,
      tone: 'neutral',
      title: 'Block this neighbor',
      sub: "Stop messages from this verified home. They won't be notified.",
      doneTitle: 'Neighbor blocked',
      onClick: onBlock,
    },
    {
      key: 'reported',
      icon: Flag,
      tone: 'danger',
      title: 'Report this message',
      sub: 'Flag it for the Pantopus trust team to review.',
      doneTitle: 'Reported to the trust team',
      onClick: onReport,
    },
  ];

  return (
    <div>
      <DetailHeader title="Message" address="Inbox · verified neighbors" backHref="/app/place" />

      <div className="px-4 sm:px-5 pt-2 pb-10">
        <ReceivedCard message={message} />

        <DetailSectionLabel>Reply</DetailSectionLabel>
        {hasReply ? (
          <ReplySent body={message.reply!.body} onChange={onChangeReply} />
        ) : canReply ? (
          <QuickReplyBar replies={replies} onReply={onReply} replying={replying} />
        ) : (
          <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl border bg-app-surface border-app-border text-[12.5px] text-app-text-muted leading-[18px]">
            <Ban size={14} strokeWidth={2} className="mt-px shrink-0" />
            <span>Replies are off for this neighbor.</span>
          </div>
        )}

        <DetailSectionLabel>Manage this message</DetailSectionLabel>
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
          {manageRows.map((row, i) => (
            <ManageRow key={row.key} config={row} done={flags[row.key]} isLast={i === manageRows.length - 1} />
          ))}
        </div>

        <div className="flex items-start gap-2 mt-3.5 px-0.5 text-[12.5px] text-app-text-muted leading-[18px]">
          <Shield size={14} strokeWidth={2} className="mt-px shrink-0" />
          <span>
            You&apos;re in control. This neighbor doesn&apos;t know who you are, and you can stop messages from them at
            any time.
          </span>
        </div>
      </div>
    </div>
  );
}
