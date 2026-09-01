// ============================================================
// Place — B3 · Verified (success reveal).
//
// The web mirror of docs/design/place (place-verify-done.jsx): the calm
// payoff after verification completes. A green verified seal, "Your
// address is verified.", and a soft reveal of the three Band-D rows that
// just became available — message neighbors, mailbox, residency letter —
// each a real destination. One way forward: go to your place.
//
// Shown on /app/place?verified=1 (the verification pages route here on
// success). "Go to your place" clears the flag and returns to the now
// T4-verified dashboard. Home-green carries the win; sky carries action.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  ArrowRight,
  ChevronRight,
  MessageCircle,
  Mailbox,
  FileText,
} from 'lucide-react';
import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import { IconTile } from '@/components/archetypes/place';

export interface VerifiedSuccessProps {
  /** "Go to your place" — clears the flag and shows the verified dashboard. */
  onContinue: () => void;
}

export default function VerifiedSuccess({ onContinue }: VerifiedSuccessProps) {
  // Reuse the dashboard's primary-home query (cached) for the address line.
  const homeQuery = useQuery({
    queryKey: queryKeys.placePrimaryHome(),
    queryFn: () => api.homes.getPrimaryHome(),
    staleTime: 60_000,
  });

  const home = homeQuery.data?.home ?? null;
  const homeId = home?.id ?? null;
  const addressLine = home ? [home.address, home.city].filter(Boolean).join(', ') : 'your home';

  const rows: { icon: LucideIcon; label: string; sub: string; href: string }[] = [
    {
      icon: MessageCircle,
      label: 'Message neighbors',
      sub: 'Start a conversation with people on your block',
      href: homeId ? `/app/homes/${homeId}/message` : '/app/chat',
    },
    { icon: Mailbox, label: 'Your mailbox', sub: 'Track packages, civic notices, and permits', href: '/app/mailbox' },
    { icon: FileText, label: 'Generate a residency letter', sub: 'Proof of address, ready to download', href: '/app/identity' },
  ];

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 sm:px-5 py-10 flex flex-col">
      {/* centerpiece — staged reveal (decorative; static under reduced motion) */}
      <div className="flex flex-col items-center text-center motion-safe:animate-[fadeInUp_0.4s_ease-out_both]">
        {/* verified seal — green disc + soft halo, calm not loud */}
        <div className="relative w-[108px] h-[108px] flex items-center justify-center">
          <span className="absolute w-[108px] h-[108px] rounded-full bg-app-home-bg opacity-50" />
          <span className="absolute w-[92px] h-[92px] rounded-full bg-app-home-bg opacity-80" />
          <span className="relative w-[78px] h-[78px] rounded-full bg-app-home text-white shadow-lg flex items-center justify-center">
            <Check size={42} strokeWidth={3} />
          </span>
        </div>

        <h1 className="mt-6 text-[25px] font-bold -tracking-[0.025em] text-app-text leading-[31px]">
          Your address is verified.
        </h1>
        <p className="mt-3 text-[14.5px] text-app-text-strong leading-[21px] max-w-[300px]">
          You&apos;re now an address-proven neighbor at {addressLine}.
        </p>
      </div>

      {/* the reveal */}
      <div className="mt-8 motion-safe:animate-[fadeInUp_0.4s_ease-out_both]" style={{ animationDelay: '180ms' }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-muted mb-2.5 px-0.5">
          Now available
        </div>
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
          {rows.map((r, i) => (
            <Link
              key={r.label}
              href={r.href}
              className={`flex items-center gap-3 px-3.5 py-3 hover:bg-app-hover transition-colors motion-safe:animate-[fadeInUp_0.35s_ease-out_both] ${
                i > 0 ? 'border-t border-app-border-subtle' : ''
              }`}
              style={{ animationDelay: `${260 + i * 110}ms` }}
            >
              <IconTile icon={r.icon} tone="home" size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-app-text -tracking-[0.01em]">{r.label}</div>
                <div className="text-[12.5px] text-app-text-secondary mt-0.5 leading-[17px]">{r.sub}</div>
              </div>
              <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
            </Link>
          ))}
        </div>
      </div>

      {/* forward */}
      <div className="mt-8 motion-safe:animate-[fadeInUp_0.4s_ease-out_both]" style={{ animationDelay: '620ms' }}>
        <button
          type="button"
          onClick={onContinue}
          className="w-full h-[52px] rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-base -tracking-[0.01em] flex items-center justify-center gap-2 shadow-sm transition-colors"
        >
          Go to your place
          <ArrowRight size={17} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
