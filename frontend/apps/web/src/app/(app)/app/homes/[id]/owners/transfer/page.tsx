'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

function TransferContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [buyerEmail, setBuyerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const handleTransfer = useCallback(async () => {
    if (!buyerEmail.trim()) { toast.warning("Please enter the buyer's email"); return; }

    const yes = await confirmStore.open({
      title: 'Confirm Transfer',
      description: 'This will initiate an ownership transfer. The new owner must verify ownership before the transfer completes.',
      confirmLabel: 'Initiate Transfer',
      variant: 'destructive',
    });
    if (!yes) return;

    setSubmitting(true);
    try {
      const res = await api.homeOwnership.transferOwnership(homeId!, { buyer_email: buyerEmail.trim() });
      if (res.quorum_action_id) {
        toast.info(res.message || 'Transfer requires approval from other owners');
      } else {
        toast.success('Ownership transfer initiated. The new owner will need to verify their identity.');
      }
      router.back();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to initiate transfer');
    } finally {
      setSubmitting(false);
    }
  }, [homeId, buyerEmail, router]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">Transfer Ownership</h1>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 leading-relaxed">
          Transferring ownership is a significant action. The new owner will gain full control of this home profile.
          This action may require approval from other owners.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-app-text-strong">Buyer&apos;s email</span>
          <input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="buyer@example.com" autoComplete="email"
            className="w-full px-3 py-2.5 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </label>

        <button onClick={handleTransfer} disabled={submitting || !buyerEmail.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-white rounded-xl font-bold text-base hover:bg-amber-600 disabled:opacity-50 transition mt-2">
          {submitting ? 'Processing...' : <><ArrowLeftRight className="w-4 h-4" /> Initiate Transfer</>}
        </button>
      </div>
    </div>
  );
}

export default function TransferPage() { return <Suspense><TransferContent /></Suspense>; }
