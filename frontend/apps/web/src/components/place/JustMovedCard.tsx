// ============================================================
// Just moved — the first-week checklist (Wedge v2 D5, movers first).
//
// A household that just moved has the strongest address needs of anyone
// and no network to miss. This card shows for ~60 days after the
// move-in date the claim wizard collects: five things, each a link into
// a surface that already exists. Dismissable; nothing else is stored.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Truck, Trash2, Mailbox, Zap, Landmark, Users, ChevronRight, X } from 'lucide-react';

export const JUST_MOVED_WINDOW_DAYS = 60;
const DISMISS_KEY = 'pantopus_just_moved_dismissed';

/** True when the move-in date is within the last 60 days (or up to 14 days ahead). */
export function isRecentMove(moveInDate: string | null | undefined, now = new Date()): boolean {
  if (!moveInDate) return false;
  const t = new Date(`${String(moveInDate).slice(0, 10)}T12:00:00`).getTime();
  if (!Number.isFinite(t)) return false;
  const days = (now.getTime() - t) / 86400000;
  return days >= -14 && days <= JUST_MOVED_WINDOW_DAYS;
}

const STEPS: { icon: LucideIcon; label: string; sub: string; href: string }[] = [
  { icon: Trash2, label: 'Set your pickup day', sub: 'Garbage and recycling reminders start the night before', href: '/app/place/today' },
  { icon: Mailbox, label: "Send back the previous resident's mail", sub: 'Mail Day returns it in one tap; your own gets filed', href: '/app/mailbox/settings/mail-day' },
  { icon: Zap, label: 'Utilities, rebates, and rates', sub: 'What this address qualifies for, and the tax dates', href: '/app/place/money' },
  { icon: Landmark, label: 'Who represents you, and the schools', sub: 'Your districts, the next election, the council calendar', href: '/app/place/civic' },
  { icon: Users, label: 'Meet the block', sub: 'Who is verified nearby, and the Founding Neighbor slots', href: '/app/nearby' },
];

export interface JustMovedCardProps {
  homeId: string;
  moveInDate: string | null | undefined;
  className?: string;
}

export default function JustMovedCard({ homeId, moveInDate, className = '' }: JustMovedCardProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(`${DISMISS_KEY}:${homeId}`) === '1');
    } catch {
      setDismissed(false);
    }
  }, [homeId]);

  if (dismissed || !isRecentMove(moveInDate)) return null;

  const dismiss = () => {
    try { window.localStorage.setItem(`${DISMISS_KEY}:${homeId}`, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <section aria-label="Just moved" className={`bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center shrink-0 w-[42px] h-[42px] rounded-xl bg-app-home-bg text-app-home">
          <Truck size={22} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-app-text leading-[23px] -tracking-[0.012em]">Just moved in? Here&apos;s the first week.</p>
          <p className="text-[13.5px] text-app-text-secondary leading-[19px] mt-1">Five things this address can do for you now, before there are neighbors to meet.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 p-1.5 rounded-lg text-app-text-muted hover:bg-app-surface-sunken">
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <ul className="mt-3 divide-y divide-app-border-subtle">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.href}>
              <button type="button" onClick={() => router.push(s.href)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-app-hover rounded-lg px-1 -mx-1">
                <Icon size={18} strokeWidth={2} className="shrink-0 text-app-home" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-app-text">{s.label}</span>
                  <span className="block text-[12.5px] text-app-text-secondary leading-[17px]">{s.sub}</span>
                </span>
                <ChevronRight size={16} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
