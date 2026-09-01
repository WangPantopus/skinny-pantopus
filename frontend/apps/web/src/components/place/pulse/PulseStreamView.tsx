// ============================================================
// Today's Pulse — C10 · the full ranked stream (presentational).
//
// The feed sibling to the structured dashboard: the same address-anchored
// signals, flattened into one priority-ranked stream and expanded from the
// hero. A calm "all clear" summary tops the list when nothing is urgent;
// alerts rise above it (with an emphasis wash) when something is. For a
// claimed (T3) place a quiet verify nudge closes the stream and opens the
// B1 prompt sheet.
//
// Pure: it takes the already-fetched pulse so it's trivial to preview and
// test. The container (PulseStream) owns fetching + the page states.
// Tokens only — white bordered cards, home-green accent, sky CTAs.
// ============================================================

'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import type { NeighborhoodPulse } from '@pantopus/types';
import { DetailHeader, TextButton } from '@/components/archetypes/place';
import VerifyPromptSheet from '../VerifyPromptSheet';
import { rankPulse, type SignalTone, type StreamSignal } from './ranking';

// ── Signal tile — the glyph that carries the signal's tone ──────
// The emphasis (attention) tile is a solid accent disc so it stays
// legible on the warm emphasis wash; calmer tiles are soft fills.
const TILE_TONE: Record<SignalTone, string> = {
  home: 'bg-app-home-bg text-app-home',
  sky: 'bg-primary-100 text-primary-600',
  warning: 'bg-app-warning-bg text-app-warning',
  muted: 'bg-app-surface-sunken text-app-text-muted',
};

interface SignalCardProps {
  icon: LucideIcon;
  tone: SignalTone;
  emphasis?: boolean;
  title: string;
  detail: string;
  action?: { label: string; onClick: () => void };
}

// ── One ranked signal: icon · title · one-line detail · one action ──
function SignalCard({ icon: Icon, tone, emphasis = false, title, detail, action }: SignalCardProps) {
  const tile = emphasis ? 'bg-app-warning text-white' : TILE_TONE[tone];
  const frame = emphasis ? 'bg-app-warning-bg border-app-warning-light' : 'bg-app-surface border-app-border';
  return (
    <div className={`rounded-2xl border shadow-sm p-[15px] ${frame}`}>
      <div className="flex items-start gap-3">
        <span className={`inline-flex items-center justify-center shrink-0 w-[38px] h-[38px] rounded-[10px] ${tile}`}>
          <Icon size={20} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0 pt-px">
          <div className="text-[15.5px] font-semibold text-app-text leading-5 -tracking-[0.012em]">{title}</div>
          <p className="text-[13.5px] text-app-text-secondary leading-[19px] mt-1">{detail}</p>
          {action ? (
            <div className="mt-2.5">
              <TextButton onClick={action.onClick}>{action.label}</TextButton>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── A priority tier — the ranking made legible, never a fake number ──
function Tier({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-1">
      <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-app-text-muted px-0.5 mb-2.5">
        {label}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

// ── The calm top card: nothing urgent, here's why ──────────────
function AllClearSummary({ summary, cleared }: { summary: string; cleared: { icon: LucideIcon; label: string }[] }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px] mt-1">
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center shrink-0 w-[46px] h-[46px] rounded-[14px] bg-app-home-bg text-app-home">
          <ShieldCheck size={24} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[18px] font-bold text-app-text leading-[23px] -tracking-[0.015em]">All clear today</div>
          <p className="text-[14px] text-app-text-muted leading-5 mt-1">
            {summary ||
              "Nothing needs your attention on your block right now. Here's what's worth a look when you have a minute."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-[18px] gap-y-2 mt-[15px] pt-3.5 border-t border-app-border-subtle">
        {cleared.map((fact) => (
          <div key={fact.label} className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-app-home-bg text-app-home shrink-0">
              <fact.icon size={11} strokeWidth={2.5} />
            </span>
            <span className="text-[13px] font-medium text-app-text-secondary">{fact.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface PulseStreamViewProps {
  pulse: NeighborhoodPulse['pulse'];
  /** Compact address line, e.g. "1421 SE Oak St · Portland". */
  address?: string;
  /** The active home id — routes the verify flow (B1 sheet). */
  homeId: string;
  /** Full display address for the verify sheet. */
  verifyAddress?: string;
  /** Claimed-but-unverified (T3): show the quiet verify nudge + sheet. */
  showVerify?: boolean;
}

export default function PulseStreamView({
  pulse,
  address,
  homeId,
  verifyAddress,
  showVerify = false,
}: PulseStreamViewProps) {
  const router = useRouter();
  const [verifyOpen, setVerifyOpen] = useState(false);

  const ranked = rankPulse(pulse);

  const renderSignal = (signal: StreamSignal) => (
    <SignalCard
      key={signal.key}
      icon={signal.icon}
      tone={signal.tone}
      emphasis={signal.emphasis}
      title={signal.title}
      detail={signal.detail}
      action={
        signal.action
          ? { label: signal.action.label, onClick: () => router.push(signal.action!.route) }
          : undefined
      }
    />
  );

  // The claimed (T3) verify nudge tucks into the "when you have a minute"
  // tier — joining an existing one rather than printing a second label.
  const verifyCard = showVerify ? (
    <SignalCard
      key="verify-nudge"
      icon={ShieldCheck}
      tone="sky"
      title="Verify your address"
      detail="Message neighbors, get your verified badge, and unlock your mailbox."
      action={{ label: 'Verify address', onClick: () => setVerifyOpen(true) }}
    />
  ) : null;
  const hasWhenever = ranked.tiers.some((tier) => tier.key === 'whenever');

  return (
    <>
      <DetailHeader title="Today's Pulse" address={address} backHref="/app/place" />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        {ranked.urgent ? null : <AllClearSummary summary={ranked.summary} cleared={ranked.cleared} />}

        {ranked.tiers.map((tier) => (
          <Tier key={tier.key} label={tier.label}>
            {tier.signals.map(renderSignal)}
            {tier.key === 'whenever' ? verifyCard : null}
          </Tier>
        ))}

        {verifyCard && !hasWhenever ? (
          <Tier label="When you have a minute">{verifyCard}</Tier>
        ) : null}
      </div>

      {showVerify ? (
        <VerifyPromptSheet
          open={verifyOpen}
          onClose={() => setVerifyOpen(false)}
          homeId={homeId}
          address={verifyAddress || address || ''}
        />
      ) : null}
    </>
  );
}
