'use client';

import { Suspense, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import * as api from '@pantopus/api';
import type { User } from '@pantopus/types';
import { getAuthToken } from '@pantopus/api';
import ProfileToggle from './ProfileToggle';
import NotificationBell from './NotificationBell';
import { BadgeProvider, useBadges } from '@/contexts/BadgeContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { useDesktopNotifications } from '@/hooks/useDesktopNotifications';
import { NavIcons, HomeIcons, BusinessIcons } from '@/lib/icons';
import MobileTabBar from '@/components/MobileTabBar';
import { PantopusMark } from '@/components/brand/PantopusMark';
import UnifiedFAB from '@/components/UnifiedFAB';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { PostComposerSubmitData } from '@/components/feed/PostComposer';
import { identityCopy } from '@/lib/identityLabels';

// Dynamic imports for heavy modal composers (PostComposer is ~800 lines,
// MagicTaskComposerV2 is 12 files). Deferring these chunks until the user
// actually opens a composer keeps the initial AppShell bundle lean.
function ComposerSkeleton() {
  return (
    <div className="flex items-center justify-center py-12" aria-hidden="true">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-app border-t-primary-500" />
    </div>
  );
}
const PostComposer = dynamic(() => import('@/components/feed/PostComposer'), {
  ssr: false,
  loading: ComposerSkeleton,
});
const MagicTaskComposerV2 = dynamic(() => import('@/components/magic-task-v2').then((m) => m.MagicTaskComposerV2), { ssr: false, loading: ComposerSkeleton });
import FloatingChatWidget from '@/components/chat/FloatingChatWidget';
import FloatingPromoModal from '@/components/ui/FloatingPromoModal';
import { toast } from '@/components/ui/toast-store';
import useViewerHome from '@/hooks/useViewerHome';
import usePromoTriggers from '@/hooks/usePromoTriggers';
import { prefetchHomeTiles } from '@/utils/tilePrefetch';
import { FEED_COMPOSER_OPEN_EVENT, MAGIC_TASK_OPEN_EVENT, notifyFeedPostCreated } from '@/lib/feedComposerEvents';
import { webFeatureFlags } from '@/lib/featureFlags';
import { useFeatureFlagState } from '@/hooks/useFeatureFlag';
import type { CSSProperties } from 'react';
import { Search, MessageCircle, Menu, X, ChevronsLeft, ChevronsRight, type LucideIcon } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────
const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 64;
const STORAGE_KEY = 'pantopus-sidebar-collapsed';

/** One page of GET /notifications — shared shape with /app/notifications infinite query */
type NotificationPageParam = { all: number; personal: number; platform: number; audience: number };
type NotificationsFeedPage = Awaited<ReturnType<typeof api.notifications.getNotifications>> & {
  nextPageParam?: NotificationPageParam;
};

function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // Ignore storage failures so the app shell never crashes.
  }
}

// ── Breakpoint hook (single hook, single effect, two matchMedia listeners) ──
function useBreakpoints(): { isMdUp: boolean; isLgUp: boolean } {
  const [bp, setBp] = useState<{ isMdUp: boolean; isLgUp: boolean }>(() => ({
    isMdUp: typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
    isLgUp: typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  }));
  useEffect(() => {
    const mdMql = window.matchMedia('(min-width: 768px)');
    const lgMql = window.matchMedia('(min-width: 1024px)');
    const update = () => setBp({ isMdUp: mdMql.matches, isLgUp: lgMql.matches });
    update();
    mdMql.addEventListener('change', update);
    lgMql.addEventListener('change', update);
    return () => {
      mdMql.removeEventListener('change', update);
      lgMql.removeEventListener('change', update);
    };
  }, []);
  return bp;
}

// ── Sidebar reducer ────────────────────────────────────────────
type SidebarState = { collapsed: boolean; mobileOpen: boolean; hoverExpanded: boolean };
type SidebarAction = { type: 'SET_COLLAPSED'; value: boolean } | { type: 'TOGGLE_COLLAPSED' } | { type: 'SET_MOBILE_OPEN'; value: boolean } | { type: 'SET_HOVER_EXPANDED'; value: boolean };

function sidebarReducer(s: SidebarState, a: SidebarAction): SidebarState {
  switch (a.type) {
    case 'SET_COLLAPSED':
      return { ...s, collapsed: a.value };
    case 'TOGGLE_COLLAPSED':
      return { ...s, collapsed: !s.collapsed };
    case 'SET_MOBILE_OPEN':
      return { ...s, mobileOpen: a.value };
    case 'SET_HOVER_EXPANDED':
      return { ...s, hoverExpanded: a.value };
    default:
      return s;
  }
}

// ── App-shell reducer ──────────────────────────────────────────
type AppShellState = {
  user: User | null;
  discoverQuery: string;
  activeListings: number;
  composerOpen: boolean;
  feedComposerOpen: boolean;
  feedPosting: boolean;
  mounted: boolean;
};
type AppShellAction = { type: 'SET_USER'; value: User | null } | { type: 'SET_DISCOVER_QUERY'; value: string } | { type: 'SET_ACTIVE_LISTINGS'; value: number } | { type: 'SET_COMPOSER_OPEN'; value: boolean } | { type: 'SET_FEED_COMPOSER_OPEN'; value: boolean } | { type: 'SET_FEED_POSTING'; value: boolean } | { type: 'SET_MOUNTED'; value: boolean };

