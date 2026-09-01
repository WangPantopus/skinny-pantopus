'use client';

import { Suspense, useCallback, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MailOpen } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCode = searchParams.get('code') || '';

  const [code, setCode] = useState(prefilledCode);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const handleSubmit = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed) { toast.warning('Please enter an invite code'); return; }

    setLoading(true);
    try {
      const res = await api.homes.getInviteByToken(trimmed);

      if ((res as any).expired) { toast.error('This invite code has expired'); return; }
      if ((res as any).alreadyUsed) { toast.error('This invite code has already been used'); return; }

      if (res.invitation) {
        const homeName = (res as any).home?.name || (res as any).home?.address || 'a home';
        const yes = await confirmStore.open({
          title: 'Home Invite',
          description: `You've been invited to join ${homeName}`,
          confirmLabel: 'Accept',
          cancelLabel: 'Decline',
          variant: 'primary',
        });
        if (!yes) return;

        const acceptRes = await api.homes.acceptInviteByToken(trimmed);
        toast.success('Invite accepted!');
        router.push(`/app/homes/${acceptRes.homeId}/dashboard`);
        return; // Don't reset loading — navigating away
      }
    } catch (err: any) {
      toast.error(err?.message || 'This invite code is not valid');
    } finally {
      setLoading(false);
    }
  }, [code, router]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">Enter Invite Code</h1>
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
          <MailOpen className="w-10 h-10 text-emerald-600" />
        </div>

        <p className="text-sm text-app-text-secondary leading-relaxed mb-8 max-w-sm">
          Enter the invite code shared by a household member to join their home profile.
        </p>

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Enter code"
          autoFocus
          className="w-full text-center text-lg tracking-widest px-4 py-3.5 border-2 border-app-border rounded-xl text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />

        <button onClick={handleSubmit} disabled={loading || !code.trim()}
          className="w-full mt-4 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 disabled:opacity-50 transition">
          {loading ? 'Checking...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

export default function InvitePage() { return <Suspense><InviteContent /></Suspense>; }
