'use client';

import Link from 'next/link';
import { claimStatusLabel } from '@/components/homes/ClaimApprovalChecklist';
import { claimAddress, type MyClaim } from '@/lib/myHomes';

/**
 * The Place overview with no Home to open yet, while claims are in review: the address you claimed and
 * what each claim is waiting on, as on My Homes, where its checklist and Withdraw are. A claim gives no
 * household access, so nothing of the Home itself shows.
 */
export default function ClaimsInReview({ claims }: { claims: MyClaim[] }) {
  return (
    <section className="rounded-2xl border border-app-border bg-app-surface p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-app-text-secondary">Verification in progress</p>
      <h1 className="mt-1 text-xl font-semibold">{claims.length === 1 ? 'Your claim is in review' : 'Your claims are in review'}</h1>
      <ul className="mt-4 space-y-3">
        {claims.map((claim) => {
          const { line, city } = claimAddress(claim);
          return (
            <li key={claim.id} className="rounded-xl border border-violet-200 bg-violet-50/80 dark:bg-violet-950/30 dark:border-violet-800 p-4">
              <p className="font-semibold text-app-text break-words">{line}</p>
              {city ? <p className="text-sm text-app-text-secondary">{city}</p> : null}
              <span className="mt-2 inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/50 px-2.5 py-1 text-xs font-semibold text-violet-800 dark:text-violet-200">
                {claimStatusLabel(claim)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-app-text-secondary">A claim does not grant household access. Your Place fills in here once a Pantopus reviewer approves it.</p>
      <div className="mt-4 flex flex-wrap gap-4">
        <Link href="/app/homes" className="font-semibold text-primary-700 dark:text-primary-300">Check status</Link>
      </div>
    </section>
  );
}
