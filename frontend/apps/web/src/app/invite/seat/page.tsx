// @ts-nocheck
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthToken } from '@pantopus/api';
import * as api from '@pantopus/api';
import { Building2, Shield, CheckCircle, XCircle, Clock } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  staff: 'Staff',
  viewer: 'Viewer',
};

export default function SeatInviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-app">
          <div className="animate-pulse text-app-secondary">Loading invitation…</div>
        </div>
      }
    >
      <SeatInviteAcceptContent />
    </Suspense>
  );
}

function SeatInviteAcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoggedIn = mounted && !!getAuthToken();

  useEffect(() => {
    if (!token) {
      setError('No invite token provided');
      setLoading(false);
      return;
    }
    loadInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadInvite = async () => {
    setLoading(true);
    try {
      const result = await api.businessSeats.getInviteDetails(token);
      setInvite(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invitation not found';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!isLoggedIn) {
      // Redirect to login with return URL
      const next = encodeURIComponent(`/invite/seat?token=${token}`);
      router.push(`/login?redirectTo=${next}`);
      return;
    }
    setAccepting(true);
    try {
      await api.businessSeats.acceptInvite({ token });
      setDone('accepted');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invite';
      setError(msg);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await api.businessSeats.declineInvite({ token });
      setDone('declined');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to decline invite';
      setError(msg);
    } finally {
      setDeclining(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-violet-600 animate-pulse" />
          </div>
          <p className="text-app-secondary text-sm">Loading invitation…</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !invite) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl border border-app shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-app mb-2">Invitation Error</h2>
          <p className="text-sm text-app-secondary mb-6">{error}</p>
          <button
            onClick={() => router.push('/app')}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
          >
            Go to app
          </button>
        </div>
      </div>
    );
  }

  // Completed state
  if (done) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl border border-app shadow-lg p-8 max-w-md w-full text-center">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${
            done === 'accepted' ? 'bg-green-50' : 'bg-gray-100'
          }`}>
            {done === 'accepted'
              ? <CheckCircle className="w-6 h-6 text-green-600" />
              : <XCircle className="w-6 h-6 text-gray-500" />
            }
          </div>
          <h2 className="text-lg font-semibold text-app mb-2">
            {done === 'accepted' ? 'You\'re in!' : 'Invitation declined'}
          </h2>
          <p className="text-sm text-app-secondary mb-6">
            {done === 'accepted'
              ? `You've joined ${invite?.business_name || 'the business'} as ${invite?.display_name || 'a team member'}. Your personal identity remains private.`
              : 'You\'ve declined this invitation. No changes were made to your account.'
            }
          </p>
          <button
            onClick={() => router.push(done === 'accepted' ? '/app' : '/')}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
          >
            {done === 'accepted' ? 'Go to dashboard' : 'Go home'}
          </button>
        </div>
      </div>
    );
  }

  // Main invite display
  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl border border-app shadow-lg max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-violet-600 px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Business Seat Invitation</h1>
          <p className="text-violet-200 text-sm mt-1">You&apos;ve been invited to join a business team</p>
        </div>

        {/* Details */}
        <div className="p-6 space-y-5">
          {/* Business name */}
          {invite?.business_name && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-app-secondary mb-1">Business</p>
              <p className="text-lg font-semibold text-app">{invite.business_name}</p>
            </div>
          )}

          {/* Seat details */}
          <div className="rounded-xl border border-app bg-surface-raised p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-app-secondary">Your seat name</span>
              <span className="text-sm font-medium text-app">{invite?.display_name || 'Team member'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-app-secondary">Role</span>
              <span className="inline-flex items-center rounded-full border border-app px-2.5 py-0.5 text-xs font-semibold text-app-strong">
                {ROLE_LABELS[invite?.role_base] || invite?.role_base || 'Viewer'}
              </span>
            </div>
            {invite?.title && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-app-secondary">Title</span>
                <span className="text-sm text-app">{invite.title}</span>
              </div>
            )}
          </div>

          {/* Privacy notice */}
          <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
            <Shield className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-violet-700">
              <strong>Your privacy is protected.</strong> When you accept, you&apos;ll interact through your seat identity. Your personal profile, connections, and activity are never shared with the business.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleDecline}
              disabled={declining || accepting}
              className="flex-1 px-4 py-2.5 rounded-lg border border-app-strong text-sm font-medium text-app-strong hover:bg-surface-raised disabled:opacity-50 transition"
            >
              {declining ? 'Declining…' : 'Decline'}
            </button>
            <button
              onClick={handleAccept}
              disabled={accepting || declining}
              className="flex-1 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition"
            >
              {accepting ? 'Accepting…' : (isLoggedIn ? 'Accept & join' : 'Log in to accept')}
            </button>
          </div>

          {!isLoggedIn && (
            <p className="text-xs text-center text-app-secondary">
              You need to be logged in to accept this invitation.
              <button onClick={() => router.push(`/register?returnUrl=${encodeURIComponent(`/invite/seat?token=${token}`)}`)} className="text-violet-600 hover:underline ml-1">
                Create an account
              </button>
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-app px-6 py-4 flex items-center justify-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-app-secondary" />
          <span className="text-xs text-app-secondary">This invitation expires in 7 days</span>
        </div>
      </div>
    </div>
  );
}
