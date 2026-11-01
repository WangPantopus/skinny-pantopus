// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useId, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, Ellipsis, Eye, Pencil, Share, UserPlus } from 'lucide-react';
import * as api from '@pantopus/api';
import { buildUserProfileShareUrl, chosenUsername } from '@pantopus/utils';
import type { UserProfile, User, GigListItem, Review, Post } from '@pantopus/types';
import { getAuthToken } from '@pantopus/api';
import BusinessPublicProfile from '@/components/business/BusinessPublicProfile';
import { toast } from '@/components/ui/toast-store';
import ReportModal from '@/components/ui/ReportModal';
import ErrorState from '@/components/ui/ErrorState';
import { confirmStore } from '@/components/ui/confirm-store';
import { ConnectSheet, ProfileHeader, ProfileMenu, RelationshipActions, TabButton } from '@/components/profile/public';
import { firstWord, joinedRecently } from '@/components/profile/public/ProfileHeader';
import { buttonRow, primaryButton, secondaryButton } from '@/components/profile/public/profileButtons';
import { ReliabilityPanel } from '@/components/profile/public/cards';
import { AboutTab, MissionsTab, PostsTab, WorkTab } from '@/components/profile/public/tabs';
import type { PortfolioEntry } from '@/components/profile/public/tabs/PortfolioTab';
import { launchFeatures } from '@/lib/featureFlags';
import { authPageHref } from '@/lib/auth-utils';
import UsernamePrompt, { markAskedForUsername, shouldAskForUsername } from '@/components/profile/UsernamePrompt';
import { fetchMe } from '@/lib/me';
import { queryKeys } from '@/lib/query-keys';

type RelationshipState = 'none' | 'pending_sent' | 'pending_received' | 'connected' | 'blocked';
type ViewerContext = 'public' | 'neighborhood' | 'follower' | 'owner';

// The audiences your own profile can be previewed as, named as the people in them.
const OWNER_PREVIEW_LABELS: Record<Exclude<ViewerContext, 'owner'>, string> = {
  public: 'Anyone with the link',
  neighborhood: 'Neighbors',
  follower: 'Your connections',
};
const OWNER_PREVIEW_DETAILS: Record<Exclude<ViewerContext, 'owner'>, string> = {
  public: 'People who aren’t signed in, like someone you text your link to.',
  neighborhood: 'People on Pantopus you aren’t connected to.',
  follower: 'They also see posts you shared only with connections.',
};
type ProfileTab = 'posts' | 'about' | 'work' | 'missions';

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

// Other people's profiles (Instant Screens contract §4): what a person shares (portfolio, posts, reviews) and
// your pending review of them stay fresh in this session's memory for 5 minutes, so coming back shows them at
// once and asks again only after that, or after your own follow, connection, block or review. Your relationship
// and block list are read on every visit, as in the apps: they decide which actions show.
const PEOPLE_FRESH_MS = 5 * 60 * 1000;
const POSTS_PAGE = 20;

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
  // Next reuses this route's component. A different person must get fresh tab,
  // review, portfolio and dialog state, including while their requests are pending.
  return <ProfileContent key={normalizeProfileIdentifier(username)} username={username} initialProfile={initialProfile} />;
}

