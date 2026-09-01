// ============================================================
// MailboxItemDetailArchetype — spec A17 for web.
//
// Layout:
//   · 4px category accent strip across the top of the container
//   · Sender panel (avatar + name + meta, optional stamp)
//   · AI elf card (contextual suggestion + action chips)
//   · Optional hero (coupon barcode, booklet page, …)
//   · Body (category-specific)
//   · KeyFactsPanel (sunken)
//   · Timeline (tracking / chain-of-custody)
//   · Confirm-gate checkbox (gates the primary CTA)
//   · StickyFooter with primary + optional secondary
//
// Two-column on wide screens when `rail` is provided.
// ============================================================

'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Award,
  Check,
  HelpCircle,
  Link2,
  MoreHorizontal,
  ShieldCheck,
  Share2,
  Sparkles,
  Stamp,
  AlertCircle,
} from 'lucide-react';
import {
  Chip,
  type ChipVariant,
  KeyFactsPanel,
  type KeyFact,
  Overline,
  StickyFooter,
  type StickyFooterProps,
} from '../primitives';

export type MailboxCategory =
  | 'package'
  | 'coupon'
  | 'booklet'
  | 'certified'
  | 'community'
  | 'memory'
  | 'gig'
  | 'party'
  | 'records'
  | 'stamps'
  | 'translation'
  | 'unboxing'
  | 'tasks'
  | 'vault';

export type MailboxTrustLevel = 'verified' | 'partial' | 'unverified' | 'chain';

export interface MailboxTimelineStep {
  label: ReactNode;
  caption?: ReactNode;
  state: 'done' | 'current' | 'upcoming';
}

export interface MailboxSender {
  name: string;
  avatarUrl?: string | null;
  meta?: string;
  stamp?: boolean;
}

export interface MailboxAIElf {
  title: string;
  body: ReactNode;
  actionChips?: Array<{ key: string; label: string; onClick: () => void }>;
}

export interface MailboxItemDetailArchetypeProps {
  category: MailboxCategory;
  trustLevel?: MailboxTrustLevel;
  title?: ReactNode;
  sender?: MailboxSender;
  aiElf?: MailboxAIElf;
  hero?: ReactNode;
  body?: ReactNode;
  keyFacts?: KeyFact[];
  timeline?: MailboxTimelineStep[];
  confirmGate?: { label: ReactNode; defaultChecked?: boolean; onChange?: (v: boolean) => void };
  primaryCta?: StickyFooterProps;
  rail?: ReactNode;
  onShareClick?: () => void;
  onOverflowClick?: () => void;
  className?: string;
}

const CATEGORY_ACCENT: Record<MailboxCategory, string> = {
  package: 'var(--app-text-secondary)',
  coupon: 'var(--color-warning)',
  booklet: 'var(--color-primary-400)',
  certified: 'var(--color-primary-600)',
  community: 'var(--color-identity-home)',
  memory: '#ec4899', // accent.pink
  gig: '#f97316', // accent.orange
  party: 'var(--color-identity-business)',
  records: 'var(--app-text-strong)',
  stamps: '#10b981', // accent.emerald
  translation: '#0d9488', // accent.teal
  unboxing: '#8b5cf6', // accent.violet
  tasks: 'var(--color-primary-600)',
  vault: 'var(--app-text)',
};

const CATEGORY_LABEL: Record<MailboxCategory, string> = {
  package: 'Package',
  coupon: 'Coupon',
  booklet: 'Booklet',
  certified: 'Certified mail',
  community: 'Community notice',
  memory: 'Memory',
  gig: 'Gig',
  party: 'Mail party',
  records: 'Records',
  stamps: 'Stamps',
  translation: 'Translation',
  unboxing: 'Unboxing',
  tasks: 'Mail task',
  vault: 'Vault item',
};

type TrustStyle = { label: string; variant: ChipVariant; icon: LucideIcon };
const TRUST: Record<MailboxTrustLevel, TrustStyle> = {
  verified: { label: 'Verified', variant: 'success', icon: ShieldCheck },
  partial: { label: 'Partial', variant: 'warning', icon: AlertCircle },
  unverified: { label: 'Unverified', variant: 'neutral', icon: HelpCircle },
  chain: { label: 'Chain of custody', variant: 'info', icon: Link2 },
};

