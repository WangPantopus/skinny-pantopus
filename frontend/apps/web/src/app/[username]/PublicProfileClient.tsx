// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { buildUserProfileShareUrl } from '@pantopus/utils';
import type { UserProfile, User, GigListItem, Review } from '@pantopus/types';
import { getAuthToken } from '@pantopus/api';
import BusinessPublicProfile from '@/components/business/BusinessPublicProfile';
import { toast } from '@/components/ui/toast-store';
import ReportModal from '@/components/ui/ReportModal';
import ErrorState from '@/components/ui/ErrorState';
import { confirmStore } from '@/components/ui/confirm-store';
import { ProfileHeader, TabButton } from '@/components/profile/public';
import { ReliabilityPanel, AboutCard, SkillsCard } from '@/components/profile/public/cards';
import {
  OverviewTab,
  MissionsTab,
  PortfolioTab,
  ActivityTab,
  ReviewsTab,
  OwnerInsightsTab,
  OwnerSettingsTab,
} from '@/components/profile/public/tabs';
import type { PortfolioEntry } from '@/components/profile/public/tabs/PortfolioTab';
import { launchFeatures } from '@/lib/featureFlags';

type RelationshipState = 'none' | 'pending_sent' | 'pending_received' | 'connected' | 'blocked';
type ViewerContext = 'public' | 'neighborhood' | 'follower' | 'owner';
type ProfileTab = 'overview' | 'portfolio' | 'missions' | 'reviews' | 'activity' | 'insights' | 'settings';

/** Extended profile shape returned by the public profile API. */
type PublicProfileData = UserProfile & {
  residency?: {
    hasHome?: boolean;
    city?: string | null;
    state?: string | null;
    verified?: boolean;
  };
  account_type?: string;
  accountType?: string;
  verified?: boolean;
  typical_response_time?: string;
  response_time_label?: string;
  response_time_minutes?: number;
  dispute_count?: number;
  followers_count?: number;
};

/**
 * The public portfolio (GET /api/files/portfolio/:userId, the list the iOS and Android profiles show) as the tabs
 * show it: a photo (its medium thumbnail when there is one), a title and a description.
 */
