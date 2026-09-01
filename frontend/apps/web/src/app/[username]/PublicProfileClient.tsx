// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { buildUserProfileShareUrl } from '@pantopus/utils';
import type { UserProfile, User, GigListItem, Review } from '@pantopus/types';
import { getAuthToken } from '@pantopus/api';
import BusinessPublicProfile from '@/components/business/BusinessPublicProfile';
import { ProfileHeader, TabButton } from '@/components/profile/public';
import { ReliabilityPanel, AboutCard, SkillsCard } from '@/components/profile/public/cards';
import {
  OverviewTab,
  ServicesTab,
  MissionsTab,
  PortfolioTab,
  ActivityTab,
  ReviewsTab,
  OwnerInsightsTab,
  OwnerSettingsTab,
} from '@/components/profile/public/tabs';

type RelationshipState = 'none' | 'pending_sent' | 'pending_received' | 'connected' | 'blocked';
type ViewerContext = 'public' | 'neighborhood' | 'follower' | 'owner';
type ProfileTab = 'overview' | 'services' | 'portfolio' | 'missions' | 'reviews' | 'activity' | 'insights' | 'settings';

/** Extended profile shape returned by the public profile API. */
type PublicProfileData = UserProfile & {
  residency?: {
    hasHome?: boolean;
    city?: string | null;
    state?: string | null;
    verified?: boolean;
  };
  account_type?: string;
  services?: { id?: string; name?: string; title?: string; promise?: string; description?: string; from_price?: number; rate?: number; price?: number; availability?: string }[];
  availability?: string;
  verified?: boolean;
  typical_response_time?: string;
  response_time_label?: string;
  response_time_minutes?: number;
  dispute_count?: number;
  followers_count?: number;
};

