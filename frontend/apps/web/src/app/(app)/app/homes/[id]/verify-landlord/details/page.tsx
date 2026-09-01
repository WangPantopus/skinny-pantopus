'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

function DetailsContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [message, setMessage] = useState('');
  const [startDate, setStartDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const handleSubmit = useCallback(async () => {
    if (!homeId) return;
    setLoading(true);
    try {
      await api.tenant.requestApproval({
        home_id: homeId,
        start_at: startDate || null,
        message: message.trim() || null,
      });
      router.push(`/app/homes/${homeId}/verify-landlord/submitted`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  }, [homeId, message, startDate, router]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">Request Approval</h1>
      </div>

      <p className="text-sm text-app-text-secondary leading-relaxed mb-6">
        Send a request to your landlord to verify your tenancy. Include your move-in date and an optional message.
      </p>

      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-app-text-strong">Move-in date</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-app-border rounded-lg text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-app-text-strong">Message to landlord (optional)</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Hi, I'm your new tenant at this address..."
            rows={4}
            className="w-full px-3 py-2.5 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
        </label>

        <button onClick={handleSubmit} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 disabled:opacity-50 transition mt-2">
          {loading ? 'Submitting...' : <><Send className="w-4 h-4" /> Submit Request</>}
        </button>
      </div>
    </div>
  );
}

export default function VerifyLandlordDetailsPage() { return <Suspense><DetailsContent /></Suspense>; }
