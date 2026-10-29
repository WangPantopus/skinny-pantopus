'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  MapPin, Link as LinkIcon, Radio, Trophy,
  ClipboardList, Map as MapIcon, Settings, ChevronDown,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { FeedSurface, Post, PostType } from '@pantopus/api';
import { getPostTypeConfig } from '@pantopus/ui-utils';
import {
  PostComposer, EditPostDialog, PostCard, PostDetailPanel, FeedFilters, NearbyProvidersCard,
  NeighborhoodPulse, EmptyFeed, SparseFeedSummary, PostSkeleton,
  TopicChipRow, SportsEventModule,
} from '@/components/feed';
import type { SportsStarter } from '@/components/feed/EmptyFeed';
import ReportModal from '@/components/ui/ReportModal';
import ErrorState from '@/components/ui/ErrorState';
import InquiryChatDrawer from '@/components/discover/InquiryChatDrawer';
import { useAreaPicker } from '@/hooks/useAreaPicker';
import { useFeedPreferences } from '@/hooks/useFeedPreferences';
import { useFeedData, type FilterType } from '@/hooks/useFeedData';
import { useNewPostsPill } from '@/hooks/useNewPostsPill';
import { useActiveSportsEvents } from '@/hooks/useActiveSportsEvents';
import {
  PLACE_TOPICS, SPORTS_MODES,
  type SportsComposerMetadata, type SportsMode,
} from '@/constants/feedTopics';
import { FEED_POST_CREATED_EVENT } from '@/lib/feedComposerEvents';
import { launchFeatures } from '@/lib/featureFlags';
import NearbyTabs from '@/components/nearby/NearbyTabs';
import { useReducedMotion } from '@/components/scheduling/polish/a11y';
import { usePulseQuickReturn } from './usePulseQuickReturn';
import { mapFilterLabel } from './pulseMapFilters';
import './pulse.css';

const FeedMap = dynamic(() => import('./FeedMap'), { ssr: false });

/** Map mode: the reveal capsule's bottom edge (top-2 + h-8), where the map's top pills start while the header is away. */
const REVEAL_CAPSULE_BOTTOM_PX = 40;
/** Before the phone tab bar is measured: its 54 px row plus the home-indicator inset. */
const TAB_BAR_FALLBACK = 'calc(3.375rem + env(safe-area-inset-bottom))';

/** The phone tab bar's height (AppShell draws it below md), so the Map fills exactly the space above it. */
function useMobileTabBarHeight(active: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return undefined;
    let observed: Element | null = null;
    let observer: ResizeObserver | null = null;
    let frame = 0;
    const measure = () => {
      const bar = document.querySelector('[data-testid="mobile-tab-bar"]');
      if (bar !== observed) {
        observer?.disconnect();
        observer = null;
        observed = bar;
        if (bar && typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(measure);
          observer.observe(bar);
        }
      }
      setHeight(bar ? bar.getBoundingClientRect().height : 0);
    };
    // The bar comes and goes with the breakpoint: measure again once a resize has rendered.
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [active]);
  return height;
}

const SURFACE_TABS: { key: FeedSurface; label: string; icon: ReactNode }[] = ([
  { key: 'place', label: 'Place', icon: <MapPin className="w-4 h-4 inline-block" /> },
  { key: 'personas', label: 'Beacons', icon: <Radio className="w-4 h-4 inline-block" /> },
  { key: 'connections', label: 'Connections', icon: <LinkIcon className="w-4 h-4 inline-block" /> },
// Launch cut #1 (Beacon): the Beacons (followed publishers) feed is hidden.
] satisfies { key: FeedSurface; label: string; icon: ReactNode }[]).filter(({ key }) => key !== 'personas' || launchFeatures.beacon);

