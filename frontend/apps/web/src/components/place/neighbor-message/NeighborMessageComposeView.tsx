// ============================================================
// Neighbor message · compose (W2.6) — presentational.
//
// The web mirror of place-message-compose.jsx. The trust-and-safety
// constraints ARE the UI: template-only (no free-text field exists),
// delivered anonymously ("from a verified neighbor nearby"), scoped to a
// verified home on your block, rate-limited, and blockable.
//
// Pure + presentational: every value and handler arrives via props so the
// container owns fetching, the verified gate, and the send. Tokens only —
// home-green accent, sky CTAs; mobile-web-first single column.
// ============================================================

'use client';

import {
  ShieldCheck,
  EyeOff,
  Info,
  Check,
  Send,
  Reply,
  Ban,
  HeartHandshake,
  Clock,
  Home as HomeIcon,
} from 'lucide-react';
import type { NeighborMessageTemplate } from '@pantopus/api';
import { DetailHeader, DetailSectionLabel } from '@/components/archetypes/place';
import Chip from '@/components/archetypes/primitives/Chip';
import { templateIcon } from './icons';

export interface ComposeRecipient {
  /** Display address, e.g. "1425 SE Oak St". */
  address: string;
  /** Block-relative caption, e.g. "Two doors down · on your block". */
  relativeLabel: string;
}

export interface NeighborMessageComposeViewProps {
  templates: NeighborMessageTemplate[];
  recipient: ComposeRecipient | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSend: () => void;
  onChangeRecipient: () => void;
  sending: boolean;
  errorMessage?: string | null;
}

// ── Recipient — an address on your block, never a name ──
function RecipientCard({ recipient, onChange }: { recipient: ComposeRecipient; onChange: () => void }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-3.5 flex items-center gap-3">
      <span className="w-[38px] h-[38px] rounded-[10px] bg-app-home-bg flex items-center justify-center shrink-0 text-app-home">
        <HomeIcon size={20} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em] truncate">{recipient.address}</div>
        <div className="text-[13px] text-app-text-muted mt-px truncate">{recipient.relativeLabel}</div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 px-1 py-1 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
      >
        Change
      </button>
    </div>
  );
}

// ── Privacy reassurance — the core promise, stated plainly ──
function PrivacyNote() {
  return (
    <div className="flex items-start gap-2.5 mt-2 px-3.5 py-3 rounded-xl border bg-app-info-bg border-app-info-light">
      <EyeOff size={18} strokeWidth={2} className="mt-px shrink-0 text-app-info" />
      <div className="text-[13.5px] leading-[19px] text-app-text-strong">
        <b className="font-bold">Your identity stays private.</b> It&apos;s delivered as &ldquo;from a verified neighbor
        nearby&rdquo; — never your name or address.
      </div>
    </div>
  );
}

// ── One pre-written template, selectable (radio) ──
function TemplateRow({
  template,
  selected,
  onSelect,
}: {
  template: NeighborMessageTemplate;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = templateIcon(template.icon);
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      aria-pressed={selected}
      className={`w-full text-left flex items-start gap-3 p-3.5 rounded-2xl shadow-sm transition-colors ${
        selected ? 'bg-app-success-bg border-[1.5px] border-app-success-light' : 'bg-app-surface border border-app-border hover:bg-app-hover'
      }`}
    >
      <span
        className={`w-[22px] h-[22px] rounded-full shrink-0 mt-px flex items-center justify-center ${
          selected ? 'bg-app-home text-white' : 'border-2 border-app-border-strong bg-app-surface'
        }`}
      >
        {selected ? <Check size={13} strokeWidth={3.25} /> : null}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 mb-1">
          <Icon size={14} strokeWidth={2} className={selected ? 'text-app-home' : 'text-app-text-muted'} />
          <span
            className={`text-[11px] font-bold tracking-[0.05em] uppercase ${
              selected ? 'text-app-home' : 'text-app-text-muted'
            }`}
          >
            {template.category}
          </span>
        </span>
        <span className="block text-[13.5px] leading-[18px] text-app-text-secondary">{template.body}</span>
      </span>
    </button>
  );
}

// ── How the recipient receives it — anonymized, with their controls ──
function DeliveryPreview({ body }: { body: string }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[15px]">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-[38px] h-[38px] rounded-full bg-app-surface-sunken border border-app-border flex items-center justify-center shrink-0 text-app-home">
          <ShieldCheck size={20} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-app-text -tracking-[0.01em]">A verified neighbor nearby</div>
          <div className="text-[12.5px] text-app-text-muted mt-px">On your block · just now</div>
        </div>
        <Chip label="Verified" variant="success" icon={ShieldCheck} />
      </div>
      <div className="text-[14px] leading-[20px] text-app-text-secondary px-3 py-3 bg-app-surface-sunken rounded-xl">{body}</div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-app-border-subtle">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-app-text-secondary bg-app-surface-sunken border border-app-border rounded-full px-3 py-1.5">
          <Reply size={14} strokeWidth={2} /> Reply with a note
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-app-error bg-app-error-bg border border-app-error-light rounded-full px-3 py-1.5">
          <Ban size={14} strokeWidth={2} /> Block
        </span>
      </div>
      <div className="text-[12px] text-app-text-muted mt-2.5">They can reply with a template or block you anytime.</div>
    </div>
  );
}

