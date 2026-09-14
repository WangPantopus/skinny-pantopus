'use client';

import { Suspense, useCallback, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MailOpen } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { extractApiError } from '@pantopus/ui-utils';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCode = searchParams.get('code') || '';

  const leaseInvite = searchParams.get('type') === 'lease';
  const [code, setCode] = useState(prefilledCode);
  const [loading, setLoading] = useState(false);
  const lifetime = useRef({ active: false, generation: 0, busy: false });
  const returnTo = `/app/homes/invite?${new URLSearchParams({ ...(leaseInvite ? { type: 'lease' } : {}), code: prefilledCode })}`;

  useEffect(() => {
    const scope = lifetime.current;
    scope.active = true;
    const changed = () => {
      ++scope.generation; scope.busy = false; setLoading(false); setCode(prefilledCode);
      if (!getAuthToken()) router.push(`/login?redirectTo=${encodeURIComponent(returnTo)}`);
    };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) changed(); };
    const unsubscribe = api.onTokenChange(changed);
    window.addEventListener('storage', storage); changed();
    return () => { scope.active = false; ++scope.generation; scope.busy = false; unsubscribe(); window.removeEventListener('storage', storage); };
  }, [prefilledCode, returnTo, router]);

  const handleSubmit = useCallback(async () => {
    const scope = lifetime.current;
    if (!scope.active || scope.busy || !getAuthToken()) return;
    const trimmed = code.trim();
    if (!trimmed) { toast.warning('Please enter an invite code'); return; }
    if (!leaseInvite) { router.push(`/invite/${encodeURIComponent(trimmed)}`); return; }
    const generation = scope.generation;
    const current = () => scope.active && generation === scope.generation;
    scope.busy = true; setLoading(true);
    try {
      const preview = await api.tenant.previewInvite(trimmed);
      if (!current()) return;
      if (!preview?.home?.id || !preview.account_email || !['pending', 'accepted'].includes(preview.invitation?.status)) {
        throw new Error('Could not confirm this invitation. Please retry.');
      }
      const calendarDate = (value: string) => new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
      const dates = `${calendarDate(preview.invitation.proposed_start)}${preview.invitation.proposed_end ? ` to ${calendarDate(preview.invitation.proposed_end)}` : ', with no end date'}`;
      const yes = await confirmStore.open({ title: 'Lease Invitation',
        description: `${preview.account_email} will accept the invitation to ${preview.home.name || 'this Home'} for ${dates}. Access follows the lease dates and household permissions. Retrying recovers the same saved acceptance.`,
        confirmLabel: 'Accept', cancelLabel: 'Cancel', variant: 'primary' });
      if (!yes || !current()) return;
      const result = await api.tenant.acceptInvite(trimmed);
      if (!current()) return;
      if (!result?.lease?.id || result.lease.home_id !== preview.home.id || result.lease.state !== 'active' || !result.occupancy?.id) {
        throw new Error('Could not confirm acceptance. Retry this invitation to check the saved result.');
      }
      toast.success('Lease invitation accepted. Access follows your lease dates.');
      router.push('/app/homes');
    } catch (err: unknown) {
      if (current()) toast.error(extractApiError(err, 'Could not check this invitation. Please retry.'));
    } finally {
      if (current()) { scope.busy = false; setLoading(false); }
    }
  }, [code, leaseInvite, router]);

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
          {leaseInvite ? 'Review the lease invitation using the account it was sent to.' : 'Enter the invite code shared by a household member to join their home profile.'}
        </p>

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Enter code"
          autoFocus
          disabled={loading}
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