function toPortfolioEntries(files: Array<Record<string, any>> | undefined): PortfolioEntry[] {
  return (files || []).map((file) => ({
    id: String(file.id),
    image_url: String(file.mime_type || '').startsWith('image/')
      ? file.metadata?.thumbnails?.medium || file.file_url || undefined
      : undefined,
    title: file.metadata?.title || undefined,
    description: file.metadata?.description || undefined,
  }));
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeProfileIdentifier(value: unknown): string {
  return String(value || '').trim().replace(/^@+/, '');
}

/** Pending review stub returned by the API (not a full Review). */
interface PendingReviewStub {
  gig_id: string;
  gig_title: string;
  reviewee_id: string;
  reviewee_name: string;
  reviewee_avatar: string | null;
  role: 'owner' | 'worker';
}

interface PublicProfileClientProps {
  username: string;
  initialProfile: PublicProfileData | null;
}

export default function PublicProfileClient({ username, initialProfile }: PublicProfileClientProps) {
  const router = useRouter();
  const profileIdentifier = normalizeProfileIdentifier(username);

  const [profile, setProfile] = useState<PublicProfileData | null>(initialProfile);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!initialProfile);
  // A failed read that is not a 404 must not claim the profile doesn't exist.
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [userGigs, setUserGigs] = useState<GigListItem[]>([]);
  const [gigsLoading, setGigsLoading] = useState(false);
  // null until the portfolio has loaded.
  const [portfolio, setPortfolio] = useState<PortfolioEntry[] | null>(null);
  const [portfolioFailed, setPortfolioFailed] = useState(false);
  const portfolioRequested = useRef<string | null>(null);
  const [userPosts, setUserPosts] = useState<Record<string, unknown>[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [ownerPreviewContext, setOwnerPreviewContext] = useState<ViewerContext>('owner');
  const [shareCopied, setShareCopied] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewStats, setReviewStats] = useState<{ average: number; total: number }>({ average: 0, total: 0 });
  const [pendingReview, setPendingReview] = useState<PendingReviewStub | null>(null);

  // Relationship state
  const [followState, setFollowState] = useState(false);
  const [connectionState, setConnectionState] = useState<RelationshipState>('none');
  // Connect shows only once the relationship is read, as in the apps: a failed read never offers it.
  const [connectionKnown, setConnectionKnown] = useState(false);
  // True when the viewer's personal block list could not be read: Follow
  // fails closed rather than offering an affordance the server may refuse.
  const [followUnavailable, setFollowUnavailable] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [reportTarget, setReportTarget] = useState<{ id: string; current: () => boolean } | null>(null);
  const actionGeneration = useRef(0);
  const pendingBlock = useRef(false);
  const pendingMessage = useRef(false);
  const target = useRef(profileIdentifier);
  target.current = profileIdentifier;
  const captureAction = useCallback(() => {
    const generation = actionGeneration.current;
    const identifier = profileIdentifier;
    const token = getAuthToken();
    const marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
    return () => generation === actionGeneration.current && identifier === target.current
      && token === getAuthToken() && marker === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
  }, [profileIdentifier]);

  const loadCurrentUser = useCallback(async () => {
    const current = captureAction();
    try {
      const token = getAuthToken();
      if (token) {
        const userData = await api.users.getMyProfile();
        if (!current()) return null;
        setCurrentUser(userData);
        return userData;
      }
    } catch (err) {
      console.error('Failed to load current user:', err);
    }
    return null;
  }, [captureAction]);

  useEffect(() => {
    // A route change reuses this component, so retire controls as well as callbacks.
    pendingBlock.current = false;
    setActionLoading(false);
    setReportTarget(null);
    setCurrentUser(null);
    setConnectionState('none');
    setFollowState(false);
    setFollowUnavailable(false);
    const invalidate = () => { actionGeneration.current++; };
    const retire = () => {
      invalidate(); pendingBlock.current = false;
      setReportTarget(null); setActionLoading(false); setCurrentUser(null);
      void loadCurrentUser();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) retire();
    };
    const unsubscribe = api.onTokenChange(retire);
    window.addEventListener('storage', storage);
    return () => { invalidate(); unsubscribe(); window.removeEventListener('storage', storage); };
  }, [loadCurrentUser]);

  const loadProfile = useCallback(async () => {
    const current = captureAction();
    setLoadFailed(false);
    try {
      const profileData = UUID_REGEX.test(profileIdentifier)
        ? await api.users.getProfileById(profileIdentifier)
        : await api.users.getProfileByUsername(profileIdentifier);
      if (!current()) return;
      setProfile(profileData as PublicProfileData);

      if (profileData.reviews && profileData.reviews.length > 0) {
        setReviews(profileData.reviews as unknown as Review[]);
        setReviewStats({
          average: profileData.average_rating || 0,
          total: profileData.review_count || profileData.reviews.length,
        });
      }
    } catch (err) {
      if (!current()) return;
      const ownProfile = await loadCurrentUser();
      if (!current()) return;
      const currentUsername = normalizeProfileIdentifier(ownProfile?.username);
      const isOwnProfileRoute = Boolean(
        ownProfile &&
        ((ownProfile.id && ownProfile.id === profileIdentifier) ||
          (currentUsername && currentUsername === profileIdentifier))
      );

      if (isOwnProfileRoute) {
        setProfile(ownProfile as PublicProfileData);
        return;
      }

      console.error('Failed to load profile:', err);
      if ((err as { statusCode?: number } | null)?.statusCode !== 404) setLoadFailed(true);
    } finally {
      if (current()) setLoading(false);
    }
  }, [loadCurrentUser, profileIdentifier, captureAction]);

  const loadRelationshipStatus = useCallback(async () => {
    if (!profile?.id) return;
    // N04 — personal UserBlock rows are separate from the Relationship graph
    // (GET /:id/relationship reports only the latter). Read the viewer's own
    // block list first, like the native clients, so a fresh profile load
    // never offers Follow for someone this account blocked; a failed read
    // fails closed.
    setConnectionKnown(false);
    try {
      const { blocked } = await api.blocks.getBlockedUsers();
      if ((blocked || []).some((entry) => entry.user_id === profile.id)) {
        setConnectionState('blocked');
        setFollowState(false);
        return;
      }
    } catch (err) {
      console.error('Failed to load blocked users:', err);
      setFollowUnavailable(true);
      toast.error('Couldn\'t verify block status. Actions are unavailable.');
      return;
    }
    try {
      const status = await api.users.getRelationshipStatus(profile.id);
      setFollowState(status.following);
      setConnectionState(status.relationship);
      setConnectionKnown(true);
    } catch (err) {
      console.error('Failed to load relationship status:', err);
    }
  }, [profile?.id]);

  const loadUserGigs = useCallback(async () => {
    if (!profile?.id) return;
    setGigsLoading(true);
    try {
      const response = await api.gigs.getGigs({ user_id: profile.id, limit: 20 });
      setUserGigs((response.gigs || []) as unknown as GigListItem[]);
    } catch (err) {
      console.error('Failed to load user gigs:', err);
      setUserGigs([]);
    } finally {
      setGigsLoading(false);
    }
  }, [profile?.id]);

  const loadPortfolio = useCallback(async () => {
    if (!profile?.id || portfolioRequested.current === profile.id) return;
    portfolioRequested.current = profile.id;
    setPortfolioFailed(false);
    try {
      const res = await api.files.getPortfolio(profile.id);
      setPortfolio(toPortfolioEntries(res.files as unknown as Array<Record<string, any>>));
    } catch (err) {
      console.error('Failed to load portfolio:', err);
      setPortfolioFailed(true);
      portfolioRequested.current = null; // the next visit to the tab tries again
    }
  }, [profile?.id]);

  const loadUserPosts = useCallback(async () => {
    if (!profile?.id) return;
    if (!getAuthToken()) {
      setUserPosts([]);
      return;
    }
    setPostsLoading(true);
    try {
      const res = await api.posts.getUserPosts(profile.id, { limit: 20 });
      setUserPosts((res.posts || []) as unknown as Record<string, unknown>[]);
    } catch (err) {
      console.error('Failed to load user posts:', err);
      setUserPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [profile?.id]);

  const loadReviews = useCallback(async () => {
    if (!profile?.id) return;
    setReviewsLoading(true);
    try {
      const res = await api.reviews.getUserReviews(profile.id, { limit: 50 });
      setReviews((res.reviews || []) as unknown as Review[]);
      setReviewStats({
        average: res.average_rating || 0,
        total: res.total || 0,
      });
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setReviewsLoading(false);
    }

    if (currentUser && currentUser.id !== profile?.id) {
      try {
        const pendingRes = await api.reviews.getPendingReviews();
        const match = (pendingRes.pending || []).find(
          (p: PendingReviewStub) => p.reviewee_id === profile.id
        );
        setPendingReview(match || null);
      } catch {
        // ignore
      }
    }
  }, [profile?.id, currentUser]);

  useEffect(() => {
    // Server-rendered initialProfile is already in state; only refetch
    // if we don't have one, or when username changes in-flight.
    setProfile(initialProfile);
    setLoading(!initialProfile);
    if (!initialProfile) {
      loadProfile();
    }
    loadCurrentUser();
  }, [profileIdentifier, loadProfile, loadCurrentUser, initialProfile]);

  useEffect(() => {
    // Launch cut #4 (Open Gigs): a person's open tasks are not shown, so not loaded.
    if (launchFeatures.openGigs && profile && ['overview', 'missions', 'activity'].includes(activeTab) && userGigs.length === 0) {
      loadUserGigs();
    }
    if (profile && ['overview', 'portfolio', 'insights'].includes(activeTab) && portfolio === null) {
      loadPortfolio();
    }
    if (profile && ['overview', 'activity'].includes(activeTab) && userPosts.length === 0) {
      loadUserPosts();
    }
    if (profile && (activeTab === 'overview' || activeTab === 'reviews')) {
      loadReviews();
    }
  }, [activeTab, profile, userGigs.length, userPosts.length, portfolio, loadUserGigs, loadPortfolio, loadUserPosts, loadReviews]);

  useEffect(() => {
    if (currentUser && profile && currentUser.id !== profile.id) {
      loadRelationshipStatus();
    }
  }, [currentUser, profile, loadRelationshipStatus]);

  // ── Action handlers ──

  const handleFollow = async () => {
    if (!currentUser) { router.push('/login'); return; }
    setActionLoading(true);
    try {
      if (followState) {
        await api.users.unfollowUser(profile!.id);
        setFollowState(false);
        setProfile((p) => p ? { ...p, followers_count: Math.max(0, (p.followers_count || 1) - 1) } : p);
      } else {
        await api.users.followUser(profile!.id);
        setFollowState(true);
        setProfile((p) => p ? { ...p, followers_count: (p.followers_count || 0) + 1 } : p);
      }
      loadUserPosts();
    } catch (err: unknown) {
      console.error('Follow error:', err);
      const status = (err as { statusCode?: number } | null)?.statusCode;
      toast.error(status === 403
        ? 'You can\'t follow this profile.'
        : (followState ? 'Couldn\'t unfollow.' : 'Couldn\'t follow.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Connect / Requested / Accept / Connected, as the apps' profile button: send a request, accept theirs, or remove
  // the connection after Connections' own confirmation.
  const handleConnect = async () => {
    if (!currentUser) { router.push('/login'); return; }
    const targetId = profile?.id;
    const state = connectionState;
    if (!targetId || state === 'pending_sent' || state === 'blocked') return;
    if (state === 'connected') {
      const yes = await confirmStore.open({ title: 'Remove this connection?', description: 'You can reconnect by sending a new request.', confirmLabel: 'Remove', variant: 'destructive' });
      if (!yes) return;
    }
    const current = captureAction();
    setActionLoading(true);
    try {
      if (state === 'none') {
        await api.relationships.sendRequest(targetId);
        if (current()) setConnectionState('pending_sent');
      } else if (state === 'pending_received') {
        const pending = await api.relationships.getPendingRequests();
        const request = (pending.requests || []).find((r) => r.requester?.id === targetId);
        if (!request?.id) throw new Error('This request is no longer pending.');
        await api.relationships.acceptRequest(request.id);
        if (current()) setConnectionState('connected');
      } else {
        const connected = await api.relationships.getConnections();
        const relationship = (connected.relationships || []).find((r) => r.other_user?.id === targetId);
        if (!relationship?.id) throw new Error('You\u2019re no longer connected.');
        await api.relationships.disconnect(relationship.id);
        if (current()) setConnectionState('none');
      }
    } catch (err: unknown) {
      if (current()) toast.error(err instanceof Error && err.message ? err.message : 'Couldn\u2019t update this connection. Try again.');
    } finally {
      if (current()) setActionLoading(false);
    }
  };

  const handleMessage = async () => {
    // The public profile can render before the viewer's profile read finishes.
    // The session marker already covers cookie auth; the chat endpoint verifies it.
    if (!getAuthToken()) { router.push('/login'); return; }
    const recipientId = profile?.id;
    if (!recipientId || pendingMessage.current) return;
    const current = captureAction();
    pendingMessage.current = true;
    try {
      const res = await api.chat.createDirectChat(recipientId) as Record<string, unknown>;
      if (!current()) return;
      const resRoom = res.room as Record<string, unknown> | undefined;
      const roomId = (res.roomId as string) || (resRoom?.id as string);
      if (roomId) {
        router.push(`/app/chat/conversation/${recipientId}`);
      } else {
        toast.error('Couldn\'t start a conversation. Try again.');
      }
    } catch (err: unknown) {
      if (!current()) return;
      console.error('Failed to create chat:', err);
      // The server's reason (e.g. "Unable to message this user", rate limits)
      // instead of a button that silently does nothing.
      const reason = err instanceof Error ? err.message.trim() : '';
      toast.error(reason || 'Couldn\'t start a conversation. Try again.');
    } finally {
      pendingMessage.current = false;
    }
  };

  /**
   * N04 — the personal block contract (`UserBlock`). This is the same
   * endpoint the iOS and Android Block actions call, and the only one
   * `backend/services/blockService.js` reads to refuse direct messages.
   * It is deliberately NOT the trust-graph block
   * (`POST /api/relationships/block-user`), which does not gate messaging.
   * The block is liftable from Settings -> Blocked Users.
   */
  const handleBlock = async () => {
    if (!currentUser) { router.push('/login'); return; }
    if (pendingBlock.current) return;
    pendingBlock.current = true;
    const current = captureAction();
    const targetId = profile!.id;
    const yes = await confirmStore.open({
      title: 'Block user',
      description:
        `Block ${fullName}? They won't be able to message you, and you won't ` +
        `see messages from them. They are not notified, and you can unblock ` +
        `them from Settings.`,
      confirmLabel: 'Block',
      variant: 'destructive',
    });
    if (!current()) return;
    if (!yes) { pendingBlock.current = false; return; }

    setActionLoading(true);
    try {
      await api.blocks.blockUser(targetId);
      if (!current()) return;
      // Mirrors the native clients: the connection edge drops to `blocked`
      // on the same success, which hides the Connect / Follow row.
      setConnectionState('blocked');
      setFollowState(false);
      toast.success(`${fullName} blocked`);
    } catch (err: unknown) {
      if (!current()) return;
      console.error('Block error:', err);
      toast.error('Couldn\'t block this user');
    } finally {
      if (current()) { pendingBlock.current = false; setActionLoading(false); }
    }
  };

  const handleReport = () => {
    if (!currentUser) { router.push('/login'); return; }
    setReportTarget({ id: profile!.id, current: captureAction() });
  };

  const submitReport = async (reason: string, details?: string) => {
    if (!reportTarget?.current()) throw new Error('Session changed');
    try {
      await api.users.reportUser(reportTarget.id, reason, details);
      if (reportTarget.current()) toast.success('Report submitted');
    } catch (error) {
      if (reportTarget.current()) toast.error('Couldn\'t submit your report. Please retry.');
      throw error;
    }
  };

  const handleRequestHire = () => {
    // Launch cut #4 (Open Gigs): "Request / Hire" opens the open-post composer.
    if (!launchFeatures.openGigs) return;
    if (!currentUser) {
      router.push('/login');
      return;
    }
    router.push(`/app/gigs/new?requestFor=${profile!.id}`);
  };

  const handleShare = async () => {
    try {
      const shareUrl = buildUserProfileShareUrl(username);
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `${fullName} on Pantopus`,
          text: `Check out ${fullName}'s profile on Pantopus`,
          url: shareUrl,
        });
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  // ── Loading / Error states ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-app-secondary">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile && loadFailed) {
    return (
      <ErrorState
        title="Couldn't load this profile"
        message="Check your connection and try again."
        onRetry={() => {
          setLoading(true);
          void loadProfile();
        }}
      />
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-app mb-2">Profile not found</h2>
          <p className="text-app-secondary mb-4">This user doesn&apos;t exist or has been removed.</p>
          <button
            onClick={() => router.push('/app')}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Business profiles get their own dedicated layout
  // The public profile routes send `accountType`.
  if ((profile.accountType ?? profile.account_type) === 'business') {
    return <BusinessPublicProfile username={username} currentUser={currentUser} />;
  }

  // ── Derived state ──

  const isOwnProfile = currentUser?.id === profile.id || currentUser?.username === profile.username;
  const fullName = profile.firstName && profile.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile.name || profile.username;

  const displayRating = reviewStats.average || profile.average_rating || 0;
  const displayReviewCount = reviewStats.total || profile.review_count || 0;
  const effectiveViewer: ViewerContext = isOwnProfile
    ? ownerPreviewContext
    : (connectionState === 'connected' ? 'follower' : 'public');

  const showOwnerOnly = effectiveViewer === 'owner';

  const trustBadges = [
    profile.address_verified ? { icon: '🏠', text: 'Address on file', color: 'green' } : null,
    profile.stripe_account_id ? { icon: '💳', text: 'Payment Verified', color: 'purple' } : null,
  ].filter(Boolean) as Array<{ icon: string; text: string; color: string }>;

  const featuredSkills = Array.isArray(profile.skills) ? profile.skills : [];
  // Only what the profile actually carries: no response time is recorded yet, so none is claimed.
  const responseTimeLabel =
    profile.typical_response_time ||
    profile.response_time_label ||
    (profile.response_time_minutes ? `${profile.response_time_minutes} min` : null);

  // Worker history: tasks done, no-shows and late cancels. The score (100 less 15 per no-show and 5 per late
  // cancel) starts at 100, so it only means something once there is history.
  const reliabilityScore = typeof profile.reliability_score === 'number' ? profile.reliability_score : null;
  const workerHistory = (profile.gigs_completed || 0) + (profile.no_show_count || 0) + (profile.late_cancel_count || 0);
  const hasReliabilityHistory = workerHistory > 0;
  const reliabilityLabel = !hasReliabilityHistory
    ? 'New (no history yet)'
    : reliabilityScore != null
      ? (reliabilityScore >= 90 ? 'Highly Reliable' : reliabilityScore >= 75 ? 'Reliable' : 'Needs Consistency')
      : 'No score yet';
  const reliabilityDetail = hasReliabilityHistory
    ? `From ${workerHistory} task${workerHistory === 1 ? '' : 's'} as worker`
    : 'No tasks as worker yet';

  const tabOptions: Array<{ key: ProfileTab; label: string; ownerOnly?: boolean }> = [
    // No Services tab: no account has services to list (the API sends none), as on iOS and Android.
    { key: 'overview', label: 'Overview' },
    { key: 'portfolio', label: 'Portfolio' },
    // Launch cut #4 (Open Gigs): the Missions (Gigs) tab is hidden.
    ...(launchFeatures.openGigs ? [{ key: 'missions' as const, label: 'Missions' }] : []),
    { key: 'reviews', label: `Reviews${displayReviewCount > 0 ? ` (${displayReviewCount})` : ''}` },
    { key: 'activity', label: 'Activity' },
    { key: 'insights', label: 'Insights', ownerOnly: true },
    { key: 'settings', label: 'Settings', ownerOnly: true },
  ];

  const residency = profile.residency;

  // ── Render ──

  return (
    <div className="bg-app min-h-screen pb-24 md:pb-8">
      <ReportModal
        key={`${profileIdentifier}:${actionGeneration.current}`}
        open={!!reportTarget && reportTarget.current()}
        onClose={() => setReportTarget(null)}
        onSubmit={submitReport}
        entityType="user"
      />
      <ProfileHeader
        profile={profile}
        fullName={fullName}
        residency={residency}
        showOwnerOnly={showOwnerOnly}
        ownerPreviewContext={ownerPreviewContext}
        onOwnerPreviewChange={setOwnerPreviewContext}
        trustBadges={trustBadges}
        displayRating={displayRating}
        displayReviewCount={displayReviewCount}
        responseTimeLabel={responseTimeLabel}
        reliabilityLabel={reliabilityLabel}
        reliabilityDetail={reliabilityDetail}
        followState={followState}
        canFollow={connectionState !== 'blocked' && !followUnavailable}
        connectionState={connectionState}
        canConnect={connectionKnown && connectionState !== 'blocked'}
        onConnect={handleConnect}
        actionLoading={actionLoading}
        shareCopied={shareCopied}
        onFollow={handleFollow}
        onMessage={handleMessage}
        onRequestHire={handleRequestHire}
        onShare={handleShare}
        onBlock={handleBlock}
        onReport={handleReport}
      />

      <div className="bg-surface border-b border-app mt-6">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 overflow-x-auto">
          <div role="tablist" aria-label="Profile" className="flex gap-6 min-w-max">
            {tabOptions
              .filter((tab) => !tab.ownerOnly || showOwnerOnly)
              .map((tab) => (
                <TabButton
                  key={tab.key}
                  label={tab.label}
                  active={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                />
              ))}
          </div>
        </div>
      </div>

      <main className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-6">
        {activeTab === 'overview' && (
          <OverviewTab
            profile={profile}
            portfolio={portfolio}
            portfolioFailed={portfolioFailed}
            skills={featuredSkills}
            reviews={reviews}
            userGigs={userGigs}
            gigsLoading={gigsLoading}
            onSkillRequest={handleRequestHire}
            onViewPortfolio={() => setActiveTab('portfolio')}
          />
        )}
        {activeTab === 'portfolio' && (
          <PortfolioTab items={portfolio} failed={portfolioFailed} isOwner={showOwnerOnly} />
        )}
        {activeTab === 'missions' && (
          <MissionsTab
            gigs={userGigs}
            loading={gigsLoading}
            completedCount={profile.gigs_completed || 0}
            postedCount={profile.gigs_posted || 0}
          />
        )}
        {activeTab === 'reviews' && (
          <ReviewsTab
            reviews={reviews}
            loading={reviewsLoading}
            stats={reviewStats}
            pendingReview={pendingReview}
            isOwnProfile={isOwnProfile}
            onReviewSubmitted={() => {
              setPendingReview(null);
              loadReviews();
              loadProfile();
            }}
          />
        )}
        {activeTab === 'activity' && (
          <ActivityTab
            gigs={userGigs}
            posts={userPosts}
            reviews={reviews}
            loading={gigsLoading || reviewsLoading || postsLoading}
          />
        )}
        {activeTab === 'insights' && showOwnerOnly && (
          <OwnerInsightsTab
            profile={profile}
            portfolio={portfolio}
            displayReviewCount={displayReviewCount}
            displayRating={displayRating}
          />
        )}
        {activeTab === 'settings' && showOwnerOnly && (
          <OwnerSettingsTab onOpenSettings={() => router.push('/app/profile/settings')} />
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
          <div className="space-y-4">
            <ReliabilityPanel profile={profile} reliabilityLabel={reliabilityLabel} reliabilityScore={hasReliabilityHistory ? reliabilityScore : null} />
          </div>
          <AboutCard profile={profile} residency={residency} />
          <SkillsCard skills={featuredSkills} onAction={showOwnerOnly ? () => router.push('/app/profile/edit') : handleRequestHire} ownerView={showOwnerOnly} />
        </div>
      </main>

      {!showOwnerOnly && (
        <div className="fixed bottom-[var(--fab-lift,0px)] left-0 right-0 md:hidden bg-surface border-t border-app p-3 z-30">
          {/* Launch cut #4 (Open Gigs): no "Request / Hire"; Message spans the bar. */}
          <div className={`max-w-lg mx-auto grid ${launchFeatures.openGigs ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
            <button onClick={handleMessage} className="px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium">Message</button>
            {launchFeatures.openGigs && <button onClick={handleRequestHire} className="px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium">Request / Hire</button>}
          </div>
        </div>
      )}
    </div>
  );
}
