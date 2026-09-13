'use client';

import Link from 'next/link';
import { Check, CheckCircle, User, X } from 'lucide-react';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import { queueApplicant, queueDate, queueRelationship } from './queueModel';
import type { useResidencyQueue } from './useResidencyQueue';

interface Props { homeId: string; queue: ReturnType<typeof useResidencyQueue>; fromMembers?: boolean }

export function ResidencyQueueContent({ homeId, queue, fromMembers = false }: Props) {
  const reviewPath = `/app/homes/${homeId}/owners/review-claim/residency`;
  return <div className={fromMembers ? 'space-y-3' : 'space-y-4'}>
    <button className="text-sm underline" onClick={queue.refresh}>Reload residency claims</button>
    {queue.phase === 'loading' ? <p role="status" className="text-sm">Checking current residency claims…</p>
      : queue.phase === 'error' ? <div role="alert" className="text-sm text-red-800"><p>{queue.error}</p></div>
        : queue.claims.length === 0 ? <div className={fromMembers ? undefined : 'text-center py-16'}>
          {!fromMembers && <CheckCircle className="w-10 h-10 mx-auto text-app-text-muted mb-3" />}
          <p className="text-sm text-app-text-secondary">No pending residency claims</p>
        </div> : null}
    {queue.phase === 'ready' && queue.claims.map(claim => {
      const identity = <>
        {fromMembers ? <div aria-hidden="true" className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {claim.claimant?.username?.[0]?.toUpperCase() || '?'}
        </div> : <div className="w-9 h-9 rounded-full bg-app-surface-sunken flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-app-text-secondary" />
        </div>}
        <div className="flex-1 min-w-0">
          {fromMembers && claim.claimant?.username ? <UserIdentityLink userId={claim.claimant.id} username={claim.claimant.username}
            displayName={queueApplicant(claim)} textClassName="font-medium text-app-text hover:underline truncate" />
            : <p className={fromMembers ? 'font-medium text-app-text truncate' : 'text-sm font-semibold text-app-text'}>{queueApplicant(claim)}</p>}
          <p className="text-xs text-app-text-secondary">Requesting: {queueRelationship(claim)}</p>
          {fromMembers && <p className="text-xs text-app-text-muted">{queueDate(claim)}</p>}
        </div>
        {!fromMembers && <span className="text-xs text-app-text-muted" title={queueDate(claim)}>
          {claim.created_at ? `${Math.floor((Date.now() - Date.parse(claim.created_at)) / 86400000)}d ago` : 'Date unavailable'}
        </span>}
      </>;
      return <article key={claim.id}
        aria-label={`Residency request from ${queueApplicant(claim)}`}
        className={fromMembers
          ? 'bg-app-surface rounded-lg border border-yellow-200 p-3 flex flex-wrap items-center gap-3'
          : 'bg-app-surface border border-app-border rounded-xl p-4'}>
        {fromMembers ? identity : <div className="flex items-center gap-3 mb-2">{identity}</div>}
      <div className={fromMembers ? 'flex flex-wrap gap-2' : 'flex items-center gap-2'}>{(['approve', 'reject'] as const).map(action => <Link key={action}
        href={`${reviewPath}?claimId=${encodeURIComponent(claim.id)}&action=${action}${fromMembers ? '&from=members' : ''}`}
        prefetch={false} onClick={event => {
          if (!queue.canReview(claim.id)) { event.preventDefault(); queue.retire(); }
        }}
        aria-label={fromMembers ? undefined : (action === 'approve' ? 'Approve: review approval' : 'Deny: review rejection')}
        className={fromMembers
          ? `px-3 py-1.5 text-sm rounded-lg font-medium ${action === 'approve'
            ? 'bg-green-600 text-white hover:bg-green-700' : 'border border-red-300 text-red-600 hover:bg-red-50'}`
          : `flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition ${action === 'approve'
            ? 'bg-green-500 text-white hover:bg-green-600' : 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100'}`}>
        {!fromMembers && (action === 'approve' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />)}
        {fromMembers ? (action === 'approve' ? 'Review approval' : 'Review rejection') : (action === 'approve' ? 'Approve' : 'Deny')}
      </Link>)}</div>
    </article>;
    })}
  </div>;
}
