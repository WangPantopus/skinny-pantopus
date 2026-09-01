// ============================================================
// PrivacyPromise — the answer to "why would I give an app my home
// address?", shown at the soft wall and again at claim (Wedge v2 §2).
//
// Every line is a statement about what the product does TODAY, not an
// aspiration — it is checked against the serializers and routes that
// enforce it (see docs/location-privacy-matrix.md). If a line stops
// being true, change the product or delete the line; never soften it.
// ============================================================

import { ShieldCheck } from 'lucide-react';

export const PRIVACY_PROMISE_LINES: readonly string[] = [
  'Neighbors see a first name and a street at most. Never a house number or unit.',
  'We never sell your address or use it for ads.',
  'Verifying never asks for your GPS. It works by mail, a landlord, or a document you choose.',
  'Verification documents are seen by one reviewer and never by neighbors.',
];

export interface PrivacyPromiseProps {
  /** Compact: single-column, no heading, for the soft wall. */
  compact?: boolean;
  className?: string;
}

export default function PrivacyPromise({ compact = false, className = '' }: PrivacyPromiseProps) {
  return (
    <section
      aria-label="Privacy promise"
      className={`rounded-2xl border border-app-border bg-app-surface-sunken ${compact ? 'px-4 py-3.5' : 'p-4'} ${className}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={15} strokeWidth={2.25} className="text-app-home shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-app-text-secondary">
          {compact ? 'Private by default' : 'What we do with your address'}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {PRIVACY_PROMISE_LINES.map((line) => (
          <li key={line} className="flex items-start gap-2 text-[13px] leading-[18px] text-app-text-strong">
            <span aria-hidden="true" className="mt-[7px] w-1 h-1 rounded-full bg-app-home shrink-0" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
