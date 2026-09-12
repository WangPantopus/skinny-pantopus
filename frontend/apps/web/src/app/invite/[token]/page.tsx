'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import * as api from '@pantopus/api';
import { confirmStore } from '@/components/ui/confirm-store';
import { useInvitationPreview } from '@/components/homes/useInvitationPreview';

const ROLE_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  roommate: { label: 'Roommate', icon: '🏠', desc: 'Household role with assigned permissions' },
  family: { label: 'Family', icon: '👨‍👩‍👧', desc: 'Family member in the household' },
  tenant: { label: 'Tenant', icon: '🔑', desc: 'Residency access follows household permissions' },
  guest: { label: 'Guest', icon: '🎒', desc: 'Temporary stay, limited access' },
  caregiver: { label: 'Caregiver', icon: '💚', desc: 'Support role with assigned permissions' },
  property_manager: { label: 'Property Manager', icon: '🏢', desc: 'Management access follows assigned permissions' },
  member: { label: 'Member', icon: '👤', desc: 'General household member' },
};

const HOME_TYPE_ICONS: Record<string, string> = {
  house: '🏡',
  apartment: '🏢',
  condo: '🏬',
  townhouse: '🏘️',
  studio: '🏠',
  room: '🚪',
  other: '🏠',
};

export default function InviteAcceptPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const { data, loading, failure, loggedIn: isLoggedIn, refresh, ready } = useInvitationPreview(token);
  const [errorSlot, setErrorSlot] = useState<{ message: string; current: () => boolean } | null>(null);
  const error = errorSlot?.current() ? errorSlot.message : '';
  const setError = (message: string, current = ready.current) => setErrorSlot(message && current ? { message, current } : null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [doneSlot, setDoneSlot] = useState<{ decision: 'accepted' | 'declined'; current: () => boolean } | null>(null);
  const done = doneSlot?.current() ? doneSlot.decision : null;

  const handleAccept = async () => {
    const current = ready.current;
    if (!current?.()) { void refresh(); return; }
    setAccepting(true);
    setError('');
    try {
      const result = await api.homes.acceptInviteByToken(token);
      if (!current()) return;
      if (result.homeId !== data?.home?.id || result.occupancy?.home_id !== result.homeId || !result.occupancy?.id) {
        throw new Error('The acceptance response could not be confirmed. Check My Homes for your current access.');
      }
      setDoneSlot({ decision: 'accepted', current });
    } catch {
      if (current()) setError('Acceptance could not be confirmed. Recheck the invitation and My Homes before trying again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    const current = ready.current;
    if (!current?.()) { void refresh(); return; }
    const yes = await confirmStore.open({ title: 'Decline invitation', description: 'Are you sure you want to decline this invitation?', confirmLabel: 'Decline', variant: 'destructive' });
    if (!yes || !current()) return;
    setDeclining(true);
    setError('');
    try {
      const result = await api.homes.declineInviteByToken(token);
      if (!current()) return;
      if (result.message !== 'Invitation declined') throw new Error('Invalid decline response');
      setDoneSlot({ decision: 'declined', current });
    } catch {
      if (current()) setError('Decline could not be confirmed. Recheck the invitation before trying again.');
    } finally {
      setDeclining(false);
    }
  };

  const handleLogin = () => {
    const next = encodeURIComponent(`/invite/${token}`);
    router.push(`/login?redirectTo=${next}`);
  };

  const handleSignUp = () => {
    const next = encodeURIComponent(`/invite/${token}`);
    router.push(`/register?redirectTo=${next}`);
  };

  // ==========================================
  //  RENDER
  // ==========================================

  if (loading) {
    return (
      <div className="min-h-screen bg-app-surface-raised flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-3 text-sm text-app-text-secondary">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Error state — no data at all
  if (!data && failure) {
    return (
      <div className="min-h-screen bg-app-surface-raised flex items-center justify-center p-4">
        <div className="bg-app-surface rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-semibold text-app-text mb-2">{failure.title}</h1>
          <p className="text-sm text-app-text-secondary mb-6">
            {failure.message}
          </p>
          <button type="button" onClick={() => void refresh()}
            className="block w-full mb-3 px-6 py-2.5 border border-app-border rounded-lg text-sm font-semibold">Retry</button>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const invite = data.invitation;
  const home = data.home;
  const inviter = data.inviter;
  const roleInfo = ROLE_LABELS[invite.proposed_role || 'member'] || ROLE_LABELS.member;
  const homeIcon = HOME_TYPE_ICONS[home?.home_type || 'other'] || '🏠';

  // Expired
  if (data.expired || invite.status === 'expired') {
    return (
      <div className="min-h-screen bg-app-surface-raised flex items-center justify-center p-4">
        <div className="bg-app-surface rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-semibold text-app-text mb-2">Invitation Expired</h1>
          <p className="text-sm text-app-text-secondary mb-6">
            This invitation has expired. Ask {inviter?.name || 'the host'} to send a new one.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Public terminal status proves no current account's household access.
  if (invite.status === 'accepted' || invite.status === 'revoked') {
    return (
      <div className="min-h-screen bg-app-surface-raised flex items-center justify-center p-4">
        <div className="bg-app-surface rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-app-text mb-2">
            {invite.status === 'accepted' ? 'Invitation already accepted' : 'Invitation closed'}
          </h1>
          <p className="text-sm text-app-text-secondary mb-6">
            {invite.status === 'accepted'
              ? 'This link has been accepted. If you accepted it, check My Homes for your current access.'
              : 'This invitation has been declined or withdrawn. Ask the household for a new invitation if needed.'}
          </p>
          <button onClick={() => isLoggedIn ? router.push('/app/homes') : handleLogin()}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold">
            {isLoggedIn ? 'My Homes' : 'Log In'}
          </button>
        </div>
      </div>
    );
  }

  // Done state — just accepted or declined
  if (done) {
    return (
      <div className="min-h-screen bg-app-surface-raised flex items-center justify-center p-4">
        <div className="bg-app-surface rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">{done === 'accepted' ? '🎉' : '👋'}</div>
          <h1 className="text-xl font-semibold text-app-text mb-2">
            {done === 'accepted' ? 'Acceptance recorded' : 'Invitation Declined'}
          </h1>
          <p className="text-sm text-app-text-secondary mb-6">
            {done === 'accepted'
              ? 'Your acceptance was saved. Check My Homes for current access; household permissions and access dates still apply.'
              : 'You\'ve declined this invitation. You can always ask for a new one later.'}
          </p>
          {done === 'accepted' ? (
            <button onClick={() => router.push('/app/homes')}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold">My Homes</button>
          ) : (
            <button
              onClick={() => router.push('/app')}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
            >
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  //  Main invitation card
  // ==========================================

  const daysLeft = invite.expires_at
    ? Math.max(0, Math.ceil((new Date(invite.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="min-h-screen bg-app-surface-raised flex items-center justify-center p-4">
      <div className="bg-app-surface rounded-2xl shadow-lg overflow-hidden max-w-md w-full">
        {/* Header */}
        <div className="bg-gray-900 px-8 pt-10 pb-8 text-center">
          <div className="text-4xl mb-3">{homeIcon}</div>
          <h1 className="text-xl font-bold text-white mb-1">You&apos;re Invited!</h1>
          <p className="text-sm text-gray-300">
            {inviter?.name || 'Someone'} wants you to join their home
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg mb-4">
              {error}
              <button type="button" onClick={() => { setError(''); setDoneSlot(null); void refresh(); }} className="block mt-3 font-semibold underline">Recheck invitation</button>
            </div>
          )}

          {/* Home card */}
          <div className="bg-app-surface-raised rounded-xl p-5 mb-5 border border-app-border-subtle">
            <div className="flex items-start gap-3">
              <div className="text-3xl flex-shrink-0">{homeIcon}</div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-app-text">{home?.name || 'A Home'}</h2>
                {home?.city && (
                  <p className="text-sm text-app-text-secondary mt-0.5">{home.city}</p>
                )}
              </div>
            </div>
          </div>

          {/* Inviter */}
          <div className="flex items-center gap-3 mb-5">
            {inviter?.profilePicture ? (
              <Image
                src={inviter.profilePicture}
                alt={inviter.name || 'Inviter'}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                {(inviter?.name || '?')[0].toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-app-text">Invited by {inviter?.name || 'Someone'}</div>
              {inviter?.username && (
                <div className="text-xs text-app-text-secondary">@{inviter.username}</div>
              )}
            </div>
          </div>

          {/* Role */}
          <div className="bg-blue-50 rounded-lg px-4 py-3 flex items-center gap-3 mb-5">
            <span className="text-xl">{roleInfo.icon}</span>
            <div>
              <div className="text-sm font-semibold text-blue-900">You&apos;ll join as: {roleInfo.label}</div>
              <div className="text-xs text-blue-700 mt-0.5">{roleInfo.desc}</div>
            </div>
          </div>

          <p className="text-sm text-app-text-secondary mb-5">
            Household permissions determine what you can open or manage. An invitation does not grant ownership.
          </p>
          {(invite.access_start_at || invite.access_end_at) && <p className="text-sm text-app-text-secondary mb-5">
            {invite.access_start_at && <>Access starts {new Date(invite.access_start_at).toLocaleString()}. </>}
            {invite.access_end_at && <>Access ends {new Date(invite.access_end_at).toLocaleString()}.</>}
          </p>}

          {/* Expiry */}
          {daysLeft !== null && (
            <p className="text-xs text-app-text-muted text-center mb-5">
              {daysLeft === 0
                ? 'This invitation expires today'
                : `This invitation expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
            </p>
          )}

          {/* Actions */}
          {isLoggedIn ? (
            <div className="space-y-3">
              <button
                onClick={handleAccept}
                disabled={accepting || declining || !!error}
                className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {accepting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Accepting...
                  </span>
                ) : (
                  '✓ Accept Invitation'
                )}
              </button>
              <button
                onClick={handleDecline}
                disabled={accepting || declining || !!error}
                className="w-full py-3 border border-app-border text-app-text-strong text-sm font-medium rounded-xl hover:bg-app-hover transition disabled:opacity-50"
              >
                {declining ? 'Declining...' : 'Decline'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-app-text-secondary text-center mb-2">
                Sign in to accept this invitation
              </p>
              <button
                onClick={handleLogin}
                className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition"
              >
                Log In to Review
              </button>
              <button
                onClick={handleSignUp}
                className="w-full py-3 border border-app-border text-app-text-strong text-sm font-medium rounded-xl hover:bg-app-hover transition"
              >
                Create Account to Review
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-app-border-subtle px-8 py-4 text-center">
          <p className="text-[11px] text-app-text-muted">
            Pantopus — Your household, organized.
          </p>
        </div>
      </div>
    </div>
  );
}