function ProfileContent({ username, initialProfile }: PublicProfileClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tabsId = useId();
  const profileIdentifier = normalizeProfileIdentifier(username);
  // What you saw of this person last time, for the first frame.
  const [kept] = useState(() => {
    const id = initialProfile?.id;
    return id ? {
      portfolio: queryClient.getQueryData(queryKeys.personPortfolio(id)),
      posts: queryClient.getQueryData(queryKeys.personPosts(id)),
      reviews: queryClient.getQueryData(queryKeys.personReviews(id)),
    } : {};
  });
  const read = useCallback((queryKey, queryFn) =>
    queryClient.fetchQuery({ queryKey, queryFn, staleTime: PEOPLE_FRESH_MS }), [queryClient]);
  const forgetPerson = useCallback((id) => {
    if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.person(id) });
  }, [queryClient]);

  const [profile, setProfile] = useState<PublicProfileData | null>(initialProfile);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!initialProfile);
  // A failed read that is not a 404 must not claim the profile doesn't exist.
  const [loadFailed, setLoadFailed] = useState(false);
  const [profileRestricted, setProfileRestricted] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [userGigs, setUserGigs] = useState<GigListItem[]>([]);
  const [gigsLoading, setGigsLoading] = useState(false);
  // null until the portfolio has loaded.
  const [portfolio, setPortfolio] = useState<PortfolioEntry[] | null>(() => kept.portfolio ? toPortfolioEntries(kept.portfolio.files) : null);
  const portfolioRequested = useRef<string | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>(() => kept.posts?.posts || []);
  // More posts than the first page: the tab offers the rest and leaves the count off.
  const [postsHasMore, setPostsHasMore] = useState<boolean>(() => Boolean(kept.posts?.pagination?.hasMore));
  const [postsMoreLoading, setPostsMoreLoading] = useState(false);
  // Posts are requested once per profile, reviews once per profile and viewer (the pending-review
  // check needs the viewer); the load effect re-runs on every profile or portfolio update.
  const postsRequested = useRef<string | null>(null);
  const postsReadGeneration = useRef(0);
  const reviewsRequested = useRef<string | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsFailed, setPostsFailed] = useState(false);
  const [ownerPreviewContext, setOwnerPreviewContext] = useState<ViewerContext>('owner');
  // Settings → How neighbors see you links here with ?preview=public: your own profile opens as others see it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('preview') === 'public') setOwnerPreviewContext('public');
  }, []);
  // Back to your own view, and off the link's ?preview=public so a reload stays there.
  const leaveOwnerPreview = () => {
    setOwnerPreviewContext('owner');
    const params = new URLSearchParams(window.location.search);
    if (!params.has('preview')) return;
    params.delete('preview');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  };
  const [shareCopied, setShareCopied] = useState(false);
  // Sharing your own profile while its link still has the made-up username asks once for a real one.
  const [usernamePromptOpen, setUsernamePromptOpen] = useState(false);
  // The session is readable only in the browser, so the server and the first frame draw the header alone; the
  // actions and posts follow once it is known (signed out never flashes for someone signed in, or the reverse).
  const [mounted, setMounted] = useState(false);
  // A signed-in viewer is read before any action shows: until then nobody knows whether this is their own profile
  // (yours never offers Message or Connect).
  const [viewerChecked, setViewerChecked] = useState(false);
  // Back appears only when there is somewhere in this tab to go back to (not on a shared link opened fresh).
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => {
    setMounted(true);
    setCanGoBack(window.history.length > 1);
  }, []);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>(() => kept.reviews?.reviews || []);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewStats, setReviewStats] = useState<{ average: number; total: number }>(() => ({
    average: kept.reviews?.average_rating || 0, total: kept.reviews?.total || 0,
  }));
  const [pendingReview, setPendingReview] = useState<PendingReviewStub | null>(null);

  // Relationship state
  const [followState, setFollowState] = useState(false);
  const [connectionState, setConnectionState] = useState<RelationshipState>('none');
  // The viewer's own block (UserBlock) of this person: the menu offers Unblock instead of Block.
  const [blockedByMe, setBlockedByMe] = useState(false);
  // Connect shows only once the relationship is read, as in the apps: a failed read never offers it.
  const [connectionKnown, setConnectionKnown] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  // True when the viewer's personal block list could not be read: Follow
  // fails closed rather than offering an affordance the server may refuse.
  const [followUnavailable, setFollowUnavailable] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

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
        const userData = await fetchMe();
        if (!current()) return null;
        setCurrentUser(userData);
        return userData;
      }
    } catch (err) {
      console.error('Failed to load current user:', err);
    } finally {
      if (current()) setViewerChecked(true);
    }
    return null;
  }, [captureAction]);

  useEffect(() => {
    // A route change reuses this component, so retire controls as well as callbacks.
    pendingBlock.current = false;
    setActionLoading(false);
    setReportTarget(null);
    setConnectOpen(false);
    setCurrentUser(null);
    setConnectionState('none');
    setFollowState(false);
    setFollowUnavailable(false);
    const invalidate = () => { actionGeneration.current++; };
    const retire = () => {
      invalidate(); pendingBlock.current = false;
      setReportTarget(null); setConnectOpen(false); setActionLoading(false); setCurrentUser(null); setViewerChecked(false);
      postsRequested.current = null; // the new session sees the posts it may see
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
    setProfileRestricted(false);
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
      const status = (err as { statusCode?: number } | null)?.statusCode;
      if (status === 403 || status === 404) {
        // A previously rendered profile must disappear when access is refused.
        setProfile(null);
        setProfileRestricted(status === 403);
      } else {
        setLoadFailed(true);
      }
    } finally {
      if (current()) setLoading(false);
    }
  }, [loadCurrentUser, profileIdentifier, captureAction]);

  const loadRelationshipStatus = useCallback(async () => {
    if (!profile?.id) return;
    const current = captureAction();
    // N04 — personal UserBlock rows are separate from the Relationship graph
    // (GET /:id/relationship reports only the latter). Read the viewer's own
    // block list first, like the native clients, so a fresh profile load
    // never offers Follow for someone this account blocked; a failed read
    // fails closed.
    setConnectionKnown(false);
    setConnectionFailed(false);
    try {
      const { blocked } = await api.blocks.getBlockedUsers();
      if (!current()) return;
      setFollowUnavailable(false);
      const blockedHere = (blocked || []).some((entry) => entry.user_id === profile.id);
      setBlockedByMe(blockedHere);
      if (blockedHere) {
        setConnectionState('blocked');
        setFollowState(false);
        return;
      }
    } catch (err) {
      if (!current()) return;
      console.error('Failed to load blocked users:', err);
      setFollowUnavailable(true);
      setConnectionFailed(true);
      toast.error('Couldn\'t verify block status. Actions are unavailable.');
      return;
    }
    try {
      const status = await api.users.getRelationshipStatus(profile.id);
      if (!current()) return;
      setFollowState(status.following);
      setConnectionState(status.relationship);
      setConnectionKnown(true);
    } catch (err) {
      console.error('Failed to load relationship status:', err);
      if (current()) setConnectionFailed(true);
    }
  }, [profile?.id, captureAction]);

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
    const id = profile.id;
    portfolioRequested.current = id;
    try {
      const res = await read(queryKeys.personPortfolio(id), () => api.files.getPortfolio(id));
      setPortfolio(toPortfolioEntries(res.files as unknown as Array<Record<string, any>>));
    } catch (err) {
      console.error('Failed to load portfolio:', err);
      // A failed read keeps what's shown; with nothing kept the Work tab simply leaves the portfolio out.
      if (queryClient.getQueryData(queryKeys.personPortfolio(id)) === undefined) setPortfolio(null);
      portfolioRequested.current = null; // the next visit tries again
    }
  }, [profile?.id, read, queryClient]);

  const loadUserPosts = useCallback(async () => {
    if (!profile?.id) return;
    const actionCurrent = captureAction();
    const generation = ++postsReadGeneration.current;
    const current = () => actionCurrent() && generation === postsReadGeneration.current;
    if (!getAuthToken()) {
      setUserPosts([]);
      setPostsHasMore(false);
      return;
    }
    const id = profile.id;
    const key = queryKeys.personPosts(id);
    setPostsFailed(false);
    if (queryClient.getQueryData(key) === undefined) setPostsLoading(true);
    try {
      const res = await read(key, () => api.posts.getUserPosts(id, { limit: POSTS_PAGE }));
      if (!current()) return;
      setUserPosts(res.posts || []);
      setPostsHasMore(Boolean(res.pagination?.hasMore));
    } catch (err) {
      if (!current()) return;
      console.error('Failed to load user posts:', err);
      if (queryClient.getQueryData(key) === undefined) { setUserPosts([]); setPostsHasMore(false); setPostsFailed(true); }
      postsRequested.current = null; // the next visit to the tab tries again
    } finally {
      if (current()) setPostsLoading(false);
    }
  }, [profile?.id, read, queryClient, captureAction]);

  /** The next page of posts, after the last one shown. */
  const loadMorePosts = async () => {
    const last = userPosts[userPosts.length - 1];
    if (!profile?.id || !last || postsMoreLoading) return;
    const actionCurrent = captureAction();
    const generation = postsReadGeneration.current;
    const current = () => actionCurrent() && generation === postsReadGeneration.current;
    setPostsMoreLoading(true);
    try {
      const res = await api.posts.getUserPosts(profile.id, { limit: POSTS_PAGE, cursorCreatedAt: last.created_at, cursorId: last.id });
      if (!current()) return;
      setUserPosts((prev) => [...prev, ...(res.posts || []).filter((post) => !prev.some((p) => p.id === post.id))]);
      setPostsHasMore(Boolean(res.pagination?.hasMore));
    } catch {
      if (current()) toast.error('Couldn’t load more posts. Try again.');
    } finally {
      if (current()) setPostsMoreLoading(false);
    }
  };

  const loadReviews = useCallback(async () => {
    if (!profile?.id) return;
    const id = profile.id;
    if (queryClient.getQueryData(queryKeys.personReviews(id)) === undefined) setReviewsLoading(true);
    try {
      const res = await read(queryKeys.personReviews(id), () => api.reviews.getUserReviews(id, { limit: 50 }));
      setReviews((res.reviews || []) as unknown as Review[]);
      setReviewStats({
        average: res.average_rating || 0,
        total: res.total || 0,
      });
    } catch (err) {
      console.error('Failed to load reviews:', err);
      reviewsRequested.current = null; // the next visit tries again
    } finally {
      setReviewsLoading(false);
    }

    if (currentUser && currentUser.id !== profile?.id) {
      try {
        const pendingRes = await read(queryKeys.myPendingReviews(), () => api.reviews.getPendingReviews());
        const match = (pendingRes.pending || []).find(
          (p: PendingReviewStub) => p.reviewee_id === profile.id
        );
        setPendingReview(match || null);
      } catch {
        // ignore
      }
    }
  }, [profile?.id, currentUser, read, queryClient]);

  useEffect(() => {
    // The server preview is anonymous. A signed-in viewer needs their own
    // access check (including blocks), even when that preview succeeded.
    setProfile(initialProfile);
    setLoading(!initialProfile);
    const current = captureAction();
    void loadCurrentUser().then((viewer) => {
      if (!current()) return;
      // Keep the anonymous projection for the owner's "How neighbors see
      // you" preview; their account fields come from currentUser separately.
      if (!initialProfile || (getAuthToken() && viewer?.id !== initialProfile.id)) {
        setProfile(null);
        setLoading(true);
        void loadProfile();
      }
    });
  }, [profileIdentifier, loadProfile, loadCurrentUser, initialProfile, captureAction]);

  useEffect(() => {
    // Posts open first; the portfolio and reviews decide whether there is a Work tab, so they load with the page.
    if (profile && postsRequested.current !== profile.id) {
      postsRequested.current = profile.id;
      loadUserPosts();
    }
    if (profile && portfolioRequested.current !== profile.id) {
      loadPortfolio();
    }
    const reviewsKey = profile ? `${profile.id}:${currentUser?.id ?? ''}` : null;
    if (profile && reviewsRequested.current !== reviewsKey) {
      reviewsRequested.current = reviewsKey;
      loadReviews();
    }
    // Launch cut #4 (Open Gigs): a person's open tasks are not shown, so not loaded.
    if (launchFeatures.openGigs && profile && activeTab === 'missions' && userGigs.length === 0) {
      loadUserGigs();
    }
  }, [activeTab, profile, currentUser?.id, userGigs.length, portfolio, loadUserGigs, loadPortfolio, loadUserPosts, loadReviews]);

  useEffect(() => {
    if (currentUser && profile && currentUser.id !== profile.id) {
      loadRelationshipStatus();
    }
  }, [currentUser, profile, loadRelationshipStatus]);

  // ── Action handlers ──

  const handleFollow = async () => {
    if (!currentUser) { router.push('/login'); return; }
    const current = captureAction();
    const targetId = profile!.id;
    // A stray click on Unfollow never unfollows: it asks first, as Disconnect does.
    if (followState) {
      const yes = await confirmStore.open({
        title: `Unfollow ${fullName}?`,
        description: 'They won\'t be notified.',
        confirmLabel: 'Unfollow',
        variant: 'destructive',
      });
      if (!yes || !current()) return;
    }
    setActionLoading(true);
    try {
      if (followState) {
        await api.users.unfollowUser(targetId);
        if (!current()) return;
        setFollowState(false);
      } else {
        await api.users.followUser(targetId);
        if (!current()) return;
        setFollowState(true);
        toast.success(`You follow ${firstName}’s public posts.`);
      }
      forgetPerson(targetId);
      loadUserPosts();
    } catch (err: unknown) {
      if (!current()) return;
      console.error('Follow error:', err);
      const status = (err as { statusCode?: number } | null)?.statusCode;
      toast.error(status === 403
        ? 'You can\'t follow this profile.'
        : (followState ? 'Couldn\'t unfollow.' : 'Couldn\'t follow.'));
    } finally {
      if (current()) setActionLoading(false);
    }
  };

  /** "Just follow" in the Connect sheet: true once following. */
  const followFromSheet = async (): Promise<boolean> => {
    if (!currentUser || !profile?.id) return false;
    const current = captureAction();
    const targetId = profile.id;
    try {
      await api.users.followUser(targetId);
      if (!current()) return false;
      setFollowState(true);
      forgetPerson(targetId);
      toast.success(`You follow ${firstName}’s public posts.`);
      return true;
    } catch (err: unknown) {
      if (!current()) return false;
      const status = (err as { statusCode?: number } | null)?.statusCode;
      toast.error(status === 403 ? 'You can\'t follow this profile.' : 'Couldn\'t follow. Try again.');
      return false;
    }
  };

  /** Send request from the Connect sheet, with the note when there is one: true once sent. */
  const sendConnectRequest = async (note: string): Promise<boolean> => {
    if (!currentUser || !profile?.id) return false;
    const current = captureAction();
    const targetId = profile.id;
    setActionLoading(true);
    try {
      await api.relationships.sendRequest(targetId, note || undefined);
      if (!current()) return false;
      setConnectionState('pending_sent');
      forgetPerson(targetId);
      toast.success(`Request sent. ${firstName} approves it first.`);
      return true;
    } catch (err: unknown) {
      if (!current()) return false;
      toast.error(err instanceof Error && err.message ? err.message : 'Couldn’t send your request. Try again.');
      return false;
    } finally {
      if (current()) setActionLoading(false);
    }
  };

  // Connection membership changes which posts and fields the server permits. Drop the previous audience's copy
  // before asking again, including offline.
  const reloadAsNewAudience = async (targetId: string, current: () => boolean) => {
    postsReadGeneration.current++;
    setUserPosts([]);
    setProfile(null);
    setLoading(true);
    await queryClient.cancelQueries({ queryKey: queryKeys.personPosts(targetId) });
    queryClient.removeQueries({ queryKey: queryKeys.personPosts(targetId) });
    if (current()) await Promise.all([loadProfile(), loadUserPosts()]);
  };

  /** Requested → withdraw your request, after a confirm. */
  const handleWithdraw = async () => {
    if (!currentUser || !profile?.id) return;
    const targetId = profile.id;
    const current = captureAction();
    const yes = await confirmStore.open({
      title: 'Withdraw your request?',
      description: `${firstName} won’t be told. You can send a new one later.`,
      confirmLabel: 'Withdraw',
      variant: 'destructive',
    });
    if (!yes || !current()) return;
    setActionLoading(true);
    try {
      const sent = await api.relationships.getSentRequests();
      if (!current()) return;
      const request = (sent.requests || []).find((r) => r.addressee?.id === targetId);
      if (request?.id) await api.relationships.disconnect(request.id);
      if (!current()) return;
      setConnectionState('none');
      forgetPerson(targetId);
    } catch (err: unknown) {
      if (current()) toast.error(err instanceof Error && err.message ? err.message : 'Couldn’t withdraw your request. Try again.');
    } finally {
      if (current()) setActionLoading(false);
    }
  };

  /** The request they sent you: Accept, or Not now (it is declined; they can ask again). */
  const answerRequest = async (accept: boolean) => {
    if (!currentUser || !profile?.id) return;
    const targetId = profile.id;
    const current = captureAction();
    setActionLoading(true);
    try {
      const pending = await api.relationships.getPendingRequests();
      if (!current()) return;
      const request = (pending.requests || []).find((r) => r.requester?.id === targetId);
      if (!request?.id) throw new Error('This request is no longer pending.');
      if (accept) await api.relationships.acceptRequest(request.id);
      else await api.relationships.rejectRequest(request.id);
      if (!current()) return;
      setConnectionState(accept ? 'connected' : 'none');
      forgetPerson(targetId);
      if (accept) {
        // A connection sees more: read the profile and posts again as one (the new profile also rereads the
        // relationship, follow included).
        await queryClient.cancelQueries({ queryKey: queryKeys.personPosts(targetId) });
        queryClient.removeQueries({ queryKey: queryKeys.personPosts(targetId) });
        if (current()) await Promise.all([loadProfile(), loadUserPosts()]);
      }
    } catch (err: unknown) {
      if (current()) toast.error(err instanceof Error && err.message ? err.message : 'Couldn’t answer this request. Try again.');
    } finally {
      if (current()) setActionLoading(false);
    }
  };

  /** Connected ▾ → Disconnect, after a confirm; whatever only connections see leaves the page at once. */
  const handleDisconnect = async () => {
    if (!currentUser || !profile?.id) return;
    const targetId = profile.id;
    const current = captureAction();
    const yes = await confirmStore.open({
      title: `Disconnect from ${firstName}?`,
      description: 'You’ll stop seeing each other’s connections-only posts. They aren’t notified. You can reconnect by sending a new request.',
      confirmLabel: 'Disconnect',
      variant: 'destructive',
    });
    if (!yes || !current()) return;
    setActionLoading(true);
    try {
      const connected = await api.relationships.getConnections();
      if (!current()) return;
      const relationship = (connected.relationships || []).find((r) => r.other_user?.id === targetId);
      if (!relationship?.id) throw new Error('You’re no longer connected.');
      await api.relationships.disconnect(relationship.id);
      if (!current()) return;
      setConnectionState('none');
      forgetPerson(targetId);
      await reloadAsNewAudience(targetId, current);
    } catch (err: unknown) {
      if (current()) toast.error(err instanceof Error && err.message ? err.message : 'Couldn’t update this connection. Try again.');
    } finally {
      if (current()) setActionLoading(false);
    }
  };

  const handleMessage = async () => {
    // The public profile can render before the viewer's profile read finishes.
    // The session marker already covers cookie auth; the chat endpoint verifies it.
    if (!getAuthToken()) { router.push(signInHref); return; }
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
   * The block is liftable from this profile's menu (Unblock) or Settings -> Blocked Users.
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
        `Block ${fullName}? You won't be able to message each other or see ` +
        `each other's posts. They aren't notified, and you can unblock ` +
        `them from Settings.`,
      confirmLabel: 'Block',
      variant: 'destructive',
    });
    if (!current()) return;
    if (!yes) { pendingBlock.current = false; return; }

    setActionLoading(true);
    try {
      await api.blocks.blockUser(targetId);
      forgetPerson(targetId);
      if (!current()) return;
      // Mirrors the native clients: the connection edge drops to `blocked`
      // on the same success, which hides Connect, Message and Follow.
      setConnectionState('blocked');
      setFollowState(false);
      setBlockedByMe(true);
      setConnectOpen(false);
      // Nothing of theirs stays on the page: the posts list empties at once.
      postsReadGeneration.current++;
      setUserPosts([]);
      queryClient.removeQueries({ queryKey: queryKeys.personPosts(targetId) });
      toast.success(`${fullName} blocked`);
    } catch (err: unknown) {
      if (!current()) return;
      console.error('Block error:', err);
      toast.error('Couldn\'t block this user');
    } finally {
      if (current()) { pendingBlock.current = false; setActionLoading(false); }
    }
  };

  /** Lifts the viewer's own block, as Settings → Blocked users does, then reads the relationship and posts again. */
  const handleUnblock = async () => {
    if (!currentUser) { router.push('/login'); return; }
    if (pendingBlock.current) return;
    pendingBlock.current = true;
    const current = captureAction();
    const targetId = profile!.id;
    const yes = await confirmStore.open({
      title: 'Unblock user',
      description:
        `Unblock ${fullName}? You'll be able to see each other's posts and message each other again. ` +
        `They aren't notified.`,
      confirmLabel: 'Unblock',
    });
    if (!current()) return;
    if (!yes) { pendingBlock.current = false; return; }

    setActionLoading(true);
    try {
      await api.blocks.unblockUser(targetId);
      forgetPerson(targetId);
      if (!current()) return;
      setBlockedByMe(false);
      toast.success(`${fullName} unblocked`);
      await loadRelationshipStatus();
      loadUserPosts();
    } catch (err: unknown) {
      if (!current()) return;
      console.error('Unblock error:', err);
      toast.error('Couldn\'t unblock this user');
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

  /** Share or copy the profile link; false when neither worked (the browser refused both). */
  const shareProfileLink = async (linkUsername: string): Promise<boolean> => {
    const shareUrl = buildUserProfileShareUrl(linkUsername);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `${fullName} on Pantopus`,
          text: `Check out ${fullName}'s profile on Pantopus`,
          url: shareUrl,
        });
        return true;
      }
    } catch (err) {
      // Dismissed, or not allowed after the username dialog: copying the link still works.
      if ((err as { name?: string } | null)?.name === 'AbortError') return true;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
        toast.success('Link copied');
        setTimeout(() => setShareCopied(false), 2000);
        return true;
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
    toast.error('Couldn’t share the link. Try again.');
    return false;
  };

  const handleShare = async () => {
    const ownProfile = Boolean(currentUser && profile && currentUser.id === profile.id);
    if (ownProfile && shouldAskForUsername(currentUser)) {
      markAskedForUsername(String(currentUser!.id));
      setUsernamePromptOpen(true);
      return;
    }
    await shareProfileLink(username);
  };

  // Where Sign in and Join bring someone back to: this profile.
  const profilePath = typeof window === 'undefined' ? `/${profileIdentifier}` : window.location.pathname;
  const signInHref = authPageHref('/login', profilePath);

  // ── Loading / Error states ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" aria-hidden="true"></div>
          <p className="mt-4 text-app-secondary">Loading profile…</p>
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
      <div className="flex items-center justify-center py-20 px-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-app mb-2">{profileRestricted ? 'Profile unavailable' : 'Profile not found'}</h1>
          <p className="text-app-secondary mb-4">
            {profileRestricted ? "This profile isn't visible to your account." : "This user doesn't exist or has been removed."}
          </p>
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
  const signedIn = mounted && (Boolean(currentUser) || Boolean(getAuthToken()));
  // Who is looking is known: signed out, or the signed-in account has been read.
  const viewerReady = mounted && (!signedIn || viewerChecked);
  const previewing = isOwnProfile && ownerPreviewContext !== 'owner';
  const showOwnerOnly = isOwnProfile && !previewing;
  // Anyone with the link: what someone who isn't signed in sees (and the owner's preview of it).
  const anyoneView = mounted && (!signedIn || (previewing && ownerPreviewContext === 'public'));
  // The page is read signed out, which names the person as other people see them: by their Local Profile's name,
  // handle and photo. The owner's own view keeps their account's, as in the apps; Preview shows the others' view.
  const shownProfile: PublicProfileData = showOwnerOnly && currentUser?.id === profile.id
    ? {
      ...profile,
      username: currentUser.username,
      usernameIsGenerated: currentUser.usernameIsGenerated,
      name: currentUser.name,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      profile_picture_url: currentUser.profile_picture_url,
      profilePicture: currentUser.profilePicture,
      avatar_url: currentUser.avatar_url,
    }
    : profile;
  // The server says when the username was made up (user_…, or the pre-October-7 kind built from the email).
  const chosenHandle = shownProfile.usernameIsGenerated ? null : chosenUsername(shownProfile.username);
  const realName = shownProfile.firstName && shownProfile.lastName
    ? `${shownProfile.firstName} ${shownProfile.lastName}`
    : shownProfile.name || chosenHandle;
  const fullName = realName || 'Pantopus member';
  // Other people get no first name, so "Connect with …" uses the name's first word, as the apps do.
  const shownFirstName = realName ? firstWord(realName) : null;
  const firstName = shownFirstName || 'this neighbor';
  const photoUrl = shownProfile.profile_picture_url || shownProfile.avatar_url || shownProfile.profilePicture || null;

  const residency = profile.residency;
  const verifiedNeighbor = Boolean(residency?.hasHome && residency?.verified);
  // Only a city the read returns (the person's "Who sees your city" setting decides).
  const city = residency?.city || profile.city || null;

  const displayReviewCount = reviewStats.total || profile.review_count || 0;
  const featuredSkills = Array.isArray(profile.skills) ? profile.skills : [];
  const blocked = connectionState === 'blocked';
  // Someone you blocked can't be messaged (the block says so); the menu or Settings unblocks.
  const canMessage = !blocked;
  const canFollow = !blocked && !followUnavailable;

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

  // Work only when there is work to show (or a review for you to write).
  const reviewProps = {
    reviews,
    loading: reviewsLoading && reviews.length === 0,
    stats: reviewStats,
    pendingReview,
    isOwnProfile,
    onReviewSubmitted: () => {
      setPendingReview(null);
      forgetPerson(profile.id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myPendingReviews() });
      reviewsRequested.current = null;
      loadReviews();
      loadProfile();
    },
  };
  const showWork = (portfolio?.length ?? 0) > 0 || reviews.length > 0 || Boolean(pendingReview && !isOwnProfile)
    || (launchFeatures.openGigs && hasReliabilityHistory);
  const postsCount = !postsHasMore && !postsLoading && !postsFailed && userPosts.length > 0 ? userPosts.length : null;
  const tabOptions: Array<{ key: ProfileTab; label: string; count?: number | null }> = [
    { key: 'posts', label: 'Posts', count: postsCount },
    { key: 'about', label: 'About' },
    ...(showWork ? [{ key: 'work' as const, label: 'Work', count: displayReviewCount > 0 ? displayReviewCount : null }] : []),
    // Launch cut #4 (Open Gigs): the Missions (Gigs) tab is hidden.
    ...(launchFeatures.openGigs ? [{ key: 'missions' as const, label: 'Missions' }] : []),
  ];
  const shownTab: ProfileTab = tabOptions.some((tab) => tab.key === activeTab) ? activeTab : 'posts';
  const moveTab = (event) => {
    const index = tabOptions.findIndex((tab) => tab.key === shownTab);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % tabOptions.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabOptions.length) % tabOptions.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabOptions.length - 1;
    if (next < 0) return;
    event.preventDefault();
    setActiveTab(tabOptions[next].key);
    document.getElementById(`${tabsId}-${tabOptions[next].key}-tab`)?.focus();
  };

  // ── Pieces ──

  const iconButton = 'w-11 h-11 rounded-full flex items-center justify-center text-app hover-bg-app transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-link)]';

  const moreMenuItems = [
    { key: 'share', label: shareCopied ? 'Link copied' : 'Share profile', onSelect: handleShare },
    ...(signedIn && canFollow && !previewing
      ? [{ key: 'follow', label: followState ? `Unfollow ${firstName}` : `Follow ${firstName}’s public posts`, onSelect: handleFollow, disabled: actionLoading }]
      : []),
    ...(signedIn && !previewing
      ? [{ key: 'block', label: blockedByMe ? 'Unblock user' : 'Block user', onSelect: blockedByMe ? handleUnblock : handleBlock, disabled: actionLoading }]
      : []),
    ...(signedIn && !previewing ? [{ key: 'report', label: 'Report profile', onSelect: handleReport }] : []),
    // Launch cut #4 (Open Gigs): "Request / Hire" opens the open-post composer.
    ...(launchFeatures.openGigs && signedIn && !previewing && !blocked
      ? [{ key: 'hire', label: 'Request / Hire', onSelect: handleRequestHire }]
      : []),
  ];

  const topRow = previewing ? null : (
    <div className="flex items-center justify-between h-12 -mx-2 mb-1">
      {canGoBack ? (
        <button type="button" onClick={() => router.back()} aria-label="Back" className={iconButton}>
          <ChevronLeft aria-hidden="true" className="w-[1.625rem] h-[1.625rem]" strokeWidth={2.25} />
        </button>
      ) : <span />}
      {!viewerReady ? <span /> : showOwnerOnly || !signedIn ? (
        <button type="button" onClick={handleShare} aria-label={showOwnerOnly ? 'Share your profile' : 'Share this profile'} className={iconButton}>
          <Share aria-hidden="true" className="w-[1.375rem] h-[1.375rem]" strokeWidth={2} />
        </button>
      ) : (
        <ProfileMenu
          ariaLabel="More: share, follow, block or report"
          menuLabel={`${fullName}: more`}
          trigger={<Ellipsis aria-hidden="true" className="w-6 h-6" strokeWidth={2.5} />}
          triggerClassName={iconButton}
          items={moreMenuItems}
        />
      )}
    </div>
  );

  const previewBanner = previewing ? (
    <div className="mb-3 -mx-1 rounded-2xl border border-sky-200 bg-sky-50 py-2 pl-3.5 pr-1 flex items-center gap-2.5" role="status">
      <Eye aria-hidden="true" className="w-5 h-5 shrink-0 text-app-link" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] leading-5 font-semibold text-app">Previewing as {OWNER_PREVIEW_LABELS[ownerPreviewContext].toLowerCase()}</p>
        <p className="text-[0.8125rem] leading-[1.125rem] text-app-muted">{OWNER_PREVIEW_DETAILS[ownerPreviewContext]}</p>
      </div>
      <button type="button" onClick={leaveOwnerPreview} className="min-h-[44px] px-3 text-[1.0625rem] font-semibold text-app-link hover:underline">
        Done
      </button>
    </div>
  ) : null;

  let actions = null;
  if (!viewerReady) {
    // Holds the buttons' place until the viewer is known.
    actions = <div aria-hidden="true" className="mt-[1.125rem] min-h-[3rem]" />;
  } else if (showOwnerOnly) {
    // Your own profile never offers Message or Connect; Edit profile and Preview as are first.
    actions = (
      <div className={`mt-[1.125rem] ${buttonRow}`}>
        <button type="button" onClick={() => router.push('/app/profile/edit')} className={primaryButton}>
          <Pencil aria-hidden="true" className="w-[1.125rem] h-[1.125rem] shrink-0" strokeWidth={2.25} />
          Edit profile
        </button>
        <ProfileMenu
          menuLabel="Preview your profile as"
          trigger={
            <>
              <Eye aria-hidden="true" className="w-[1.1875rem] h-[1.1875rem] shrink-0" strokeWidth={2.25} />
              Preview as
              <ChevronDown aria-hidden="true" className="w-[0.9375rem] h-[0.9375rem] shrink-0" strokeWidth={2.5} />
            </>
          }
          triggerClassName={`${secondaryButton} w-full`}
          items={(['public', 'neighborhood', 'follower'] as const).map((context) => ({
            key: context,
            label: OWNER_PREVIEW_LABELS[context],
            detail: OWNER_PREVIEW_DETAILS[context],
            onSelect: () => {
              setOwnerPreviewContext(context);
              setActiveTab('posts');
            },
          }))}
        />
      </div>
    );
  } else if (anyoneView) {
    actions = (
      <div className="mt-[1.125rem] flex">
        <button
          type="button"
          onClick={() => router.push(authPageHref('/register', profilePath))}
          disabled={previewing}
          className={`flex-1 ${primaryButton}`}
        >
          <UserPlus aria-hidden="true" className="w-[1.1875rem] h-[1.1875rem] shrink-0" strokeWidth={2.25} />
          Join Pantopus to connect with {firstName}
        </button>
      </div>
    );
  } else {
    actions = (
      <RelationshipActions
        name={fullName}
        // A preview shows the buttons the audience would see: your connections see Message and Connected.
        relationship={previewing ? (ownerPreviewContext === 'follower' ? 'connected' : 'none') : connectionState}
        relationshipKnown={previewing || connectionKnown}
        relationshipFailed={!previewing && connectionFailed}
        busy={actionLoading}
        inert={previewing}
        onConnect={() => setConnectOpen(true)}
        onWithdraw={handleWithdraw}
        onAccept={() => void answerRequest(true)}
        onDecline={() => void answerRequest(false)}
        onDisconnect={handleDisconnect}
        onMessage={handleMessage}
      />
    );
  }

  const tabs = (
    <section aria-label={`${fullName}’s posts and details`} className="min-w-0">
      <div role="tablist" aria-label="Profile" className="flex gap-7 border-b border-app overflow-x-auto">
        {tabOptions.map((tab) => (
          <TabButton
            key={tab.key}
            id={`${tabsId}-${tab.key}-tab`}
            controls={`${tabsId}-${tab.key}-panel`}
            label={tab.label}
            count={tab.count}
            active={shownTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            onKeyDown={moveTab}
          />
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${tabsId}-${shownTab}-panel`}
        aria-labelledby={`${tabsId}-${shownTab}-tab`}
        className="pt-3 pb-10"
      >
        {shownTab === 'posts' && (
          <>
            <PostsTab
              posts={userPosts}
              onPostsChange={(update) => {
                setUserPosts(update);
                // The next opening reads the list again rather than showing the old counts.
                void queryClient.invalidateQueries({ queryKey: queryKeys.personPosts(profile.id) });
              }}
              loading={postsLoading}
              failed={postsFailed}
              onRetry={() => void loadUserPosts()}
              blocked={blocked}
              firstName={shownFirstName}
              currentUserId={currentUser?.id}
              justJoined={joinedRecently(profile.created_at || profile.createdAt)}
              onSayHi={viewerReady && !isOwnProfile && canMessage ? handleMessage : undefined}
              isOwner={showOwnerOnly}
            />
            {postsHasMore && userPosts.length > 0 && !blocked && (
              <button
                type="button"
                onClick={() => void loadMorePosts()}
                disabled={postsMoreLoading}
                className={`mt-3 w-full ${secondaryButton}`}
              >
                {postsMoreLoading ? 'Loading…' : 'Show more posts'}
              </button>
            )}
          </>
        )}
        {shownTab === 'about' && (
          <div className="pt-3">
            <AboutTab
              firstName={firstName.charAt(0).toUpperCase() + firstName.slice(1)}
              skills={featuredSkills}
              verifiedNeighbor={verifiedNeighbor}
              city={city}
              emailConfirmed={Boolean(profile.verified)}
              socialLinks={profile.socialLinks || profile.social_links || null}
              onSkill={launchFeatures.openGigs && !showOwnerOnly ? handleRequestHire : undefined}
            />
          </div>
        )}
        {shownTab === 'work' && (
          <div className="pt-3">
            <WorkTab
              portfolio={portfolio || []}
              reviews={reviewProps}
              before={launchFeatures.openGigs && hasReliabilityHistory ? (
                <ReliabilityPanel profile={profile} reliabilityLabel={reliabilityLabel} reliabilityScore={reliabilityScore} />
              ) : null}
            />
          </div>
        )}
        {shownTab === 'missions' && (
          <div className="pt-3">
            <MissionsTab
              gigs={userGigs}
              loading={gigsLoading}
              completedCount={profile.gigs_completed || 0}
              postedCount={profile.gigs_posted || 0}
            />
          </div>
        )}
      </div>
    </section>
  );

  // ── Render ──

  return (
    <div className="bg-app min-h-screen">
      <ReportModal
        key={`${profileIdentifier}:${actionGeneration.current}`}
        open={!!reportTarget && reportTarget.current()}
        onClose={() => setReportTarget(null)}
        onSubmit={submitReport}
        entityType="user"
      />
      <div className="mx-auto w-full max-w-2xl lg:max-w-6xl px-5 lg:px-8 pt-2 pb-8">
        {topRow}
        {previewBanner}
        {/* Phones: one column in the drawings' order. Desktop: who they are and how to say hi on the left, what
            they share on the right. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:gap-x-12 xl:gap-x-16 lg:items-start">
          <div className="min-w-0 lg:pt-2">
            <ProfileHeader
              name={fullName}
              hasName={Boolean(realName)}
              handle={chosenHandle}
              photoUrl={photoUrl}
              colorSeed={profile.id}
              verifiedNeighbor={verifiedNeighbor}
              city={city}
              joinedAt={profile.created_at || profile.createdAt}
              tagline={shownProfile.tagline}
              bio={shownProfile.bio}
            >
              {actions}
            </ProfileHeader>
          </div>
          <div className="min-w-0 mt-7 lg:mt-0">
            {!mounted ? (
              <div aria-hidden="true" className="h-11 border-b border-app" />
            ) : anyoneView ? (
              <PostsTab
                posts={[]}
                onPostsChange={() => {}}
                loading={false}
                firstName={shownFirstName}
                signedOut
                onSignIn={previewing ? undefined : () => router.push(signInHref)}
              />
            ) : tabs}
          </div>
        </div>
      </div>

      <ConnectSheet
        open={connectOpen && !previewing && connectionState === 'none'}
        onClose={() => setConnectOpen(false)}
        name={fullName}
        firstName={firstName}
        photoUrl={photoUrl}
        colorSeed={profile.id}
        following={followState}
        canFollow={canFollow}
        onSend={sendConnectRequest}
        onFollow={followFromSheet}
      />

      {usernamePromptOpen && currentUser && (
        <UsernamePrompt
          open
          currentUsername={currentUser.username}
          onShareAsIs={() => {
            setUsernamePromptOpen(false);
            void shareProfileLink(username);
          }}
          onSaved={(saved) => {
            setUsernamePromptOpen(false);
            setCurrentUser((prev) => (prev ? { ...prev, ...saved } : saved));
            // The old address no longer opens this profile.
            router.replace(`/u/${encodeURIComponent(saved.username)}`);
            void shareProfileLink(saved.username).then((shared) => {
              // Sharing right after the dialog can be refused; the new link is still worth knowing.
              if (shared) toast.success(`Your username is @${saved.username}.`);
              else toast.success(`Your username is @${saved.username}. Your link: ${buildUserProfileShareUrl(saved.username).replace(/^https?:\/\//, '')}`);
            });
          }}
        />
      )}
    </div>
  );
}
