'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { getAuthToken } from '@pantopus/api';
import * as api from '@pantopus/api';
import { confirmStore } from '@/components/ui/confirm-store';

type InviteData = {
  invitation: {
    id: string;
    status: string;
    proposed_role: string;
    invitee_email?: string;
    invitee_user_id?: string;
    expires_at: string;
    created_at: string;
  };
  home?: {
    id: string;
    name: string;
    city: string;
    home_type: string;
  };
  inviter?: {
    name: string;
    username: string;
    profilePicture?: string;
  };
  expired?: boolean;
  alreadyUsed?: boolean;
};

const ROLE_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  roommate: { label: 'Roommate', icon: '🏠', desc: 'Lives here, shares tasks & bills' },
  family: { label: 'Family', icon: '👨‍👩‍👧', desc: 'Family member in the household' },
  tenant: { label: 'Tenant', icon: '🔑', desc: 'Renter with full access' },
  guest: { label: 'Guest', icon: '🎒', desc: 'Temporary stay, limited access' },
  caregiver: { label: 'Caregiver', icon: '💚', desc: 'Helper with task access' },
  property_manager: { label: 'Property Manager', icon: '🏢', desc: 'Manages home settings' },
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

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InviteData | null>(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoggedIn = mounted && !!getAuthToken();

  useEffect(() => {
    loadInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadInvite = async () => {
    setLoading(true);
    try {
      const result = await api.homes.getInviteByToken(token);
      setData(result);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Invitation not found');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError('');
    try {
      const result = await api.homes.acceptInviteByToken(token);
      setDone('accepted');
      // Redirect to the home dashboard after a moment
      setTimeout(() => {
        router.push(`/app/homes/${result.homeId}/dashboard`);
      }, 2000);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    const yes = await confirmStore.open({ title: 'Decline invitation', description: 'Are you sure you want to decline this invitation?', confirmLabel: 'Decline', variant: 'destructive' });
    if (!yes) return;
    setDeclining(true);
    setError('');
    try {
      await api.homes.declineInviteByToken(token);
      setDone('declined');
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to decline invitation');
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
  if (!data && error) {
    return (
      <div className="min-h-screen bg-app-surface-raised flex items-center justify-center p-4">
        <div className="bg-app-surface rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-semibold text-app-text mb-2">Invitation Not Found</h1>
          <p className="text-sm text-app-text-secondary mb-6">
            This invitation link may be invalid or has already been used.
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

  if (!data) return null;

  const invite = data.invitation;
  const home = data.home;
  const inviter = data.inviter;
  const roleInfo = ROLE_LABELS[invite.proposed_role] || ROLE_LABELS.member;
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

  // Already used
  if (data.alreadyUsed || invite.status === 'accepted') {
    return (
      <div className="min-h-screen bg-app-surface-raised flex items-center justify-center p-4">
        <div className="bg-app-surface rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-semibold text-app-text mb-2">Already Accepted</h1>
          <p className="text-sm text-app-text-secondary mb-6">
            This invitation has already been accepted.
          </p>
          {isLoggedIn ? (
            <button
              onClick={() => router.push(home ? `/app/homes/${home.id}/dashboard` : '/app')}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
            >
              Go to Dashboard
            </button>
          ) : (
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
            >
              Log In
            </button>
          )}
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
            {done === 'accepted' ? 'Welcome to the household!' : 'Invitation Declined'}
          </h1>
          <p className="text-sm text-app-text-secondary mb-6">
            {done === 'accepted'
              ? `You're now a ${roleInfo.label.toLowerCase()} at ${home?.name || 'this home'}. Redirecting to your dashboard...`
              : 'You\'ve declined this invitation. You can always ask for a new one later.'}
          </p>
          {done === 'accepted' ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto" />
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
          <p className="text-sm text-app-text-muted">
            {inviter?.name || 'Someone'} wants you to join their home
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg mb-4">
              {error}
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
                alt={inviter.name}
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
                disabled={accepting || declining}
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
                disabled={accepting || declining}
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
                Log In & Accept
              </button>
              <button
                onClick={handleSignUp}
                className="w-full py-3 border border-app-border text-app-text-strong text-sm font-medium rounded-xl hover:bg-app-hover transition"
              >
                Create Account & Accept
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
