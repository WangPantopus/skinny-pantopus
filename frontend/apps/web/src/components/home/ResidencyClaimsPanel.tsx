'use client';

import Link from 'next/link';
import { Home, User } from 'lucide-react';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import { useResidencyQueue } from './residency/queue/useResidencyQueue';
import { queueApplicant, queueDate, queueRelationship } from './residency/queue/queueModel';

interface ResidencyClaimsPanelProps { homeId: string; canManage: boolean }

export default function ResidencyClaimsPanel({ homeId, canManage }: ResidencyClaimsPanelProps) {
  const queue = useResidencyQueue(homeId, canManage);
  const reviewPath = `/app/homes/${homeId}/owners/review-claim/residency`;
  if (!canManage) return null;
  return <section aria-label="Current residency claims" className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
    <div className="flex items-center gap-2 mb-3">
      <Home className="w-5 h-5 text-yellow-700" /><h3 className="font-semibold text-yellow-800">Residency claims</h3>
    </div>
    <div className="mb-3 flex flex-wrap gap-3">
      <Link href={`${reviewPath}?from=members`} prefetch={false} className="inline-flex min-h-11 items-center text-sm underline">Residency decisions and recovery</Link>
      <Link href={`/app/homes/${homeId}/owners/review-claim/history`} prefetch={false} className="inline-flex min-h-11 items-center text-sm underline">Your past residency decisions</Link>
      <button className="min-h-11 text-sm underline" onClick={queue.refresh}>Reload residency claims</button>
    </div>
    {queue.phase === 'loading' ? <p role="status" className="text-sm">Checking current residency claims…</p>
      : queue.phase === 'error' ? <div role="alert" className="text-sm text-red-800"><p>{queue.error}</p></div>
        : queue.claims.length === 0 ? <p className="text-sm text-app-text-secondary">No pending residency claims</p> : null}
    {queue.phase === 'ready' && <div className="space-y-3">{queue.claims.map(claim => <article key={claim.id}
      aria-label={`Residency request from ${queueApplicant(claim)}`}
      className="bg-app-surface rounded-lg border border-yellow-200 p-3 flex flex-wrap items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0"><User className="w-5 h-5 text-yellow-700" /></div>
      <div className="flex-1 min-w-0">
        {claim.claimant?.username ? <UserIdentityLink userId={claim.claimant.id} username={claim.claimant.username}
          displayName={queueApplicant(claim)} textClassName="font-medium text-app-text hover:underline break-words" />
          : <p className="font-medium text-app-text">{queueApplicant(claim)}</p>}
        <p className="text-xs text-app-text-secondary">Requesting: {queueRelationship(claim)}</p>
        <p className="text-xs text-app-text-muted">{queueDate(claim)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`${reviewPath}?claimId=${encodeURIComponent(claim.id)}&action=approve&from=members`} prefetch={false}
          className="inline-flex min-h-11 items-center px-3 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Review approval</Link>
        <Link href={`${reviewPath}?claimId=${encodeURIComponent(claim.id)}&action=reject&from=members`} prefetch={false}
          className="inline-flex min-h-11 items-center px-3 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium">Review rejection</Link>
      </div>
    </article>)}</div>}
  </section>;
}