type ServiceEntry = NonNullable<PublicProfileData['services']>[number] | string;

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
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [userGigs, setUserGigs] = useState<GigListItem[]>([]);
  const [gigsLoading, setGigsLoading] = useState(false);
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
  const [actionLoading, setActionLoading] = useState(false);

  const loadCurrentUser = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (token) {
        const userData = await api.users.getMyProfile();
        setCurrentUser(userData);
        return userData;
      }
    } catch (err) {
      console.error('Failed to load current user:', err);
    }
    return null;
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const profileData = UUID_REGEX.test(profileIdentifier)
        ? await api.users.getProfileById(profileIdentifier)
        : await api.users.getProfileByUsername(profileIdentifier);
      setProfile(profileData as PublicProfileData);

      if (profileData.reviews && profileData.reviews.length > 0) {
        setReviews(profileData.reviews as unknown as Review[]);
        setReviewStats({
          average: profileData.average_rating || 0,
          total: profileData.review_count || profileData.reviews.length,
        });
      }
    } catch (err) {
      const ownProfile = currentUser || await loadCurrentUser();
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
    } finally {
      setLoading(false);
    }
  }, [currentUser, loadCurrentUser, profileIdentifier]);

  const loadRelationshipStatus = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const status = await api.users.getRelationshipStatus(profile.id);
      setFollowState(status.following);
      setConnectionState(status.relationship);
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
    if (!initialProfile) {
      loadProfile();
    }
    loadCurrentUser();
  }, [profileIdentifier, loadProfile, loadCurrentUser, initialProfile]);

  useEffect(() => {
    if (profile && ['overview', 'services', 'missions', 'activity'].includes(activeTab) && userGigs.length === 0) {
      loadUserGigs();
    }
    if (profile && ['overview', 'activity'].includes(activeTab) && userPosts.length === 0) {
      loadUserPosts();
    }
    if (profile && (activeTab === 'overview' || activeTab === 'reviews')) {
      loadReviews();
    }
  }, [activeTab, profile, userGigs.length, userPosts.length, loadUserGigs, loadUserPosts, loadReviews]);

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
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!currentUser) { router.push('/login'); return; }
    try {
      const res = await api.chat.createDirectChat(profile!.id) as Record<string, unknown>;
      const resRoom = res.room as Record<string, unknown> | undefined;
      const roomId = (res.roomId as string) || (resRoom?.id as string);
      if (roomId) {
        router.push(`/app/chat?room=${roomId}`);
      }
    } catch (err: unknown) {
      console.error('Failed to create chat:', err);
    }
  };

  const handleRequestHire = () => {
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
  if (profile.account_type === 'business') {
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

  const normalizedServices = (() => {
    if (!Array.isArray(profile.services)) return [];
    return profile.services.slice(0, 3).map((service: ServiceEntry, idx: number) => {
      if (typeof service === 'string') {
        return {
          id: `service-${idx}`,
          name: service,
          promise: `Practical help with ${service.toLowerCase()}`,
          price: null,
          availability: profile.availability || 'Availability on request',
        };
      }
      return {
        id: service.id || `service-${idx}`,
        name: service.name || service.title || `Service ${idx + 1}`,
        promise: service.promise || service.description || 'Reliable neighborhood help',
        price: service.from_price || service.rate || service.price || null,
        availability: service.availability || profile.availability || 'Availability on request',
      };
    });
  })();

  const featuredSkills = Array.isArray(profile.skills) ? profile.skills : [];
  const responseTimeLabel =
    profile.typical_response_time ||
    profile.response_time_label ||
    (profile.response_time_minutes ? `${profile.response_time_minutes} min` : 'Usually within 24h');

  const reliabilityScore = typeof profile.reliability_score === 'number' ? profile.reliability_score : null;
  const hasReliabilityHistory =
    (profile.gigs_completed || 0) > 0 ||
    profile.no_show_count != null ||
    profile.late_cancel_count != null ||
    profile.dispute_count != null;
  const reliabilityLabel = !hasReliabilityHistory
    ? 'New (no history yet)'
    : reliabilityScore != null
      ? (reliabilityScore >= 90 ? 'Highly Reliable' : reliabilityScore >= 75 ? 'Reliable' : 'Needs Consistency')
      : 'Reliable';

  const tabOptions: Array<{ key: ProfileTab; label: string; ownerOnly?: boolean }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'services', label: 'Services' },
    { key: 'portfolio', label: 'Portfolio' },
    { key: 'missions', label: 'Missions' },
    { key: 'reviews', label: `Reviews${displayReviewCount > 0 ? ` (${displayReviewCount})` : ''}` },
    { key: 'activity', label: 'Activity' },
    { key: 'insights', label: 'Insights', ownerOnly: true },
    { key: 'settings', label: 'Settings', ownerOnly: true },
  ];

  const residency = profile.residency;

  // ── Render ──

  return (
    <div className="bg-app min-h-screen pb-24 md:pb-8">
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
        reliabilityScore={reliabilityScore}
        followState={followState}
        actionLoading={actionLoading}
        shareCopied={shareCopied}
        onFollow={handleFollow}
        onMessage={handleMessage}
        onRequestHire={handleRequestHire}
        onShare={handleShare}
      />

      <div className="bg-surface border-b border-app mt-6">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 overflow-x-auto">
          <div className="flex gap-6 min-w-max">
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
            services={normalizedServices}
            skills={featuredSkills}
            reviews={reviews}
            userGigs={userGigs}
            gigsLoading={gigsLoading}
            onRequest={handleRequestHire}
            onSkillRequest={handleRequestHire}
            onViewPortfolio={() => setActiveTab('portfolio')}
          />
        )}
        {activeTab === 'services' && (
          <ServicesTab
            services={normalizedServices}
            skills={featuredSkills}
            onRequest={handleRequestHire}
            isOwner={showOwnerOnly}
            onEdit={() => router.push('/app/profile/edit')}
          />
        )}
        {activeTab === 'portfolio' && <PortfolioTab profile={profile} />}
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
            displayReviewCount={displayReviewCount}
            displayRating={displayRating}
          />
        )}
        {activeTab === 'settings' && showOwnerOnly && (
          <OwnerSettingsTab onOpenSettings={() => router.push('/app/profile/settings')} />
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
          <div className="space-y-4">
            <ReliabilityPanel profile={profile} reliabilityLabel={reliabilityLabel} reliabilityScore={reliabilityScore} />
          </div>
          <AboutCard profile={profile} residency={residency} />
          <SkillsCard skills={featuredSkills} onAction={showOwnerOnly ? () => router.push('/app/profile/edit') : handleRequestHire} ownerView={showOwnerOnly} />
        </div>
      </main>

      {!showOwnerOnly && (
        <div className="fixed bottom-0 left-0 right-0 md:hidden bg-surface border-t border-app p-3 z-30">
          <div className="max-w-lg mx-auto grid grid-cols-2 gap-2">
            <button onClick={handleMessage} className="px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium">Message</button>
            <button onClick={handleRequestHire} className="px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium">Request / Hire</button>
          </div>
        </div>
      )}
    </div>
  );
}
