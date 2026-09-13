'use client';
import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ResidencyHistoryPanel } from '@/components/home/residency/history/ResidencyHistoryPanel';
function HistoryPageContent() {
  const params = useParams(), search = useSearchParams();
  const homeId = typeof params.id === 'string' ? params.id.toLowerCase() : '';
  const receipts = search.getAll('receipt');
  const receiptId = receipts.length > 1 ? 'invalid' : receipts[0] ?? null;
  return <ResidencyHistoryPanel homeId={homeId} receiptId={receiptId} />;
}
export default function HistoryPage() {
  return <Suspense fallback={<p role="status" className="p-6">Loading your decisions…</p>}><HistoryPageContent /></Suspense>;
}