export default function FeedPage() {
  const router = useRouter();
  const pathname = usePathname() ?? '/app/feed';
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showCompose, setShowCompose] = useState(false);
  const [toast, setToast] = useState('');
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<{ id: string; name: string } | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const handleReport = useCallback((postId: string) => setReportPostId(postId), []);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  // Each message stays its full 3 seconds: an earlier message's timer doesn't cut a newer one short.
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }, []);

  const area = useAreaPicker(showToast);
  const hasViewingArea = area.viewingLat != null && area.viewingLng != null;

  const surfaceParam = searchParams?.get('surface');
  const feed = useFeedData({
    initialSurface: (surfaceParam === 'personas' && launchFeatures.beacon) || surfaceParam === 'connections' ? surfaceParam : 'place',
    viewingLat: area.viewingLat,
    viewingLng: area.viewingLng,
    userLat: area.userLat,
    userLng: area.userLng,
    gpsTimestamp: area.gpsTimestamp,
    radiusMiles: area.radiusMiles,
    areaReady: area.areaStatus !== 'resolving',
    showToast,
  });

  const inSportsLane = feed.surface === 'place' && feed.topic === 'sports';
  const activeEvents = useActiveSportsEvents(inSportsLane);

  // A Place feed without coordinates means "no area set" only once the saved area has been read.
  const placeAreaMissing = feed.surface === 'place' && (area.viewingLat == null || area.viewingLng == null);
  const areaResolving = placeAreaMissing && area.areaStatus === 'resolving';
  const areaFailed = placeAreaMissing && area.areaStatus === 'failed';

  // The Pulse card counts the unfiltered Place feed for the viewed area. Keep the last successful
  // unfiltered read so a post-type chip, a topic lane, a pending read or a failed read never shows
  // the other counts as 0; with no such read for this area the card shows dashes.
  const pulseScope = placeAreaMissing ? null : `${area.viewingLat},${area.viewingLng},${area.radiusMiles ?? ''}`;
  const unfilteredPlaceLoaded = feed.surface === 'place' && feed.filter === 'all' && feed.topic == null
    && pulseScope != null && !feed.loading && !(feed.error && feed.posts.length === 0);
  const [pulseSnapshot, setPulseSnapshot] = useState<{ scope: string; posts: Post[] } | null>(null);
  useEffect(() => {
    if (unfilteredPlaceLoaded && pulseScope) setPulseSnapshot({ scope: pulseScope, posts: feed.posts });
  }, [unfilteredPlaceLoaded, pulseScope, feed.posts]);
  const pulsePosts = unfilteredPlaceLoaded
    ? feed.posts
    : (pulseSnapshot && pulseSnapshot.scope === pulseScope ? pulseSnapshot.posts : null);

  // Composer sports pre-prime: when the composer opens from the Sports lane,
  // these map `sportsMode`/primaryEvent into the composer's initial topic
  // state so the post carries topic/sports_scope/event_key automatically.
  const [composeSportsSeed, setComposeSportsSeed] = useState<{
    scope: string | null;
    metadata: SportsComposerMetadata;
    contentSeed?: string;
    postTypePreset?: PostType | null;
    modalOnly?: boolean;
  }>({ scope: null, metadata: {} });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prefs = useFeedPreferences(showToast, useCallback(() => feed.loadFeed(true), [feed.loadFeed]));

  const showComposer = feed.surface !== 'personas' && !(feed.surface === 'place' && !feed.placeEligible);

  // Derive the Sports mode chip row with a dynamic label for the "event" chip
  // pulled from active_sports_events.short_label. Hide the chip entirely when
  // no event is active so we never ship dead labels.
  const primaryEvent = activeEvents.primaryEvent;
  const sportsModeChips = inSportsLane
    ? SPORTS_MODES
        .filter((m) => m.key !== 'event' || !!primaryEvent)
        .map((m) => (m.key === 'event' && primaryEvent
          ? { ...m, label: primaryEvent.short_label || primaryEvent.display_name }
          : m))
    : [];

  // When the user opens compose from the Sports lane, stamp the seed so the
  // composer initial props prime topic/scope/event metadata.
  const seedSportsComposer = useCallback(
    (opts?: { starter?: SportsStarter; fromEventModule?: boolean }) => {
      const meta: SportsComposerMetadata = {};
      let scope: string | null = null;
      let contentSeed: string | undefined;
      let postTypePreset: PostType | null = null;
      const modalOnly = Boolean(opts?.starter);
      const validStarterKeys = new Set(['anyone_watching', 'best_place_watch', 'youth_signups', 'pickup_weekend']);
      if (opts?.starter) {
        if (opts.starter.scope) scope = opts.starter.scope;
        if (opts.starter.isGameThread) meta.is_game_thread = true;
        if (opts.starter.isWatchPrompt) meta.is_watch_prompt = true;
        if (validStarterKeys.has(opts.starter.key)) {
          meta.starter_key = opts.starter.key as SportsComposerMetadata['starter_key'];
        }
        if (opts.starter.placeholder) contentSeed = opts.starter.placeholder;
        postTypePreset = 'ask_local';
      }
      if (feed.sportsMode === 'watch' && !scope) {
        scope = 'watch';
        meta.is_watch_prompt = true;
      }
      if ((feed.sportsMode === 'event' || opts?.fromEventModule) && primaryEvent?.event_key) {
        meta.event_key = feed.eventKey || primaryEvent.event_key;
      }
      setComposeSportsSeed({ scope, metadata: meta, contentSeed, postTypePreset, modalOnly });
    },
    [feed.sportsMode, feed.eventKey, primaryEvent?.event_key],
  );
  const reloadFeed = feed.loadFeed;

  useEffect(() => {
    if (showCompose) return;
    setComposeSportsSeed((prev) => (
      prev.modalOnly
        ? { scope: null, metadata: {}, contentSeed: undefined, postTypePreset: null, modalOnly: false }
        : { ...prev, contentSeed: undefined, postTypePreset: null }
    ));
  }, [showCompose]);

  useEffect(() => {
    if (!showComposer && showCompose) {
      setShowCompose(false);
    }
  }, [showComposer, showCompose]);

  useEffect(() => {
    if (searchParams?.get('compose') !== '1' || !feed.user) return;

    if (showComposer) {
      setShowCompose(true);
    } else {
      showToast(feed.eligibilityReason || 'Posting is unavailable on the current Place surface.');
    }

    const remainingParams = new URLSearchParams(searchParams.toString());
    remainingParams.delete('compose');
    const query = remainingParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [feed.eligibilityReason, feed.user, pathname, router, searchParams, showComposer, showToast]);

  useEffect(() => {
    const handlePostCreated = () => {
      reloadFeed(true);
    };
    window.addEventListener(FEED_POST_CREATED_EVENT, handlePostCreated);
    return () => window.removeEventListener(FEED_POST_CREATED_EVENT, handlePostCreated);
  }, [reloadFeed]);

  const handleOpenDetail = (postId: string) => {
    setDetailPostId(postId);
    setDetailOpen(true);
  };

  // ── Feed virtualizer ──────────────────────────────────────
  const feedScrollRef = useRef<HTMLDivElement>(null);
  // New posts above the reading position wait behind a pill (Instant Screens).
  const listed = useNewPostsPill(feed.posts, {
    listKey: [feed.surface, feed.filter, feed.topic ?? '', feed.sportsMode ?? '', feed.eventKey ?? '',
      area.viewingLat ?? '', area.viewingLng ?? '', area.radiusMiles ?? ''].join('|'),
    scrollRef: feedScrollRef,
    currentUserId: feed.user?.id,
  });
  const virtualizer = useVirtualizer({
    count: listed.posts.length,
    getScrollElement: () => feedScrollRef.current,
    estimateSize: () => 400,
    overscan: 5,
  });

  // Trigger infinite scroll when the last virtual item is near the viewport
  useEffect(() => {
    const lastItem = virtualizer.getVirtualItems().at(-1);
    if (!lastItem) return;
    if (
      lastItem.index >= listed.posts.length - 1 &&
      feed.hasMore &&
      !feed.loading &&
      !feed.loadingMore
    ) {
      feed.loadFeed(false);
    }
  }, [virtualizer.getVirtualItems(), feed.hasMore, feed.loading, feed.loadingMore, listed.posts.length, feed.loadFeed]);

  // ── The Pulse header (founder request 2026-10-22) ─────────
  // One header block over the content, which fills the screen: sticky over the list, overlaid on
  // the full-screen map. It slides away as the list scrolls down or the map is dragged up, and
  // comes back on the way up (usePulseQuickReturn). Nothing on it is removed.
  const reducedMotion = useReducedMotion();
  const listHasNothingToScroll = feed.loading || areaResolving || areaFailed || feed.error || feed.posts.length === 0;
  const quick = usePulseQuickReturn({
    mode: viewMode,
    // Beacons keeps its header, as in the apps; the list keeps it while loading, empty or failed.
    canHide: feed.surface !== 'personas' && (viewMode === 'map' || !listHasNothingToScroll),
    resetKey: [
      viewMode, feed.surface, feed.filter, feed.topic ?? '', feed.sportsMode ?? '',
      area.viewingLat ?? '', area.viewingLng ?? '', area.radiusMiles ?? '', area.showAreaPicker ? 'search' : '',
    ].join('|'),
    listScrollRef: feedScrollRef,
    reducedMotion,
  });
  const headerElement = useRef<HTMLDivElement | null>(null);
  const quickHeaderRef = quick.headerRef;
  const setHeaderElement = useCallback((el: HTMLDivElement | null) => {
    headerElement.current = el;
    quickHeaderRef(el);
  }, [quickHeaderRef]);
  // Map mode: the map's intent chips and post count render into the header (FeedMap portals them).
  const [mapHeaderSlot, setMapHeaderSlot] = useState<HTMLDivElement | null>(null);
  const tabBarHeight = useMobileTabBarHeight(viewMode === 'map');

  const showHeader = quick.show;
  const revealHeader = useCallback(() => {
    showHeader();
    // The capsule goes away: keyboard focus continues in the header.
    requestAnimationFrame(() => headerElement.current?.focus({ preventScroll: true }));
  }, [showHeader]);

  // Slide normally; cross-fade with Reduce Motion. Hidden, it takes no clicks. Shown over the map,
  // a drag on it moves it with the pointer (--pulse-header-drag) until it tucks away.
  const headerMotionClass = `pulse-header-motion duration-200 ease-out outline-none ${
    reducedMotion ? 'transition-opacity' : 'transition-transform'
  } ${quick.hidden ? '[&_*]:!pointer-events-none' : ''}`;
  const headerMotionStyle: CSSProperties = reducedMotion
    ? { opacity: quick.hidden ? 0 : 1 }
    : { transform: quick.hidden ? 'translateY(calc(-100% - 12px))' : 'translateY(var(--pulse-header-drag, 0px))' };

  const rootClassName = viewMode === 'map'
    // The map fills the content area: under the top bar, beside the sidebar, above the phone tab bar.
    ? 'fixed inset-x-0 top-14 bg-app md:absolute md:!bottom-0'
    : 'min-h-screen bg-app';
  const rootStyle: CSSProperties | undefined = viewMode === 'map'
    ? { bottom: tabBarHeight ?? TAB_BAR_FALLBACK }
    : undefined;

  // Header: Nearby's Pulse | Neighborhood switch, then View Toggle + Surface Tabs and the area.
  const headerContent = (
    <div className="max-w-2xl mx-auto px-4 py-2">
      <NearbyTabs active="pulse" className="mb-2" />
      <div className="rounded-2xl border border-app bg-surface overflow-hidden shadow-sm/80 dark:border-slate-700/80">
        <div className="flex items-center justify-between px-4 py-2 border-b border-app">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-muted text-app-muted hover-bg-app'
              }`}
            >
              <ClipboardList className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'map'
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-muted text-app-muted hover-bg-app'
              }`}
            >
              <MapIcon className="w-4 h-4" /> Map
            </button>
          </div>
          <button
            onClick={() => prefs.setShowPrefs(true)}
            className="p-2 rounded-lg hover-bg-app transition text-app-muted"
            title="Pulse preferences"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-app">
          {SURFACE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                feed.handleSurfaceChange(tab.key);
                const params = new URLSearchParams(searchParams?.toString() ?? '');
                params.set('surface', tab.key);
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                feed.surface === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-app-muted hover:text-app'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {feed.surface === 'personas' && (
          <nav aria-label="Beacon discovery" className="flex flex-wrap gap-4 text-sm font-semibold text-primary-600">
            <Link href="/app/beacons">Find Beacons and manage following</Link>
          </nav>
        )}
        {/* Area picker (Place surface only) */}
        {feed.surface === 'place' && (
          <div className="border-b border-app px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-app-muted">
                <span className="font-semibold text-app">Viewing:</span>{' '}
                <span className="truncate">{area.viewingLabel}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={area.useCurrentArea}
                  className="px-2 py-1 text-[11px] rounded-md bg-surface-muted text-app-muted hover-bg-app transition"
                >
                  Use my location
                </button>
                <button
                  onClick={() => area.setShowAreaPicker((v) => !v)}
                  className="px-2 py-1 text-[11px] rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 transition"
                >
                  {area.showAreaPicker ? 'Close' : 'Change area'}
                </button>
              </div>
            </div>
            {area.showAreaPicker && (
              <div className="mt-2 space-y-2">
                <input
                  value={area.areaQuery}
                  onChange={(e) => area.setAreaQuery(e.target.value)}
                  placeholder="Search city, address, neighborhood..."
                  className="w-full px-3 py-2 text-sm border border-app bg-surface text-app placeholder:text-app-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <div className="max-h-52 overflow-auto border border-app rounded-lg bg-surface">
                  {area.areaSearching ? (
                    <div className="px-3 py-2 text-xs text-app-muted">Searching…</div>
                  ) : area.areaSuggestions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-app-muted">No matches yet</div>
                  ) : (
                    area.areaSuggestions.map((s: Record<string, any>, idx: number) => {
                      const label = typeof s.label === 'string' ? s.label : '';
                      const text = typeof s.text === 'string' ? s.text : label || 'Unknown place';

                      return (
                        <button
                          key={`${String(s.place_id || s.label || 'area')}-${idx}`}
                          onClick={() => area.selectAreaSuggestion(s)}
                          className="w-full text-left px-3 py-2 border-b last:border-b-0 border-app hover-bg-app transition"
                        >
                          <div className="text-xs font-medium text-app truncate">{text}</div>
                          {label && <div className="text-[11px] text-app-muted truncate">{label}</div>}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={rootClassName} style={rootStyle}>
      <h1 className="sr-only">Pulse</h1>
      {viewMode === 'map' ? (
        /* Map View: the map fills the screen; the header floats over its top. */
        <div className="absolute inset-0 isolate overflow-hidden">
          <FeedMap
            postTypeFilter={feed.filter}
            onFilterChange={(f) => feed.setFilter(f as FilterType)}
            surface={feed.surface}
            userLat={area.viewingLat}
            userLng={area.viewingLng}
            onUseCurrentLocation={area.handleMapUseCurrentLocation}
            onViewPost={handleOpenDetail}
            headerSlot={mapHeaderSlot}
            topInset={quick.hidden ? REVEAL_CAPSULE_BOTTOM_PX : quick.headerHeight}
            onUserPanStart={quick.mapPanStart}
            onUserPan={quick.mapPan}
          />

          {/* Flicked up, it tucks away; focus in it keeps it (usePulseQuickReturn listens on it). */}
          <div
            ref={setHeaderElement}
            data-testid="pulseHeader"
            tabIndex={-1}
            className={`pulse-header-flick absolute inset-x-0 top-0 z-[1100] pointer-events-none ${headerMotionClass}`}
            style={headerMotionStyle}
          >
            {/* Phones: full width. Wider screens: the centred card, hanging from the top bar. */}
            <div className="pointer-events-auto bg-surface border-b border-app/60 md:mx-auto md:max-w-2xl md:rounded-b-2xl md:border-x md:shadow-lg dark:backdrop-blur-sm">
              {headerContent}
            </div>
            <div ref={setMapHeaderSlot} />
          </div>

          {quick.hidden && (
            <button
              type="button"
              data-testid="pulseHeaderReveal"
              aria-label="Show the Pulse header"
              onClick={revealHeader}
              // Pulled down, it brings the header back too.
              onPointerDown={(event) => quick.onRevealPointerDown(event, revealHeader)}
              className="absolute left-1/2 top-2 z-[1100] flex h-8 -translate-x-1/2 touch-none items-center gap-1.5 rounded-full border border-app bg-app-surface/80 px-3 text-xs font-semibold text-app shadow-md backdrop-blur-md animate-fade-in hover-bg-app"
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
              <span>Pulse · {mapFilterLabel(feed.surface === 'place' ? feed.filter : 'all')}</span>
            </button>
          )}
        </div>
      ) : (
        <div>
          <div
            ref={setHeaderElement}
            data-testid="pulseHeader"
            tabIndex={-1}
            className={`sticky top-14 z-30 ${headerMotionClass}`}
            style={headerMotionStyle}
          >
            <div className="bg-surface border-b border-app/60 dark:backdrop-blur-sm">
              {headerContent}
            </div>
          </div>

          {/* List View */}
          <div className="px-4 py-6 space-y-4 max-w-2xl mx-auto">
            {feed.surface === 'place' && <NeighborhoodPulse posts={pulsePosts} />}

            {/* Launch cut #6 (Business directory): no nearby business suggestions. */}
            {launchFeatures.businessDirectory && feed.surface === 'place' && (
              <NearbyProvidersCard
                userLat={area.viewingLat}
                userLng={area.viewingLng}
                onContact={(id, name) => setChatTarget({ id, name })}
              />
            )}

            {showComposer && (
              <PostComposer
                onPost={feed.handleCreatePost}
                isPosting={feed.isPosting}
                user={feed.user}
                activeSurface={feed.surface}
                initialTopic={inSportsLane ? 'sports' : null}
                initialSportsScope={inSportsLane && !composeSportsSeed.modalOnly ? composeSportsSeed.scope : null}
                initialSportsMetadata={inSportsLane && !composeSportsSeed.modalOnly ? composeSportsSeed.metadata : undefined}
                onLeaveSportsTopic={() => feed.setTopic(null)}
              />
            )}

            {/* Where the composer would be, say why posting is off here (iOS shows the same reason). */}
            {!showComposer && feed.surface === 'place' && feed.eligibilityReason && (
              <p
                role="note"
                className="rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-secondary"
              >
                {feed.eligibilityReason}
              </p>
            )}

            {feed.surface === 'place' && (
              <TopicChipRow
                topics={PLACE_TOPICS.map((t) => ({ key: t.key, label: t.label, icon: <Trophy className="w-4 h-4" /> }))}
                activeTopic={feed.topic}
                onTopicChange={feed.setTopic}
              />
            )}

            {inSportsLane && sportsModeChips.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                {sportsModeChips.map((m) => {
                  const isActive = (feed.sportsMode || 'for_you') === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => {
                        feed.setSportsMode(m.key as SportsMode);
                        if (m.key === 'event' && primaryEvent?.event_key) {
                          feed.setEventKey(primaryEvent.event_key);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                        isActive
                          ? 'bg-primary-600 text-white shadow-md'
                          : 'bg-surface text-app-muted border border-app hover-bg-app hover:shadow-sm'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}

            {inSportsLane && primaryEvent && (
              <SportsEventModule
                primaryEvent={primaryEvent}
                onStartThread={() => {
                  seedSportsComposer({ fromEventModule: true });
                  setShowCompose(true);
                }}
                onSelectEventMode={(ek) => {
                  feed.setEventKey(ek);
                  feed.setSportsMode('event');
                }}
              />
            )}

            {!inSportsLane && (
              <FeedFilters
                selected={feed.filter}
                onChange={feed.setFilter}
                surface={feed.surface}
                onMuteTopic={feed.handleMuteTopic}
              />
            )}

            {feed.error && (
              <div role="alert" aria-busy={feed.retrying}>
                <ErrorState
                  message="We couldn't load your feed. Please try again."
                  onRetry={feed.retryFeed}
                />
              </div>
            )}
            {areaFailed && (
              <div role="alert">
                <ErrorState
                  message="We couldn't load your area. Please try again."
                  onRetry={area.retryResolveArea}
                />
              </div>
            )}
            {feed.loading || areaResolving ? (
              <div className="space-y-4">
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
              </div>
            ) : (feed.error && feed.posts.length === 0) || areaFailed ? null : feed.posts.length === 0 ? (
              <>
                {/* "Discover <area> / be the first" only once an area was searched, never over "Set an area". */}
                {feed.surface === 'place' && hasViewingArea && (
                  <SparseFeedSummary
                    locationLabel={area.viewingLabel}
                    onFilterChange={(f) => feed.setFilter(f as FilterType)}
                  />
                )}
                <EmptyFeed
                  filter={feed.filter}
                  surface={feed.surface}
                  locationLabel={area.viewingLabel}
                  locationLat={area.viewingLat}
                  locationLng={area.viewingLng}
                  radiusMiles={area.radiusMiles}
                  topic={feed.topic}
                  sportsMode={feed.sportsMode}
                  noActiveEvent={inSportsLane && feed.sportsMode === 'event' && !primaryEvent}
                  onStarterPress={(starter) => {
                    seedSportsComposer({ starter });
                    setShowCompose(true);
                  }}
                />
              </>
            ) : (
              <>
                {feed.surface === 'place' && hasViewingArea && feed.posts.length < 3 && (
                  <SparseFeedSummary
                    locationLabel={area.viewingLabel}
                    onFilterChange={(f) => feed.setFilter(f as FilterType)}
                  />
                )}

                <div
                  ref={feedScrollRef}
                  className="overflow-y-auto"
                  style={{ height: 'calc(100vh - 200px)' }}
                >
                  {listed.newCount > 0 && (
                    // Zero height: it floats over the list without moving a card.
                    <div className="sticky top-2 z-10 h-0 flex items-start justify-center pointer-events-none">
                      <button
                        type="button"
                        onClick={listed.showNewPosts}
                        className="pointer-events-auto px-3 py-1.5 rounded-full text-xs border border-app-border-strong bg-surface text-app-text-strong hover-bg-app shadow-sm"
                      >
                        {listed.newCount === 1 ? '1 new post' : `${listed.newCount} new posts`} <span aria-hidden="true">↑</span>
                      </button>
                    </div>
                  )}
                  <div
                    style={{
                      height: virtualizer.getTotalSize(),
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const post = listed.posts[virtualRow.index];
                      return (
                        <div
                          key={post.id}
                          data-index={virtualRow.index}
                          ref={virtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <div className="pb-4">
                            <PostCard
                              post={post}
                              onLike={feed.handleLike}
                              onSave={feed.handleSave}
                              onDelete={feed.handleDelete}
                              onEdit={setEditingPost}
                              onComment={handleOpenDetail}
                              onOpenDetail={handleOpenDetail}
                              onReport={handleReport}
                              onHide={feed.handleHide}
                              onDismissSeeded={feed.handleDismissSeeded}
                              onMute={feed.handleMute}
                              onNotHelpful={feed.handleNotHelpful}
                              onSolved={feed.handleSolved}
                              currentUserId={feed.user?.id}
                              isLiking={feed.likingIds.has(post.id)}
                              isSaving={feed.savingIds.has(post.id)}
                              surface={feed.surface}
                              showToast={showToast}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div ref={feed.sentinelRef} className="h-1" />

                  {feed.loadingMore && (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-app border-t-primary-500 rounded-full animate-spin" />
                    </div>
                  )}

                  {!feed.error && !feed.hasMore && feed.posts.length > 0 && (
                    <div className="text-center py-6">
                      <span className="text-xs text-app-muted">You&apos;re all caught up</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Compose Modal (shared by list + map) */}
      {showCompose && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4"
            onClick={() => setShowCompose(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-[61] w-full max-w-lg max-h-[85vh] -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl border border-app shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-app">
              <h3 className="text-sm font-bold text-app">New Post</h3>
              <button aria-label="Close"
                onClick={() => setShowCompose(false)}
                className="p-1.5 text-app-muted hover:text-app hover-bg-app rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <PostComposer
                onPost={async (data) => {
                  const saved = await feed.handleCreatePost(data);
                  if (saved) setShowCompose(false);
                  return saved;
                }}
                isPosting={feed.isPosting}
                user={feed.user}
                activeSurface={feed.surface}
                initialTopic={inSportsLane ? 'sports' : null}
                initialSportsScope={inSportsLane ? composeSportsSeed.scope : null}
                initialSportsMetadata={inSportsLane ? composeSportsSeed.metadata : undefined}
                initialSportsContentSeed={inSportsLane ? composeSportsSeed.contentSeed : null}
                initialSportsPostType={inSportsLane ? composeSportsSeed.postTypePreset : null}
                onLeaveSportsTopic={() => feed.setTopic(null)}
              />
            </div>
          </div>
        </>
      )}

      {/* Feed Preferences Modal. Rendered into document.body: inside the app's <main> (its own stacking context) the
          phone tab bar and the floating chat and + buttons stayed on top of it and covered its close button and checkboxes. */}
      {prefs.showPrefs && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-app shadow-2xl p-6 w-full max-w-sm max-h-[85dvh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-app">Pulse Preferences</h3>
              <button onClick={() => prefs.setShowPrefs(false)} aria-label="Close Pulse preferences" className="text-app-muted hover:text-app transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {prefs.prefs && (
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-app">Hide deals in Place feed</span>
                  <input
                    type="checkbox"
                    checked={prefs.prefs.hide_deals_place}
                    onChange={(e) => prefs.updatePref('hideDealsPlace', e.target.checked)}
                    className="rounded text-primary-600"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-app">Hide alerts in Place feed</span>
                  <input
                    type="checkbox"
                    checked={prefs.prefs.hide_alerts_place}
                    onChange={(e) => prefs.updatePref('hideAlertsPlace', e.target.checked)}
                    className="rounded text-primary-600"
                  />
                </label>

                <div className="pt-2 mt-2 border-t border-app">
                  <p className="text-xs font-semibold text-app-muted uppercase tracking-wider mb-2">Political Content</p>
                  <div className="flex items-center justify-between py-1.5">
                    <div>
                      <p id="feed-politics-connections-label" className="text-sm text-app">Show in Connections</p>
                      <p className="text-[11px] text-app-muted">Political posts are hidden by default</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!prefs.prefs.show_politics_connections}
                      aria-labelledby="feed-politics-connections-label"
                      onClick={() => {
                        const next = !prefs.prefs!.show_politics_connections;
                        prefs.updatePref('showPoliticsConnections', next);
                      }}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                        prefs.prefs.show_politics_connections ? 'bg-blue-600' : 'bg-surface-muted border border-app'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-surface shadow transform transition-transform ${
                        prefs.prefs.show_politics_connections ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="pt-2 border-t border-app space-y-2">
              {prefs.actionError && <p role="alert" className="text-sm text-red-600">{prefs.actionError}</p>}
              <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wider">Muted categories</h4>
              {prefs.mutesLoading ? <p className="text-sm text-app-muted">Loading muted categories…</p> : prefs.mutesError ? (
                <div className="text-sm text-app-muted">
                  <p>Couldn’t load muted categories.</p>
                  <button onClick={() => void prefs.retryMutes()} className="py-2 text-primary-600">Try again</button>
                </div>
              ) : prefs.mutedCategories.length === 0 ? <p className="text-sm text-app-muted">No muted categories.</p> : (
                <>
                  <p className="text-xs text-app-muted">Unmute a category in all feeds.</p>
                  {prefs.mutedCategories.map((mute) => (
                    <div key={mute.topic} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-app">{getPostTypeConfig(mute.topic).label}</span>
                      <button
                        disabled={!!prefs.unmutingCategory}
                        aria-label={`Unmute ${getPostTypeConfig(mute.topic).label}`}
                        onClick={() => void prefs.unmuteCategory(mute.topic)}
                        className="py-2 text-sm text-primary-600 disabled:opacity-50"
                      >{prefs.unmutingCategory === mute.topic ? 'Unmuting…' : 'Unmute'}</button>
                    </div>
                  ))}
                </>
              )}
            </div>
            {!prefs.prefs && prefs.prefsError ? (
              <div className="text-center py-4 text-sm text-app-muted">
                <p>Couldn’t load preferences.</p>
                <button onClick={() => void prefs.retryPrefs()} className="py-2 text-primary-600">Try again</button>
              </div>
            ) : !prefs.prefs && (
              <div className="text-center py-4">
                <div className="w-5 h-5 border-2 border-app border-t-primary-500 rounded-full animate-spin mx-auto" />
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* Post Detail Slide Panel */}
      <PostDetailPanel
        postId={detailPostId}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailPostId(null);
        }}
        currentUserId={feed.user?.id}
        initialPost={detailPostId ? feed.posts.find((post) => post.id === detailPostId) || null : null}
        onPostChange={feed.patchPost}
      />

      {/* Edit one of your own posts */}
      {editingPost && (
        <EditPostDialog
          post={editingPost}
          user={feed.user}
          onClose={() => setEditingPost(null)}
          onSaved={(postId, changes) => {
            feed.patchPost(postId, changes);
            setEditingPost(null);
            showToast('Post updated');
          }}
          onGone={(postId) => {
            feed.forgetPost(postId);
            setEditingPost(null);
            showToast('This post was deleted, so it can’t be edited.');
          }}
        />
      )}

      {/* Report Modal */}
      <ReportModal
        open={!!reportPostId}
        onClose={() => setReportPostId(null)}
        onSubmit={async (reason, details) => {
          if (reportPostId) {
            await feed.handleReport(reportPostId, reason as Parameters<typeof feed.handleReport>[1], details);
          }
        }}
        entityType="post"
      />

      {/* Toast — the live region stays mounted so screen readers announce each message. The wrapper
          centres it: slideUp animates `transform`, which would replace a translate-based centring.
          --fab-lift lifts it above the phone tab bar: inside <main>'s stacking context, z-index can't. */}
      <div role="status" aria-live="polite">
        {toast && (
          <div className="fixed inset-x-0 bottom-[calc(1.5rem+var(--fab-lift,0px))] z-[100] flex justify-center pointer-events-none">
            <div className="max-w-[50vw] bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-2xl animate-[slideUp_0.3s_ease-out]">
              {toast}
            </div>
          </div>
        )}
      </div>

      {/* Inline Chat Drawer (from Nearby Providers) */}
      {chatTarget && (
        <InquiryChatDrawer
          businessUserId={chatTarget.id}
          businessName={chatTarget.name}
          onClose={() => setChatTarget(null)}
        />
      )}
    </div>
  );
}
