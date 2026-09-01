'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

function InviteCoOwnerContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [fastTrack, setFastTrack] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const handleSend = useCallback(async () => {
    if (!email.trim()) { toast.warning('Please enter an email address'); return; }
    setSubmitting(true);
    try {
      await api.homeOwnership.inviteCoOwner(homeId!, { email: email.trim(), fast_track: fastTrack });
      toast.success('Co-owner invitation sent');
      router.back();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  }, [homeId, email, fastTrack, router]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">Invite Co-Owner</h1>
      </div>

      <p className="text-sm text-app-text-secondary leading-relaxed mb-6">
        Invite another person to be a co-owner of this home. They&apos;ll need to verify their identity before gaining owner privileges.
      </p>

      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-app-text-strong">Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
            className="w-full px-3 py-2.5 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-app-text-strong">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" autoComplete="email"
            className="w-full px-3 py-2.5 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </label>

        {/* Fast track toggle */}
        <div className="flex items-center justify-between bg-app-surface border border-app-border rounded-xl p-4">
          <div className="flex-1 mr-3">
            <p className="text-sm font-semibold text-app-text">Fast-track verification</p>
            <p className="text-xs text-app-text-secondary mt-0.5">Skip the challenge window for trusted co-owners</p>
          </div>
          <button type="button" role="switch" aria-checked={fastTrack} onClick={() => setFastTrack(!fastTrack)}
            className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${fastTrack ? 'bg-emerald-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${fastTrack ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <button onClick={handleSend} disabled={submitting || !email.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 disabled:opacity-50 transition mt-2">
          {submitting ? 'Sending...' : <><Send className="w-4 h-4" /> Send Invite</>}
        </button>
      </div>
    </div>
  );
}

export default function InviteCoOwnerPage() { return <Suspense><InviteCoOwnerContent /></Suspense>; }
