// ============================================================
// Just moved — the first week at this address (Wedge v2 D5, movers first).
//
// A household that just moved has the strongest address needs of anyone
// and no network to miss. For ~60 days after the move-in date the claim
// wizard collects, this card leads the dashboard: five things the address
// can do now, each a link into a surface that already exists, each with a
// checkbox the person ticks off. "Set your pickup day" ticks itself once
// the calendar has a real pickup day. At five of five the card retires
// into one line; "Not new here" dismisses it. Only the ticks and the
// dismissal are stored, locally.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Truck, Trash2, Mailbox, Zap, Landmark, Users, ChevronRight, Check } from 'lucide-react';

export const JUST_MOVED_WINDOW_DAYS = 60;
const DISMISS_KEY = 'pantopus_just_moved_dismissed';
const DONE_KEY = 'pantopus_just_moved_done';

/** True when the move-in date is within the last 60 days (or up to 14 days ahead). */
export function isRecentMove(moveInDate: string | null | undefined, now = new Date()): boolean {
  if (!moveInDate) return false;
  // Whole calendar days, so the answer never flips mid-day and day 60 is
  // inclusive on every platform (Android and iOS count the same way).
  const [y, m, d] = String(moveInDate).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return false;
  const start = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - start) / 86400000);
  return days >= -14 && days <= JUST_MOVED_WINDOW_DAYS;
}

export type JustMovedStepId = 'pickup' | 'mail' | 'money' | 'civic' | 'block';

export const JUST_MOVED_STEPS: { id: JustMovedStepId; icon: LucideIcon; label: string; payoff: string; href: string }[] = [
  { id: 'pickup', icon: Trash2, label: 'Set your pickup day', payoff: 'Reminders the night before, every week', href: '/app/place/today' },
  { id: 'mail', icon: Mailbox, label: "Send back the previous resident's mail", payoff: 'One tap returns it; yours gets filed', href: '/app/mailbox/settings/mail-day' },
  { id: 'money', icon: Zap, label: 'Utilities, rebates, and rates', payoff: 'What this address qualifies for, and when taxes are due', href: '/app/place/money' },
  { id: 'civic', icon: Landmark, label: 'Who represents you, and the schools', payoff: 'Your districts, the next election, the council calendar', href: '/app/place/civic' },
  { id: 'block', icon: Users, label: 'Meet the block', payoff: 'Who is verified nearby, and the Founding Neighbor slots', href: '/app/nearby' },
];

function readDone(homeId: string): Set<JustMovedStepId> {
  try {
    const raw = window.localStorage.getItem(`${DONE_KEY}:${homeId}`);
    return new Set(raw ? (JSON.parse(raw) as JustMovedStepId[]) : []);
  } catch {
    return new Set();
  }
}

function writeDone(homeId: string, done: Set<JustMovedStepId>) {
  try { window.localStorage.setItem(`${DONE_KEY}:${homeId}`, JSON.stringify([...done])); } catch { /* ignore */ }
}

export interface JustMovedCardProps {
  homeId: string;
  moveInDate: string | null | undefined;
  /**
   * From the address calendar section: false once the household has set
   * its own pickup day, which ticks the first step without a tap.
   */
  needsPickupDay?: boolean | null;
  className?: string;
}

export default function JustMovedCard({ homeId, moveInDate, needsPickupDay = null, className = '' }: JustMovedCardProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true);
  const [done, setDone] = useState<Set<JustMovedStepId>>(() => new Set());

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(`${DISMISS_KEY}:${homeId}`) === '1');
    } catch {
      setDismissed(false);
    }
    setDone(readDone(homeId));
  }, [homeId]);

  if (dismissed || !isRecentMove(moveInDate)) return null;

  const isDone = (id: JustMovedStepId) => (id === 'pickup' && needsPickupDay === false) || done.has(id);
  const doneCount = JUST_MOVED_STEPS.filter((s) => isDone(s.id)).length;
  const total = JUST_MOVED_STEPS.length;
  const complete = doneCount === total;

  const dismiss = () => {
    try { window.localStorage.setItem(`${DISMISS_KEY}:${homeId}`, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const toggle = (id: JustMovedStepId) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDone(next);
    writeDone(homeId, next);
  };

  // Five of five: the card retires into one line rather than vanishing.
  if (complete) {
    return (
      <section aria-label="First week done" data-testid="just-moved-done" className={`flex items-center gap-3 rounded-2xl border border-app-border bg-app-home-bg px-4 py-3 ${className}`}>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-home text-white">
          <Check size={16} strokeWidth={2.75} />
        </span>
        <p className="flex-1 text-[14px] font-semibold text-app-text">First week done. The block is yours.</p>
        <button type="button" onClick={dismiss} className="text-[13px] font-semibold text-app-text-secondary hover:text-app-text">Hide</button>
      </section>
    );
  }

  return (
    <section aria-label="Just moved" data-testid="just-moved" className={`overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm ${className}`}>
      {/* Header band in the home tint: this is the card the eye lands on. */}
      <div className="bg-app-home-bg px-4 pt-4 pb-3.5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-app-home text-white shadow-sm">
            <Truck size={22} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-bold leading-[24px] -tracking-[0.015em] text-app-text text-balance">Your first week at this address</p>
            <p className="mt-1 text-[13.5px] leading-[19px] text-app-text-strong">Five things it can do for you now, before there are neighbors to meet.</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-app-text/15" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount} aria-label="First week progress">
            <div className="h-full rounded-full bg-app-home transition-[width] duration-300" style={{ width: `${(doneCount / total) * 100}%` }} />
          </div>
          <span className="text-[12.5px] font-semibold tabular-nums text-app-text-strong" data-testid="just-moved-progress">{doneCount} of {total} done</span>
        </div>
      </div>

      <ul className="divide-y divide-app-border-subtle px-2">
        {JUST_MOVED_STEPS.map((s) => {
          const Icon = s.icon;
          const checked = isDone(s.id);
          const auto = s.id === 'pickup' && needsPickupDay === false;
          return (
            <li key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`${s.label}${checked ? ', done' : ''}`}
                disabled={auto}
                onClick={() => toggle(s.id)}
                data-testid={`just-moved-check-${s.id}`}
                className={`m-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  checked ? 'border-app-home bg-app-home text-white' : 'border-app-border text-transparent hover:border-app-home'
                }`}
              >
                <Check size={14} strokeWidth={3} />
              </button>
              <button type="button" onClick={() => router.push(s.href)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2.5 pr-2 text-left hover:bg-app-hover">
                <Icon size={18} strokeWidth={2} className={`shrink-0 ${checked ? 'text-app-text-muted' : 'text-app-home'}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[14px] font-semibold ${checked ? 'text-app-text-secondary' : 'text-app-text'}`}>{s.label}</span>
                  <span className="block text-[12.5px] leading-[17px] text-app-text-secondary">{s.payoff}</span>
                </span>
                <ChevronRight size={16} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between border-t border-app-border-subtle px-4 py-2.5">
        <span className="text-[12px] text-app-text-muted">Shows for your first two months here.</span>
        <button type="button" onClick={dismiss} className="text-[13px] font-semibold text-app-text-secondary hover:text-app-text" data-testid="just-moved-dismiss">Not new here</button>
      </div>
    </section>
  );
}