export default function MailboxItemDetailArchetype({
  category,
  trustLevel = 'verified',
  title,
  sender,
  aiElf,
  hero,
  body,
  keyFacts,
  timeline,
  confirmGate,
  primaryCta,
  rail,
  onShareClick,
  onOverflowClick,
  className = '',
}: MailboxItemDetailArchetypeProps) {
  const [confirmed, setConfirmed] = useState(confirmGate?.defaultChecked ?? false);
  const trust = TRUST[trustLevel];
  const accent = CATEGORY_ACCENT[category];
  const headingTitle = title ?? CATEGORY_LABEL[category];

  const cta = primaryCta && confirmGate
    ? { ...primaryCta, primaryDisabled: primaryCta.primaryDisabled || !confirmed }
    : primaryCta;

  const contentColumn = (
    <>
      {/* Top row: title + actions */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-lg font-semibold text-app-text truncate">{headingTitle}</h1>
          <Chip label={CATEGORY_LABEL[category]} variant="neutral" />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onShareClick ? (
            <button
              type="button"
              onClick={onShareClick}
              aria-label="Share"
              className="w-9 h-9 rounded-md flex items-center justify-center text-app-text hover:bg-app-hover"
            >
              <Share2 size={18} />
            </button>
          ) : null}
          {onOverflowClick ? (
            <button
              type="button"
              onClick={onOverflowClick}
              aria-label="More"
              className="w-9 h-9 rounded-md flex items-center justify-center text-app-text hover:bg-app-hover"
            >
              <MoreHorizontal size={18} />
            </button>
          ) : null}
        </div>
      </div>

      {sender ? (
        <div className="flex items-center gap-3 mb-5">
          {sender.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sender.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-primary-600 text-white font-bold text-sm flex items-center justify-center">
              {sender.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-[15px] font-semibold text-app-text truncate">{sender.name}</div>
              <Chip label={trust.label} variant={trust.variant} icon={trust.icon} />
            </div>
            {sender.meta ? <div className="text-xs text-app-text-secondary mt-0.5 truncate">{sender.meta}</div> : null}
          </div>
          {sender.stamp ? (
            <div className="w-11 h-11 rounded-md bg-primary-50 flex items-center justify-center">
              <Award size={22} className="text-primary-600" />
            </div>
          ) : null}
        </div>
      ) : null}

      {aiElf ? (
        <div className="mb-5 rounded-xl border border-primary-200 bg-primary-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center">
              <Sparkles size={13} />
            </div>
            <div className="text-sm font-bold text-primary-800">{aiElf.title}</div>
          </div>
          <p className="text-sm text-primary-900 leading-relaxed">{aiElf.body}</p>
          {aiElf.actionChips && aiElf.actionChips.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {aiElf.actionChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onClick}
                  className="px-3 py-1.5 rounded-full border border-primary-300 bg-app-surface text-xs font-semibold text-primary-800 hover:bg-primary-100 transition"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {hero ? <div className="mb-5">{hero}</div> : null}
      {body ? <div className="mb-5">{body}</div> : null}

      {keyFacts && keyFacts.length > 0 ? (
        <div className="mb-5">
          <Overline className="mb-2">Key facts</Overline>
          <KeyFactsPanel facts={keyFacts} />
        </div>
      ) : null}

      {timeline && timeline.length > 0 ? (
        <div className="mb-5">
          <Overline className="mb-2">Progress</Overline>
          <ol>
            {timeline.map((s, i) => {
              const last = i === timeline.length - 1;
              const dotCls =
                s.state === 'done'
                  ? 'bg-app-success'
                  : s.state === 'current'
                  ? 'bg-primary-600'
                  : 'bg-app-border-strong';
              return (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0 w-4">
                    <span className={`w-3 h-3 rounded-full mt-1 ${dotCls}`} />
                    {last ? null : <span className="flex-1 w-0.5 bg-app-border mt-1" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-4">
                    <div
                      className={`text-sm font-semibold ${s.state === 'upcoming' ? 'text-app-text-muted' : 'text-app-text'}`}
                    >
                      {s.label}
                    </div>
                    {s.caption ? <div className="text-xs text-app-text-secondary mt-0.5">{s.caption}</div> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {confirmGate ? (
        <label className="flex items-start gap-2.5 p-3 rounded-lg bg-app-surface border border-app-border cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => {
              const next = e.target.checked;
              setConfirmed(next);
              confirmGate.onChange?.(next);
            }}
            className="mt-0.5 w-5 h-5 rounded border-[1.5px] border-app-border-strong text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-app-text-strong leading-snug">{confirmGate.label}</span>
          <span className="sr-only">{confirmed ? 'Checked' : 'Unchecked'}</span>
          {/* Unused icon import to satisfy tree-shake; harmless */}
          <Check size={0} className="hidden" />
          <Stamp size={0} className="hidden" />
        </label>
      ) : null}
    </>
  );

  return (
    <div className={className}>
      <div
        className="h-1 -mx-4 sm:-mx-6 lg:-mx-8 mb-4 rounded-full"
        style={{ backgroundColor: accent }}
      />
      {rail ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
          <div className="min-w-0">{contentColumn}</div>
          <aside className="lg:sticky lg:top-4 lg:self-start">{rail}</aside>
        </div>
      ) : (
        contentColumn
      )}
      {cta ? <StickyFooter {...cta} /> : null}
    </div>
  );
}
