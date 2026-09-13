'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';
import { useResidencyQueue } from './residency/queue/useResidencyQueue';
import { ResidencyQueueContent } from './residency/queue/ResidencyQueueContent';

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
    </div>
    <ResidencyQueueContent homeId={homeId} queue={queue} fromMembers />
  </section>;
}
