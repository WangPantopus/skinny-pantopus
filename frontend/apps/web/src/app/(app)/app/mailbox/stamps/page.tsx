// @ts-nocheck
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Award } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import StampCard from '@/components/mailbox/StampCard';

type ViewMode = 'earned' | 'locked';

function StampsContent() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>('earned');
  const [loading, setLoading] = useState(true);
  const [earned, setEarned] = useState<any[]>([]);
  const [locked, setLocked] = useState<any[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalAvailable, setTotalAvailable] = useState(0);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  useEffect(() => {
    setLoading(true);
    api.mailboxV2P3.getStamps()
      .then((result) => {
        setEarned(result.earned || []);
        setLocked(result.locked || []);
        setTotalEarned(result.total_earned);
        setTotalAvailable(result.total_available);
      })
      .catch(() => toast.error('Failed to load stamps'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Stamps</h1>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-app-text-secondary">
          <Award className="w-4 h-4 text-amber-500" />
          <span className="font-semibold">{totalEarned}</span>/<span>{totalAvailable}</span>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('earned')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${view === 'earned' ? 'bg-emerald-600 text-white' : 'bg-app-surface-sunken text-app-text-secondary'}`}>
          Earned ({earned.length})
        </button>
        <button onClick={() => setView('locked')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${view === 'locked' ? 'bg-emerald-600 text-white' : 'bg-app-surface-sunken text-app-text-secondary'}`}>
          Locked ({locked.length})
        </button>
      </div>

      {/* Stamps grid */}
      {view === 'earned' ? (
        earned.length === 0 ? (
          <div className="text-center py-16"><Award className="w-10 h-10 mx-auto text-app-text-muted mb-3" /><p className="text-sm text-app-text-secondary">No stamps earned yet</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {earned.map((stamp: any) => <StampCard key={stamp.id} stamp={stamp} />)}
          </div>
        )
      ) : (
        locked.length === 0 ? (
          <div className="text-center py-16"><p className="text-sm text-app-text-secondary">All stamps earned!</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {locked.map((stamp: any, i: number) => <StampCard key={stamp.stamp_type || i} stamp={stamp} locked />)}
          </div>
        )
      )}
    </div>
  );
}

export default function StampsPage() { return <Suspense><StampsContent /></Suspense>; }