function appShellReducer(s: AppShellState, a: AppShellAction): AppShellState {
  switch (a.type) {
    case 'SET_USER':
      return { ...s, user: a.value };
    case 'SET_DISCOVER_QUERY':
      return { ...s, discoverQuery: a.value };
    case 'SET_ACTIVE_LISTINGS':
      return { ...s, activeListings: a.value };
    case 'SET_COMPOSER_OPEN':
      return { ...s, composerOpen: a.value };
    case 'SET_FEED_COMPOSER_OPEN':
      return { ...s, feedComposerOpen: a.value };
    case 'SET_FEED_POSTING':
      return { ...s, feedPosting: a.value };
    case 'SET_MOUNTED':
      return { ...s, mounted: a.value };
    default:
      return s;
  }
}

const INITIAL_APP_STATE: AppShellState = {
  user: null,
  discoverQuery: '',
  activeListings: 0,
  composerOpen: false,
  feedComposerOpen: false,
  feedPosting: false,
  mounted: false,
};

// ────────────────────────────────────────────────────────────────
// AppShellInner
// ────────────────────────────────────────────────────────────────
function AppShellInner({ children }: { children: React.ReactNode }) {
  useDesktopNotifications();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // ── Responsive ────────────────────────────────────────────
  const { isMdUp, isLgUp } = useBreakpoints();
  const isMobile = !isMdUp;
  const isTablet = isMdUp && !isLgUp;
  const isDesktop = isLgUp;

  // ── Sidebar state (useReducer: collapsed, mobileOpen, hoverExpanded) ──
  const [sidebarState, sidebarDispatch] = useReducer(sidebarReducer, undefined, () => ({
    collapsed: readSidebarCollapsed(),
    mobileOpen: false,
    hoverExpanded: false,
  }));
  const { collapsed, mobileOpen, hoverExpanded } = sidebarState;

  // ── App state (useReducer: user, discoverQuery, activeListings,
  //    composerOpen, feedComposerOpen, feedPosting, mounted) ──
  const [appState, appDispatch] = useReducer(appShellReducer, INITIAL_APP_STATE);
  const { user, discoverQuery, composerOpen, feedComposerOpen, feedPosting, mounted } = appState;

  useEffect(() => {
    appDispatch({ type: 'SET_MOUNTED', value: true });
  }, []);

  const { unreadMessages: chatUnread } = useBadges();
  // Audience-zone gating for the top-bar split (P2.3 / unified-IA §6.1).
  const audienceFlagState = useFeatureFlagState('audience_profile');
  const audienceProfileFlag = audienceFlagState.enabled;

  // ── Context detection ─────────────────────────────────────
  const homeMatch = pathname.match(/^\/app\/homes\/([^/]+)/);
  const homeId = homeMatch?.[1] || null;
  const isHomeContext = !!homeId;

  const bizMatch = pathname.match(/^\/app\/businesses\/([^/]+)/);
  const businessId = bizMatch?.[1] || null;
  const isBusinessContext = !!businessId && businessId !== 'new';
  const showMobileTabs = isMobile && !isBusinessContext;

  const currentTab = searchParams.get('tab') || 'overview';

  // ── Persist collapsed ─────────────────────────────────────
  useEffect(() => {
    persistSidebarCollapsed(collapsed);
  }, [collapsed]);

  // ── Close mobile drawer on route change ───────────────────
  useEffect(() => {
    sidebarDispatch({ type: 'SET_MOBILE_OPEN', value: false });
  }, [pathname]);

  // ── User fetch ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const token = getAuthToken();
        if (!token) return;
        const u = await api.users.getMyProfile();
        appDispatch({ type: 'SET_USER', value: u });
      } catch {}
    })();
  }, []);

  // ── Tile prefetch for home area ──────────────────────────────
  const { viewerHome } = useViewerHome();
  usePromoTriggers(user);
  useEffect(() => {
    if (viewerHome) {
      prefetchHomeTiles(viewerHome.lat, viewerHome.lng);
    }
  }, [viewerHome]);

  useEffect(() => {
    if (!pathname.startsWith('/app/network')) return;
    appDispatch({ type: 'SET_DISCOVER_QUERY', value: searchParams.get('q') || '' });
  }, [pathname, searchParams]);

  useEffect(() => {
    const openComposer = () => appDispatch({ type: 'SET_FEED_COMPOSER_OPEN', value: true });
    const openMagicTask = () => appDispatch({ type: 'SET_COMPOSER_OPEN', value: true });
    window.addEventListener(FEED_COMPOSER_OPEN_EVENT, openComposer);
    window.addEventListener(MAGIC_TASK_OPEN_EVENT, openMagicTask);
    return () => {
      window.removeEventListener(FEED_COMPOSER_OPEN_EVENT, openComposer);
      window.removeEventListener(MAGIC_TASK_OPEN_EVENT, openMagicTask);
    };
  }, []);

  // ── Derived ───────────────────────────────────────────────
  const userInitial = user?.firstName?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U';
  const userName = user?.firstName || user?.name || user?.username || '';
  const profile = user as (User & { avatar_url?: string; profilePicture?: string }) | null;
  const avatarUrl = profile?.avatar_url ?? profile?.profilePicture ?? profile?.profile_picture_url ?? null;

  // Sidebar is "narrow" on tablet OR desktop-collapsed
  const showCollapsed = isTablet || (isDesktop && collapsed);
  // Sidebar structural width (affects content margin)
  const sidebarWidth = isMobile ? 0 : showCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;
  // Visual width (may be wider on hover-expand overlay)
  const visualWidth = hoverExpanded && showCollapsed ? SIDEBAR_EXPANDED : sidebarWidth;
  // Whether to show labels (full text) in sidebar items
  const showLabels = !showCollapsed || hoverExpanded;
  const showIdentityNavigation = webFeatureFlags.identityFirewall;
  const isIdentityRoute = showIdentityNavigation && (pathname.startsWith('/app/identity') || pathname.startsWith('/app/persona'));
  const isSettingsRoute = pathname.startsWith('/app/profile/settings') || pathname.startsWith('/app/settings');

  // ── Memoized inline style objects (avoid new identity per render) ──
  const topBarStyle = useMemo(() => ({ left: sidebarWidth }), [sidebarWidth]);
  const contentStyle = useMemo(() => ({ marginLeft: sidebarWidth }), [sidebarWidth]);
  const sidebarVisualStyle = useMemo(() => ({ width: visualWidth }), [visualWidth]);
  const sidebarHeaderPadStyle = useMemo(() => ({ paddingLeft: showLabels ? 16 : 0 }), [showLabels]);
  const sidebarSectionPadStyle = useMemo(() => ({ padding: showLabels ? '8px 12px' : '8px 0' }), [showLabels]);
  const sidebarNavPadStyle = useMemo(() => ({ padding: showLabels ? '8px 8px' : '8px 0' }), [showLabels]);

  // Prefetch notifications when user hovers/focuses the bell in the top bar.
  const prefetchNotifications = useCallback(() => {
    router.prefetch('/app/notifications');
    // Must match useInfiniteQuery on /app/notifications: same key + InfiniteData shape.
    // Older prefetchQuery used this key family with a flat API payload and crashed hasNextPage (pages.length).
    queryClient.prefetchInfiniteQuery({
      queryKey: [...queryKeys.notifications(), 'infinite', 'all', 'all'],
      initialPageParam: { all: 0, personal: 0, platform: 0, audience: 0 },
      queryFn: async ({ pageParam }) => {
        const res = await api.notifications.getNotifications({ limit: 30, offset: pageParam.all });
        return {
          ...res,
          nextPageParam: {
            all: pageParam.all + (res.notifications?.length || 0),
            personal: pageParam.personal,
            platform: pageParam.platform,
            audience: pageParam.audience,
          },
        };
      },
      getNextPageParam: (lastPage: NotificationsFeedPage) => {
        if (!lastPage?.hasMore) return undefined;
        return lastPage.nextPageParam;
      },
      staleTime: 5_000,
    });
  }, [router, queryClient]);

  const openDiscover = () => {
    const q = discoverQuery.trim();
    router.push(q ? `/app/discover?q=${encodeURIComponent(q)}` : '/app/discover');
  };

  const handleCreateFeedPost = async (data: PostComposerSubmitData) => {
    appDispatch({ type: 'SET_FEED_POSTING', value: true });
    try {
      const { mediaFiles, ...composerData } = data;
      const postData = { ...composerData } as Parameters<typeof api.posts.createPost>[0];
      const res = await api.posts.createPost(postData);
      const newPost = res.post;
      const files = Array.isArray(mediaFiles) ? mediaFiles : [];

      if (files.length > 0) {
        try {
          await api.upload.uploadPostMedia(newPost.id, files);
        } catch {
          toast.warning('Post created, but media failed to attach. You can re-upload from the post.');
        }
      }

      appDispatch({ type: 'SET_FEED_COMPOSER_OPEN', value: false });
      notifyFeedPostCreated();
      toast.success('Posted!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post.');
    } finally {
      appDispatch({ type: 'SET_FEED_POSTING', value: false });
    }
  };

  // Before mount, render a simple fallback to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-app text-app">
        <header className="fixed top-0 left-0 right-0 h-14 bg-surface border-b border-app z-50" />
        <div className="pt-14">{children}</div>
      </div>
    );
  }

  return (
    // `--fab-lift` raises every fixed bottom-anchored control (FABs, the
    // chat launcher) clear of the mobile tab bar; 0 wherever the bar is absent.
    <div className="min-h-screen bg-app text-app" style={{ '--fab-lift': showMobileTabs ? '64px' : '0px' } as CSSProperties}>
      {/* ═══════════════════════════════════════════════════════
       *  HEADER
       * ═══════════════════════════════════════════════════════ */}
      <header className="fixed top-0 right-0 h-14 bg-surface border-b border-app z-50 flex items-center px-4 transition-[left] duration-200 ease-in-out" style={topBarStyle}>
        {/* Mobile: hamburger + brand */}
        {isMobile && (
          <>
            <button onClick={() => sidebarDispatch({ type: 'SET_MOBILE_OPEN', value: !mobileOpen })} className="p-2 hover-bg-app rounded-lg transition mr-2" aria-label="Toggle menu">
              {mobileOpen ? <X className="w-5 h-5 text-app-muted" /> : <Menu className="w-5 h-5 text-app-muted" />}
            </button>
            <button onClick={() => router.push('/app/hub')} className="flex items-center gap-2 mr-auto">
              <PantopusMark size={24} />
              <span className="text-lg font-semibold text-app">Pantopus</span>
            </button>
          </>
        )}

        {/* Desktop/tablet: spacer pushes right section to the end */}
        {!isMobile && <div className="flex-1" />}

        {/* Search bar (desktop) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            openDiscover();
          }}
          className="hidden md:flex items-center gap-2 rounded-lg border border-app bg-surface-muted px-3 py-1.5 mr-3"
        >
          <Search className="w-4 h-4 text-app-muted flex-shrink-0" />
          <input value={discoverQuery} onChange={(e) => appDispatch({ type: 'SET_DISCOVER_QUERY', value: e.target.value })} placeholder="Search profiles or businesses" className="w-48 bg-transparent text-sm text-app placeholder:text-app-muted focus:outline-none" />
        </form>

        {/* Search icon (mobile) */}
        <button onClick={() => router.push('/app/discover')} className="md:hidden p-2 hover-bg-app rounded-lg" aria-label="Search">
          <Search className="w-5 h-5 text-app-muted" />
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <div onMouseEnter={prefetchNotifications} onFocus={prefetchNotifications} className="contents">
            {audienceProfileFlag ? (
              // Two streams (unified-IA §6.1): Personal bell scoped to
              // personal+platform; Audience megaphone scoped to audience.
              // They never share a count or a feed.
              <>
                <NotificationBell mode="personal" />
                <NotificationBell mode="audience" />
              </>
            ) : (
              <NotificationBell mode="all" />
            )}
          </div>
          <button onClick={() => router.push('/app/chat')} className="p-2 hover-bg-app rounded-lg relative" aria-label="Messages">
            <MessageCircle className="w-5 h-5 text-app-muted" />
            {chatUnread > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] leading-[18px] text-center font-bold">{chatUnread > 99 ? '99+' : chatUnread}</span>}
          </button>
          <button onClick={() => router.push('/app/profile')} className="w-8 h-8 rounded-full overflow-hidden bg-primary-600 text-white flex items-center justify-center font-semibold hover:bg-primary-700 text-sm shrink-0" aria-label="Profile">
            {avatarUrl ? <Image src={avatarUrl} alt="" width={32} height={32} sizes="32px" quality={75} className="w-full h-full object-cover" /> : userInitial}
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════
       *  PERSISTENT SIDEBAR (tablet + desktop)
       * ═══════════════════════════════════════════════════════ */}
      {!isMobile && (
        <aside
          className={`fixed top-0 left-0 bottom-0 bg-surface border-r border-app flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out ${hoverExpanded && showCollapsed ? 'shadow-2xl z-[60]' : 'z-40'}`}
          style={sidebarVisualStyle}
          onMouseEnter={() => {
            if (showCollapsed) sidebarDispatch({ type: 'SET_HOVER_EXPANDED', value: true });
          }}
          onMouseLeave={() => sidebarDispatch({ type: 'SET_HOVER_EXPANDED', value: false })}
        >
          {/* ── Brand ── */}
          <div className="h-14 flex items-center gap-3 flex-shrink-0 border-b border-app overflow-hidden" style={sidebarHeaderPadStyle}>
            {showLabels ? (
              <button onClick={() => router.push('/app/hub')} className="flex items-center gap-3 hover-bg-app rounded-lg px-1 py-1 transition">
                <PantopusMark size={28} className="flex-shrink-0" />
                <span className="text-lg font-bold text-app whitespace-nowrap">Pantopus</span>
              </button>
            ) : (
              <button onClick={() => router.push('/app/hub')} className="w-full h-full flex items-center justify-center hover-bg-app transition" title="Pantopus Hub" aria-label="Pantopus Hub">
                <PantopusMark size={28} />
              </button>
            )}
          </div>

          {/* ── Context Switcher ── */}
          <div className="border-b border-app flex-shrink-0 overflow-hidden" style={sidebarSectionPadStyle}>
            {showLabels ? <ProfileToggle activeHomeId={homeId} activeBusinessId={businessId} /> : <ProfileToggle activeHomeId={homeId} activeBusinessId={businessId} compact />}
          </div>

          {/* ── Navigation ── */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2" style={sidebarNavPadStyle}>
            {isBusinessContext ? <BusinessSidebarContent businessId={businessId!} currentTab={currentTab} showLabels={showLabels} onNavigate={() => {}} /> : isHomeContext ? <HomeSidebarContent homeId={homeId!} currentTab={currentTab} showLabels={showLabels} onNavigate={() => {}} /> : <PersonalSidebarContent currentPath={pathname} showLabels={showLabels} chatUnread={chatUnread} onNavigate={() => {}} />}
          </nav>

          {/* ── Bottom Section ── */}
          <div className="border-t border-app flex-shrink-0">
            {showIdentityNavigation && <SidebarItem icon={NavIcons.identity} label={identityCopy.profilesPrivacyTitle} active={isIdentityRoute} onClick={() => router.push('/app/identity')} showLabel={showLabels} />}

            {/* Settings */}
            <SidebarItem icon={NavIcons.settings} label="Settings" active={isSettingsRoute} onClick={() => router.push('/app/profile/settings')} showLabel={showLabels} />

            {/* User row */}
            <button onClick={() => router.push('/app/profile')} className={`w-full flex items-center hover-bg-app transition ${showLabels ? 'gap-3 px-4 py-2.5' : 'justify-center py-2.5'}`} title={!showLabels ? userName || 'Profile' : undefined}>
              <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">{avatarUrl ? <Image src={avatarUrl} alt="" width={32} height={32} sizes="32px" quality={75} className="w-full h-full object-cover" /> : userInitial}</div>
              {showLabels && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-app truncate">{userName}</div>
                  <div className="text-xs text-app-muted truncate">{user?.email || ''}</div>
                </div>
              )}
            </button>

            {/* Collapse toggle (desktop only, not during hover-expand) */}
            {isDesktop && !hoverExpanded && (
              <button onClick={() => sidebarDispatch({ type: 'TOGGLE_COLLAPSED' })} className={`w-full flex items-center text-app-muted hover-bg-app transition text-xs border-t border-app ${showLabels ? 'gap-2 px-4 py-2.5' : 'justify-center py-2.5'}`} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                {collapsed ? (
                  <ChevronsRight className="w-4 h-4" />
                ) : (
                  <>
                    <ChevronsLeft className="w-4 h-4" />
                    <span className="whitespace-nowrap">Collapse</span>
                  </>
                )}
              </button>
            )}
          </div>
        </aside>
      )}

      {/* ═══════════════════════════════════════════════════════
       *  MOBILE DRAWER
       * ═══════════════════════════════════════════════════════ */}
      {isMobile && mobileOpen && (
        <>
          <div className="fixed inset-0 z-[998] bg-black/30 animate-fade-in" onClick={() => sidebarDispatch({ type: 'SET_MOBILE_OPEN', value: false })} />
          <aside className="fixed top-14 left-0 bottom-0 w-72 bg-surface border-r border-app z-[999] flex flex-col overflow-hidden shadow-xl animate-slide-in-left">
            {/* Context switcher */}
            <div className="px-3 py-3 border-b border-app">
              <ProfileToggle activeHomeId={homeId} activeBusinessId={businessId} />
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-2 py-2">{isBusinessContext ? <BusinessSidebarContent businessId={businessId!} currentTab={currentTab} showLabels onNavigate={() => sidebarDispatch({ type: 'SET_MOBILE_OPEN', value: false })} /> : isHomeContext ? <HomeSidebarContent homeId={homeId!} currentTab={currentTab} showLabels onNavigate={() => sidebarDispatch({ type: 'SET_MOBILE_OPEN', value: false })} /> : <PersonalSidebarContent currentPath={pathname} showLabels chatUnread={chatUnread} onNavigate={() => sidebarDispatch({ type: 'SET_MOBILE_OPEN', value: false })} />}</nav>

            {/* Bottom */}
            <div className="border-t border-app px-2 py-1">
              {showIdentityNavigation && (
                <SidebarItem
                  icon={NavIcons.identity}
                  label={identityCopy.profilesPrivacyTitle}
                  active={isIdentityRoute}
                  onClick={() => {
                    router.push('/app/identity');
                    sidebarDispatch({ type: 'SET_MOBILE_OPEN', value: false });
                  }}
                  showLabel
                />
              )}
              <SidebarItem
                icon={NavIcons.settings}
                label="Settings"
                active={isSettingsRoute}
                onClick={() => {
                  router.push('/app/profile/settings');
                  sidebarDispatch({ type: 'SET_MOBILE_OPEN', value: false });
                }}
                showLabel
              />
              <button
                onClick={() => {
                  router.push('/app/profile');
                  sidebarDispatch({ type: 'SET_MOBILE_OPEN', value: false });
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover-bg-app transition"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">{avatarUrl ? <Image src={avatarUrl} alt="" width={32} height={32} sizes="32px" quality={75} className="w-full h-full object-cover" /> : userInitial}</div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-app truncate">{userName}</div>
                </div>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
       *  MAIN CONTENT
       * ═══════════════════════════════════════════════════════ */}
      <main className={`pt-14 min-h-screen transition-[margin-left] duration-200 ease-in-out relative z-0${showMobileTabs ? ' pb-20' : ''}`} style={contentStyle}>
        {children}
      </main>

      {/* Four-tab IA on phone-width web: Place · Today · Nearby · Mail as a
          bottom bar (the sidebar carries it at md+). Business context keeps
          its own navigation. */}
      {showMobileTabs && <MobileTabBar unread={chatUnread} />}

      {/* ═══════════════════════════════════════════════════════
       *  UNIFIED FAB + COMPOSER
       * ═══════════════════════════════════════════════════════ */}
      <UnifiedFAB showHireHelp onHireHelp={() => appDispatch({ type: 'SET_COMPOSER_OPEN', value: true })} hideOnPageFABRoutes />
      <FloatingChatWidget />
      <FloatingPromoModal />
      {feedComposerOpen && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/35 backdrop-blur-[2px]" onClick={() => appDispatch({ type: 'SET_FEED_COMPOSER_OPEN', value: false })} />
          <div className="fixed left-1/2 top-1/2 z-[71] w-[min(100vw-2rem,44rem)] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] border border-app bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-app px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-app">Post to Pulse</h3>
                <p className="text-xs text-app-muted">Choose where this post should go without leaving the page.</p>
              </div>
              <button onClick={() => appDispatch({ type: 'SET_FEED_COMPOSER_OPEN', value: false })} className="rounded-lg p-1.5 text-app-muted transition hover:text-app hover-bg-app" aria-label="Close Pulse composer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <PostComposer
                onPost={handleCreateFeedPost}
                isPosting={feedPosting}
                user={
                  user
                    ? {
                        name: user.name,
                        first_name: user.firstName,
                        username: user.username,
                        profile_picture_url: user.profile_picture_url,
                      }
                    : null
                }
              />
            </div>
          </div>
        </>
      )}
      {composerOpen && <MagicTaskComposerV2 isOpen={composerOpen} onClose={() => appDispatch({ type: 'SET_COMPOSER_OPEN', value: false })} />}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      <BadgeProvider>
        <Suspense>
          <AppShellInner>{children}</AppShellInner>
        </Suspense>
      </BadgeProvider>
    </SocketProvider>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Personal Sidebar Content
 * ───────────────────────────────────────────────────────────── */
export function PersonalSidebarContent({ currentPath, showLabels, chatUnread, onNavigate }: { currentPath: string; showLabels: boolean; chatUnread: number; onNavigate: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const go = (path: string) => {
    router.push(path);
    onNavigate();
  };
  const isActive = (path: string) => currentPath === path;
  const startsWith = (prefix: string) => currentPath.startsWith(prefix);

  // ── Prefetch on hover/focus of primary nav items ──────────
  // Each prefetcher:
  //  1. router.prefetch() → warms the Next.js route bundle + RSC payload
  //  2. queryClient.prefetchQuery() → warms the React Query cache (where
  //     the destination page's query key is known ahead of time)
  // staleTime 5s means rapid re-hovers within 5s are no-ops (RQ dedupes).
  const PREFETCH_STALE = 5_000;

  // Place — warm the route bundle + the primary-home query (the
  // intelligence query key needs the home id, not known on hover).
  const prefetchPlace = useCallback(() => {
    router.prefetch('/app/place');
    queryClient.prefetchQuery({
      queryKey: queryKeys.placePrimaryHome(),
      queryFn: () => api.homes.getPrimaryHome(),
      staleTime: PREFETCH_STALE,
    });
  }, [router, queryClient]);

  // Today — the briefing tab; the query key is known ahead of time.
  const prefetchToday = useCallback(() => {
    router.prefetch('/app/today');
    queryClient.prefetchQuery({
      queryKey: queryKeys.hubToday(),
      queryFn: () => api.hub.getHubToday({ retries: 1, retryDelayMs: 800 }),
      staleTime: PREFETCH_STALE,
    });
  }, [router, queryClient]);

  const prefetchNearby = useCallback(() => {
    router.prefetch('/app/nearby');
  }, [router]);

  // Mail — the mailbox plus the Messages inbox (chat lives inside Mail).
  const prefetchMail = useCallback(() => {
    router.prefetch('/app/mailbox');
    router.prefetch('/app/chat');
    queryClient.prefetchQuery({
      queryKey: queryKeys.conversations(),
      queryFn: () => api.chat.getUnifiedConversations({ limit: 200 }),
      staleTime: PREFETCH_STALE,
    });
  }, [router, queryClient]);

  // Scheduling hub — the hub query key needs the active owner (resolved client-side
  // via the in-hub pillar switcher), so warm just the route bundle on hover.
  const prefetchScheduling = useCallback(() => {
    router.prefetch('/app/scheduling');
  }, [router]);

  // Audience destination — unified-IA §3.1 + §3.6. Gated per-user behind
  // audience_profile (P0.8) so users without access don't see a 6th tab.
  const audienceFlag = useFeatureFlagState('audience_profile');
  const prefetchAudience = useCallback(() => {
    router.prefetch('/app/audience');
    queryClient.prefetchQuery({
      queryKey: queryKeys.audienceMe(),
      queryFn: () => api.personas.getMyPersona().catch(() => null),
      staleTime: PREFETCH_STALE,
    });
  }, [router, queryClient]);

  return (
    <div className="space-y-0.5">
      {/* Four-tab IA (wedge Phase 1.5): Place · Today · Nearby · Mail —
          every tab alive at zero density. Today is the briefing; Nearby is
          the density-gated door at /app/nearby (Pulse / Marketplace /
          Tasks open behind its meter); Mail holds the mailbox AND the
          Messages inbox (chat routes stay at /app/chat). Hub and the my-x
          screens keep their routes (deep links resolve) but leave the nav. */}
      <SidebarItem icon={NavIcons.place} label="Place" active={startsWith('/app/place') || isActive('/app/hub')} onClick={() => go('/app/place')} onPrefetch={prefetchPlace} showLabel={showLabels} accent="home" testId="sidebar-place" />
      <SidebarItem icon={NavIcons.today} label="Today" active={startsWith('/app/today') || startsWith('/app/hub/today')} onClick={() => go('/app/today')} onPrefetch={prefetchToday} showLabel={showLabels} testId="sidebar-today" />
      <SidebarItem icon={NavIcons.nearby} label="Nearby" active={startsWith('/app/nearby') || startsWith('/app/neighborhood') || startsWith('/app/feed') || startsWith('/app/gigs') || startsWith('/app/marketplace')} onClick={() => go('/app/nearby')} onPrefetch={prefetchNearby} showLabel={showLabels} testId="sidebar-nearby" />
      <SidebarItem icon={NavIcons.mail} label="Mail" active={startsWith('/app/mailbox') || startsWith('/app/chat')} onClick={() => go('/app/mailbox?scope=personal')} onPrefetch={prefetchMail} showLabel={showLabels} count={chatUnread} testId="sidebar-mail" />
      {webFeatureFlags.scheduling ? <SidebarItem icon={NavIcons.scheduling} label="Scheduling" active={startsWith('/app/scheduling')} onClick={() => go('/app/scheduling')} onPrefetch={prefetchScheduling} showLabel={showLabels} testId="sidebar-scheduling" /> : null}
      {audienceFlag.enabled ? <SidebarItem icon={NavIcons.audience} label="Audience" active={startsWith('/app/audience')} onClick={() => go('/app/audience')} onPrefetch={prefetchAudience} showLabel={showLabels} accent="teal" testId="sidebar-audience" /> : null}
      {webFeatureFlags.persona ? <SidebarItem icon={NavIcons.beacon} label="My Beacon" active={isActive('/app/persona') || startsWith('/app/persona/')} onClick={() => go('/app/persona')} showLabel={showLabels} /> : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Home Sidebar Content
 * ───────────────────────────────────────────────────────────── */
function HomeSidebarContent({ homeId, currentTab, showLabels, onNavigate }: { homeId: string; currentTab: string; showLabels: boolean; onNavigate: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  const dashPath = `/app/homes/${homeId}/dashboard`;
  const propertyDetailsPath = `/app/homes/${homeId}/property-details`;
  const onDash = pathname.startsWith(dashPath);
  const onPropertyDetails = pathname.startsWith(propertyDetailsPath);

  const goTab = (tab: string) => {
    router.push(tab === 'overview' ? dashPath : `${dashPath}?tab=${tab}`);
    onNavigate();
  };

  const isTabActive = (tab: string) => onDash && currentTab === tab;

  return (
    <div className="space-y-0.5">
      <SidebarItem icon={HomeIcons.overview} label="Overview" active={isTabActive('overview')} onClick={() => goTab('overview')} accent="emerald" showLabel={showLabels} />
      <SidebarItem
        icon={HomeIcons.propertyDetails}
        label="Property Details"
        active={onPropertyDetails}
        onClick={() => {
          router.push(propertyDetailsPath);
          onNavigate();
        }}
        accent="emerald"
        showLabel={showLabels}
      />
      <SidebarItem icon={HomeIcons.tasks} label="Tasks" active={isTabActive('tasks')} onClick={() => goTab('tasks')} accent="emerald" showLabel={showLabels} />
      <SidebarItem icon={HomeIcons.issues} label="Issues" active={isTabActive('issues')} onClick={() => goTab('issues')} accent="emerald" showLabel={showLabels} />
      <SidebarItem icon={HomeIcons.bills} label="Bills" active={isTabActive('bills')} onClick={() => goTab('bills')} accent="emerald" showLabel={showLabels} />
      <SidebarItem icon={HomeIcons.members} label="Members" active={isTabActive('members')} onClick={() => goTab('members')} accent="emerald" showLabel={showLabels} />
      <SidebarItem
        icon={HomeIcons.mailbox}
        label="Mailbox"
        onClick={() => {
          router.push(`/app/mailbox?scope=home&homeId=${homeId}`);
          onNavigate();
        }}
        accent="emerald"
        showLabel={showLabels}
      />
      {webFeatureFlags.scheduling ? (
        <SidebarItem
          icon={HomeIcons.scheduling}
          label="Scheduling"
          active={pathname?.startsWith(`/app/homes/${homeId}/scheduling`)}
          onClick={() => {
            router.push(`/app/homes/${homeId}/scheduling`);
            onNavigate();
          }}
          accent="emerald"
          showLabel={showLabels}
        />
      ) : null}

      <SidebarDivider showLabel={showLabels} />

      <SidebarItem icon={HomeIcons.packages} label="Packages" active={isTabActive('packages')} onClick={() => goTab('packages')} showLabel={showLabels} />
      <SidebarItem icon={HomeIcons.documents} label="Documents" active={isTabActive('documents')} onClick={() => goTab('documents')} showLabel={showLabels} />
      <SidebarItem icon={HomeIcons.vendors} label="Vendors" active={isTabActive('vendors')} onClick={() => goTab('vendors')} showLabel={showLabels} />
      <SidebarItem icon={HomeIcons.emergency} label="Emergency" active={isTabActive('emergency')} onClick={() => goTab('emergency')} showLabel={showLabels} />

      <SidebarDivider showLabel={showLabels} />

      <SidebarItem
        icon={HomeIcons.settings}
        label="Home Settings"
        onClick={() => {
          router.push(`/app/homes/${homeId}/edit`);
          onNavigate();
        }}
        showLabel={showLabels}
      />
      <SidebarItem
        icon={HomeIcons.back}
        label="Pantopus Hub"
        onClick={() => {
          router.push('/app/hub');
          onNavigate();
        }}
        showLabel={showLabels}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Business Sidebar Content
 * ───────────────────────────────────────────────────────────── */
function BusinessSidebarContent({ businessId, currentTab, showLabels, onNavigate }: { businessId: string; currentTab: string; showLabels: boolean; onNavigate: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  const dashPath = `/app/businesses/${businessId}/dashboard`;
  const onDash = pathname.startsWith(dashPath);

  const goTab = (tab: string) => {
    router.push(tab === 'overview' ? dashPath : `${dashPath}?tab=${tab}`);
    onNavigate();
  };

  const goPath = (path: string) => {
    router.push(path);
    onNavigate();
  };
  const isTabActive = (tab: string) => onDash && currentTab === tab;

  return (
    <div className="space-y-0.5">
      <SidebarItem icon={BusinessIcons.overview} label="Overview" active={isTabActive('overview')} onClick={() => goTab('overview')} accent="violet" showLabel={showLabels} />
      <SidebarItem icon={BusinessIcons.profile} label="Profile" active={isTabActive('profile')} onClick={() => goTab('profile')} accent="violet" showLabel={showLabels} />
      <SidebarItem icon={BusinessIcons.locations} label="Locations & Hours" active={isTabActive('locations')} onClick={() => goTab('locations')} accent="violet" showLabel={showLabels} />
      <SidebarItem icon={BusinessIcons.catalog} label="Catalog" active={isTabActive('catalog')} onClick={() => goTab('catalog')} accent="violet" showLabel={showLabels} />
      <SidebarItem icon={BusinessIcons.pages} label="Pages" active={isTabActive('pages')} onClick={() => goTab('pages')} accent="violet" showLabel={showLabels} />
      <SidebarItem icon={BusinessIcons.postTask} label="Post Task" active={pathname.startsWith('/app/gigs/new') || pathname.startsWith('/app/gigs-v2/new')} onClick={() => goPath(`/app/gigs/new?beneficiary=${businessId}`)} accent="violet" showLabel={showLabels} />
      <SidebarItem icon={BusinessIcons.chat} label="Business Chat" active={pathname.startsWith(`/app/businesses/${businessId}/chat`)} onClick={() => goPath(`/app/businesses/${businessId}/chat`)} accent="violet" showLabel={showLabels} />

      <SidebarDivider showLabel={showLabels} />

      <SidebarItem icon={BusinessIcons.team} label="Team" active={isTabActive('team')} onClick={() => goTab('team')} accent="violet" showLabel={showLabels} />
      <SidebarItem icon={BusinessIcons.reviews} label="Reviews" active={isTabActive('reviews')} onClick={() => goTab('reviews')} accent="violet" showLabel={showLabels} />
      <SidebarItem icon={BusinessIcons.insights} label="Insights" active={isTabActive('insights')} onClick={() => goTab('insights')} accent="violet" showLabel={showLabels} />
      <SidebarItem icon={BusinessIcons.payments} label="Payments" active={isTabActive('payments')} onClick={() => goTab('payments')} accent="violet" showLabel={showLabels} />

      <SidebarDivider showLabel={showLabels} />

      <SidebarItem icon={BusinessIcons.settings} label="Settings" active={isTabActive('settings')} onClick={() => goTab('settings')} showLabel={showLabels} />
      <SidebarItem icon={BusinessIcons.back} label="Pantopus Hub" onClick={() => goPath('/app/hub')} showLabel={showLabels} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * SidebarItem — individual nav row
 * ───────────────────────────────────────────────────────────── */
function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
  onPrefetch,
  count,
  accent = 'blue',
  showLabel = true,
  accessory,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
  onPrefetch?: () => void;
  count?: number;
  accent?: 'blue' | 'emerald' | 'violet' | 'teal' | 'home';
  showLabel?: boolean;
  /** Optional trailing element (e.g. <ProBadge />) rendered before the count pill. */
  accessory?: React.ReactNode;
  /** Optional data-testid for targeted assertions in component tests. */
  testId?: string;
}) {
  const activeClasses =
    accent === 'home'
      ? // Place pillar accent = colors.identity.home (green-600 == #16A34A).
        'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-200 border-l-[3px] border-green-600 dark:border-green-400'
      : accent === 'violet'
        ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-200 border-l-[3px] border-violet-600 dark:border-violet-400'
        : accent === 'emerald'
        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 border-l-[3px] border-emerald-600 dark:border-emerald-400'
        : accent === 'teal'
          ? // Audience zone (unified-IA §3.2) — teal accent never appears on
            // Personal-zone items so the visual cue stays unmissable.
            'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-200 border-l-[3px] border-teal-600 dark:border-teal-400'
          : 'bg-blue-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 border-l-[3px] border-primary-600 dark:border-primary-400';

  const inactiveClasses = 'text-app-muted hover-bg-app border-l-[3px] border-transparent';

  if (!showLabel) {
    // Icon-only mode
    return (
      <button onClick={onClick} onMouseEnter={onPrefetch} onFocus={onPrefetch} className={`w-full flex items-center justify-center py-2.5 rounded-lg transition relative group ${active ? activeClasses : inactiveClasses}`} title={label} data-testid={testId} data-accent={accent} data-active={active ? 'true' : 'false'}>
        <Icon className="w-5 h-5 flex-shrink-0" />
        {accessory ? <span className="absolute bottom-0.5 right-0.5">{accessory}</span> : null}
        {count != null && count > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full flex items-center justify-center bg-red-500 text-white">{count > 99 ? '99+' : count}</span>}
        {/* Tooltip */}
        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-app-surface-sunken text-white dark:text-app-text text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">{label}</span>
      </button>
    );
  }

  // Full mode with label
  return (
    <button onClick={onClick} onMouseEnter={onPrefetch} onFocus={onPrefetch} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${active ? activeClasses : inactiveClasses}`} data-testid={testId} data-accent={accent} data-active={active ? 'true' : 'false'}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1 text-left truncate">{label}</span>
      {accessory}
      {count != null && count > 0 && <span className="min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full flex items-center justify-center bg-red-500 text-white">{count > 99 ? '99+' : count}</span>}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
 * SidebarDivider
 * ───────────────────────────────────────────────────────────── */
function SidebarDivider({ showLabel }: { showLabel: boolean }) {
  return <div className={`h-px bg-app-border my-2 ${showLabel ? 'mx-3' : 'mx-2'}`} />;
}
