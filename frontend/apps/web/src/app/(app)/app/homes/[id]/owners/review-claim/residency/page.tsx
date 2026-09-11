'use client';
import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ResidencyReviewPanel } from '@/components/home/residency/ResidencyReviewPanel';
function Content() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  return <ResidencyReviewPanel homeId={id} claimId={params.get('claimId')}
    initialAction={params.get('action') === 'reject' ? 'reject' : 'approve'} fromMembers={params.get('from') === 'members'} />;
}
export default function ResidencyPage() { return <Suspense><Content /></Suspense>; }
