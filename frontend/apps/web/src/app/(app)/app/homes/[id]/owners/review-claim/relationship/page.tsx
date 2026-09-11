'use client';
import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { RelationshipReviewPanel } from '@/components/home/relationships/RelationshipReviewPanel';
function Content() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const action = params.get('action') === 'flag_unknown_person' ? 'flag_unknown_person' : 'decline_relationship';
  return <RelationshipReviewPanel homeId={id} claimId={params.get('claimId')} initialAction={action} />;
}
export default function RelationshipPage() { return <Suspense><Content /></Suspense>; }
