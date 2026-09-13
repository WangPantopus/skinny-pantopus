'use client';

import Link from 'next/link';
import { User } from 'lucide-react';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import { queueApplicant, queueDate, queueRelationship } from './queueModel';
import type { useResidencyQueue } from './useResidencyQueue';

interface Props { homeId: string; queue: ReturnType<typeof useResidencyQueue>; fromMembers?: boolean }

export function ResidencyQueueContent({ homeId, queue, fromMembers = false }: Props) {
  const reviewPath = `/app/homes/${homeId}/owners/review-claim/residency`;
  return <div className="space-y-3">
    <button className="min-h-11 text-sm underline" onClick={queue.refresh}>Reload residency claims</button>
    {queue.phase === 'loading' ? <p role="status" className="text-sm">Checking current residency claims…</p>
      : queue.phase === 'error' ? <div role="alert" className="text-sm text-red-800"><p>{queue.error}</p></div>
        : queue.claims.length === 0 ? <p className="text-sm text-app-text-secondary">No pending residency claims</p> : null}
    {queue.phase === 'ready' && queue.claims.map(claim => <article key={claim.id}
      aria-label={`Residency request from ${queueApplicant(claim)}`}
      className="bg-app-surface rounded-lg border border-app-border p-3 flex flex-wrap items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-app-surface-sunken flex items-center justify-center flex-shrink-0"><User className="w-5 h-5 text-app-text-secondary" /></div>
      <div className="flex-1 min-w-0">
        {claim.claimant?.username ? <UserIdentityLink userId={claim.claimant.id} username={claim.claimant.username}
          displayName={queueApplicant(claim)} textClassName="font-medium text-app-text hover:underline break-words" />
          : <p className="font-medium text-app-text">{queueApplicant(claim)}</p>}
        <p className="text-xs text-app-text-secondary">Requesting: {queueRelationship(claim)}</p>
        <p className="text-xs text-app-text-muted">{queueDate(claim)}</p>
      </div>
      <div className="flex flex-wrap gap-2">{(['approve', 'reject'] as const).map(action => <Link key={action}
        href={`${reviewPath}?claimId=${encodeURIComponent(claim.id)}&action=${action}${fromMembers ? '&from=members' : ''}`}
        prefetch={false} onClick={event => {
          if (!queue.canReview(claim.id)) { event.preventDefault(); queue.retire(); }
        }}
        className={`inline-flex min-h-11 items-center px-3 text-sm rounded-lg font-medium ${action === 'approve'
          ? 'bg-green-600 text-white hover:bg-green-700' : 'border border-red-300 text-red-600 hover:bg-red-50'}`}>
        {action === 'approve' ? 'Review approval' : 'Review rejection'}
      </Link>)}</div>
    </article>)}
  </div>;
}