// ── Respectful-use + rate limit + block, in one calm card ──
const SAFETY_ROWS = [
  { icon: HeartHandshake, title: 'Keep it neighborly', sub: 'For genuine heads-ups — not complaints, sales, or anything targeted.' },
  { icon: Clock, title: 'A few messages a week', sub: "There's a gentle limit, so the channel stays low-volume and calm." },
  { icon: Ban, title: 'Always blockable', sub: 'Anyone can block messages from verified neighbors at any time.' },
];

function SafetyCard() {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm px-3.5">
      {SAFETY_ROWS.map((r, i) => (
        <div
          key={r.title}
          className={`flex items-start gap-3 py-3 ${i < SAFETY_ROWS.length - 1 ? 'border-b border-app-border-subtle' : ''}`}
        >
          <r.icon size={18} strokeWidth={2} className="mt-px shrink-0 text-app-text-muted" />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-app-text-secondary">{r.title}</div>
            <div className="text-[12.5px] text-app-text-muted leading-[17px] mt-px">{r.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NeighborMessageComposeView({
  templates,
  recipient,
  selectedId,
  onSelect,
  onSend,
  onChangeRecipient,
  sending,
  errorMessage,
}: NeighborMessageComposeViewProps) {
  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const canSend = !!recipient && !!selected && !sending;

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <div className="flex-1">
        <DetailHeader title="New message" address="To a verified neighbor on your block" />

        <div className="px-4 sm:px-5 pt-1 pb-28">
          <DetailSectionLabel>To</DetailSectionLabel>
          {recipient ? (
            <RecipientCard recipient={recipient} onChange={onChangeRecipient} />
          ) : (
            <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 flex items-start gap-3">
              <span className="w-[38px] h-[38px] rounded-[10px] bg-app-surface-sunken flex items-center justify-center shrink-0 text-app-text-muted">
                <HomeIcon size={20} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-app-text">Choose a neighbor on your block</div>
                <div className="text-[13px] text-app-text-muted mt-0.5 leading-[18px]">
                  Open a home on your block to send it a verified heads-up.
                </div>
                <button
                  type="button"
                  onClick={onChangeRecipient}
                  className="mt-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Back to your block
                </button>
              </div>
            </div>
          )}
          <PrivacyNote />

          <DetailSectionLabel>Choose a note</DetailSectionLabel>
          <div className="flex flex-col gap-2">
            {templates.map((t) => (
              <TemplateRow key={t.id} template={t} selected={t.id === selectedId} onSelect={onSelect} />
            ))}
          </div>
          <div className="flex items-start gap-1.5 mt-2.5 px-0.5 text-[12.5px] text-app-text-muted leading-[17px]">
            <Info size={14} strokeWidth={2} className="mt-px shrink-0" />
            <span>
              Messages are pre-written to keep them neutral. Free typing isn&apos;t available — it&apos;s how we keep this
              channel safe.
            </span>
          </div>

          <DetailSectionLabel>How it&apos;s delivered</DetailSectionLabel>
          <DeliveryPreview body={selected ? selected.body : 'Choose a note above to preview how it arrives.'} />

          <DetailSectionLabel>Good to know</DetailSectionLabel>
          <SafetyCard />

          {errorMessage ? (
            <div className="mt-4 px-3.5 py-3 rounded-xl border bg-app-error-bg border-app-error-light text-[13px] text-app-error">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </div>

      {/* Pinned send bar */}
      <div className="sticky bottom-0 px-4 sm:px-5 pt-3 pb-6 bg-app-bg/90 supports-[backdrop-filter]:bg-app-bg/75 backdrop-blur-md border-t border-app-border">
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className={`w-full h-[52px] rounded-xl font-semibold text-base -tracking-[0.01em] flex items-center justify-center gap-2 transition-colors ${
            canSend ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm' : 'bg-app-border-strong text-white cursor-not-allowed'
          }`}
        >
          <Send size={18} strokeWidth={2.25} /> {sending ? 'Sending…' : 'Send'}
        </button>
        <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[12px] text-app-text-muted">
          <EyeOff size={13} strokeWidth={2} />
          Delivered anonymously · a few messages a week
        </div>
      </div>
    </div>
  );
}
