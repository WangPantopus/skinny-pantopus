'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ticket } from 'lucide-react';
import { getAuthToken } from '@pantopus/api';
import EmptyState from '@/components/ui/EmptyState';

// In-app coupon orders have no real checkout yet. This page rendered CouponPipeline, whose fallback invents an
// order, a receipt and a released payout without any backend call, so it shows an honest "not available" state.
function CouponContent() {
  const router = useRouter();

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} aria-label="Back" className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">Coupon</h1>
      </div>
      <EmptyState
        icon={Ticket}
        title="Coupon orders aren't available yet"
        description="Ordering with a mailbox coupon isn't available in the app yet."
        actionLabel="Back to Mailbox"
        onAction={() => router.push('/app/mailbox')}
      />
    </div>
  );
}

export default function CouponPage() { return <Suspense><CouponContent /></Suspense>; }
