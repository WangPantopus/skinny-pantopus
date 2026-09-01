'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  MapPin, Link as LinkIcon, Radio, Trophy,
  ClipboardList, Map as MapIcon, Settings,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { FeedSurface, PostType } from '@pantopus/api';
import {
  PostComposer, PostCard, PostDetailPanel, FeedFilters, NearbyProvidersCard,
  NeighborhoodPulse, EmptyFeed, SparseFeedSummary, PostSkeleton,
  TopicChipRow, SportsEventModule,
} from '@/components/feed';
import type { SportsStarter } from '@/components/feed/EmptyFeed';
import ReportModal from '@/components/ui/ReportModal';
import InquiryChatDrawer from '@/components/discover/InquiryChatDrawer';
import { useAreaPicker } from '@/hooks/useAreaPicker';
import { useFeedPreferences } from '@/hooks/useFeedPreferences';
import { useFeedData, type FilterType } from '@/hooks/useFeedData';
import { useActiveSportsEvents } from '@/hooks/useActiveSportsEvents';
import {
  PLACE_TOPICS, SPORTS_MODES,
  type SportsComposerMetadata, type SportsMode,
} from '@/constants/feedTopics';
import { FEED_POST_CREATED_EVENT } from '@/lib/feedComposerEvents';

const FeedMap = dynamic(() => import('./FeedMap'), { ssr: false });

const SURFACE_TABS: { key: FeedSurface; label: string; icon: ReactNode }[] = [
  { key: 'place', label: 'Place', icon: <MapPin className="w-4 h-4 inline-block" /> },
  { key: 'personas', label: 'Beacons', icon: <Radio className="w-4 h-4 inline-block" /> },
  { key: 'connections', label: 'Connections', icon: <LinkIcon className="w-4 h-4 inline-block" /> },
];

export default function FeedPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showCompose, setShowCompose] = useState(false);
  const [toast, setToast] = useState('');
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<{ id: string; name: string } | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const handleReport = useCallback((postId: string) => setReportPostId(postId), []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const area = useAreaPicker(showToast);

  const feed = useFeedData({
    viewingLat: area.viewingLat,
    viewingLng: area.viewingLng,
    userLat: area.userLat,
    userLng: area.userLng,
    gpsTimestamp: area.gpsTimestamp,
    radiusMiles: area.radiusMiles,
    showToast,
  });

  const inSportsLane = feed.surface === 'place' && feed.topic === 'sports';
  const activeEvents = useActiveSportsEvents(inSportsLane);

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
    if (searchParams.get('compose') !== '1') return;

    if (showComposer) {
      setShowCompose(true);
    } else {
      showToast(feed.eligibilityReason || 'Posting is unavailable on the current Place surface.');
    }

    router.replace(pathname, { scroll: false });
  }, [feed.eligibilityReason, pathname, router, searchParams, showComposer, showToast]);

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
  const virtualizer = useVirtualizer({
    count: feed.posts.length,
    getScrollElement: () => feedScrollRef.current,
    estimateSize: () => 400,
    overscan: 5,
  });

  // Trigger infinite scroll when the last virtual item is near the viewport
  useEffect(() => {
    const lastItem = virtualizer.getVirtualItems().at(-1);
    if (!lastItem) return;
    if (
      lastItem.index >= feed.posts.length - 1 &&
      feed.hasMore &&
      !feed.loading &&
      !feed.loadingMore
    ) {
      feed.loadFeed(false);
    }
  }, [virtualizer.getVirtualItems(), feed.hasMore, feed.loading, feed.loadingMore, feed.posts.length, feed.loadFeed]);

  const rootClassName = viewMode === 'map'
    ? 'h-[calc(100vh-64px)] bg-app flex flex-col'
    : 'min-h-screen bg-app';

  return (
    <div className={rootClassName}>
      <div className={viewMode === 'map' ? 'flex-1 min-h-0 flex flex-col' : ''}>
        {/* Header: View Toggle + Surface Tabs */}
        <div className="bg-surface border-b border-app/60 dark:backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-2">
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
                    onClick={() => feed.handleSurfaceChange(tab.key)}
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
        </div>

        {/* Map View */}
        {viewMode === 'map' ? (
          <div className="flex-1 min-h-0 relative">
            <FeedMap
              postTypeFilter={feed.filter}
              onFilterChange={(f) => feed.setFilter(f as FilterType)}
              surface={feed.surface}
              userLat={area.viewingLat}
              userLng={area.viewingLng}
              onUseCurrentLocation={area.handleMapUseCurrentLocation}
              onViewPost={handleOpenDetail}
            />
          </div>
        ) : (
          /* List View */
          <div className="px-4 py-6 space-y-4 max-w-2xl mx-auto">
            {feed.surface === 'place' && <NeighborhoodPulse posts={feed.posts} />}

            {feed.surface === 'place' && (
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

            {feed.loading ? (
              <div className="space-y-4">
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
              </div>
            ) : feed.posts.length === 0 ? (
              <>
                {feed.surface === 'place' && (
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
                {feed.surface === 'place' && feed.posts.length < 3 && (
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
                  <div
                    style={{
                      height: virtualizer.getTotalSize(),
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const post = feed.posts[virtualRow.index];
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
                              onComment={handleOpenDetail}
                              onOpenDetail={handleOpenDetail}
                              onReport={handleReport}
                              onHide={feed.handleHide}
                              onMute={feed.handleMute}
                              onNotHelpful={feed.handleNotHelpful}
                              onSolved={feed.handleSolved}
                              currentUserId={feed.user?.id}
                              isLiking={feed.likingIds.has(post.id)}
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

                  {!feed.hasMore && feed.posts.length > 0 && (
                    <div className="text-center py-6">
                      <span className="text-xs text-app-muted">You&apos;re all caught up</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

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
              <button
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
                  await feed.handleCreatePost(data);
                  setShowCompose(false);
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

      {/* Feed Preferences Modal */}
      {prefs.showPrefs && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-app shadow-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-app">Pulse Preferences</h3>
              <button onClick={() => prefs.setShowPrefs(false)} className="text-app-muted hover:text-app transition">
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
                      <p className="text-sm text-app">Show in Connections</p>
                      <p className="text-[11px] text-app-muted">Political posts are hidden by default</p>
                    </div>
                    <button
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
            {!prefs.prefs && (
              <div className="text-center py-4">
                <div className="w-5 h-5 border-2 border-app border-t-primary-500 rounded-full animate-spin mx-auto" />
              </div>
            )}
          </div>
        </div>
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-2xl animate-[slideUp_0.3s_ease-out]">
          {toast}
        </div>
      )}

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
