'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { FeedSurface, Post, PostType } from '@pantopus/api';
import type { User } from '@pantopus/types';
import type { PostComposerSubmitData } from '@/components/feed/PostComposer';
import { queryKeys } from '@/lib/query-keys';
import type { SportsMode, TopicKey } from '@/constants/feedTopics';

export type FilterType = PostType | 'all';

interface UseFeedDataOptions {
  viewingLat: number | null;
  viewingLng: number | null;
  userLat: number | null;
  userLng: number | null;
  gpsTimestamp: string | null;
  radiusMiles: number | null;
  showToast: (msg: string) => void;
}

type FeedPage = Awaited<ReturnType<typeof api.posts.getFeedV2>>;
// Sports lane returns a richer cursor tuple: (rankBucket, createdAt, id).
type FeedCursor = { createdAt: string; id: string; rankBucket?: number } | null;

// Build the full query key with location + topic/mode params so different
// lanes produce different cache entries. Location only applies to `place`;
// topic/sportsMode/eventKey only apply when the Sports lane is active.
function buildFeedKey(
  surface: FeedSurface,
  filter: FilterType,
  locationKey: string,
  topic: TopicKey | null,
  sportsMode: SportsMode | null,
  eventKey: string | null,
) {
  return [
    ...queryKeys.feed(surface, filter),
    locationKey,
    topic ?? 'none',
    topic === 'sports' ? (sportsMode ?? 'for_you') : 'na',
    topic === 'sports' ? (eventKey ?? 'none') : 'na',
  ] as const;
}

export function useFeedData({
  viewingLat,
  viewingLng,
  userLat,
  userLng,
  gpsTimestamp,
  radiusMiles,
  showToast,
}: UseFeedDataOptions) {
  const queryClient = useQueryClient();

  const [user, setUser] = useState<User | null>(null);
  const [surface, setSurface] = useState<FeedSurface>('place');
  const [filter, setFilter] = useState<FilterType>('all');
  const [topic, setTopicState] = useState<TopicKey | null>(null);
  const [sportsMode, setSportsMode] = useState<SportsMode>('for_you');
  const [eventKey, setEventKey] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());

  // Place eligibility
  const [placeEligible, setPlaceEligible] = useState(true);
  const [eligibilityReason, setEligibilityReason] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Stable location key — only meaningful for `place` surface.
  const locationKey = useMemo(() => {
    if (surface !== 'place') return 'na';
    if (viewingLat == null || viewingLng == null) return 'nogeo';
    return `${viewingLat.toFixed(4)},${viewingLng.toFixed(4)},${radiusMiles ?? 100}`;
  }, [surface, viewingLat, viewingLng, radiusMiles]);

  const currentKey = useMemo(
    () => buildFeedKey(surface, filter, locationKey, topic, sportsMode, eventKey),
    [surface, filter, locationKey, topic, sportsMode, eventKey],
  );

  // Load user
  useEffect(() => {
    (async () => {
      try {
        const token = getAuthToken();
        if (!token) return;
        const u = await api.users.getMyProfile();
        setUser(u);
      } catch {}
    })();
  }, []);

  // Place eligibility check
  useEffect(() => {
    if (surface !== 'place' || viewingLat == null || viewingLng == null) return;
    api.posts
      .checkPlaceEligibility({
        latitude: viewingLat,
        longitude: viewingLng,
        gpsTimestamp: gpsTimestamp || undefined,
        gpsLatitude: userLat == null ? undefined : userLat,
        gpsLongitude: userLng == null ? undefined : userLng,
      })
      .then((r) => {
        setPlaceEligible(r.eligible);
        setEligibilityReason(r.reason || null);
      })
      .catch(() => setPlaceEligible(true));
  }, [surface, viewingLat, viewingLng, gpsTimestamp, userLat, userLng]);

  // ── Feed data ──────────────────────────────────────────────
  const feedQuery = useInfiniteQuery<FeedPage, Error, InfiniteData<FeedPage>, typeof currentKey, FeedCursor>({
    queryKey: currentKey,
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const params: Parameters<typeof api.posts.getFeedV2>[0] = {
        surface,
        limit: 20,
      };

      // The Sports topic lane swaps the post-type chip row for a mode row
      // (For You / Local / Event / Watch). Don't send postType in that case —
      // the sports lane API ignores it and the chip filter state carries
      // sportsMode instead.
      const isSportsLane = surface === 'place' && topic === 'sports';

      if (surface === 'place' && filter !== 'all' && !isSportsLane) {
        params.postType = filter as PostType;
      }

      if (isSportsLane) {
        params.topic = 'sports';
        params.sportsMode = sportsMode;
        if (eventKey) params.eventKey = eventKey;
      }

      if (surface === 'place' && viewingLat != null && viewingLng != null) {
        params.latitude = viewingLat;
        params.longitude = viewingLng;
        params.radiusMiles = radiusMiles ?? 100;
      }

      if (pageParam) {
        params.cursorCreatedAt = pageParam.createdAt;
        params.cursorId = pageParam.id;
        if (pageParam.rankBucket != null) {
          params.cursorRankBucket = pageParam.rankBucket;
        }
      }

      return api.posts.getFeedV2(params);
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? (lastPage.pagination.nextCursor ?? null) : undefined,
    staleTime: 30_000,
  });

  // Flatten pages into a single deduped array for consumers
  const posts = useMemo<Post[]>(() => {
    const pages = feedQuery.data?.pages ?? [];
    const seen = new Set<string>();
    const out: Post[] = [];
    for (const page of pages) {
      for (const p of page.posts || []) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
      }
    }
    return out;
  }, [feedQuery.data]);

  const loading = feedQuery.isPending;
  const loadingMore = feedQuery.isFetchingNextPage;
  const hasMore = feedQuery.hasNextPage ?? false;

  // Load feed — preserves external signature: loadFeed(reset?: boolean)
  const loadFeed = useCallback(
    async (reset = false) => {
      if (reset) {
        await queryClient.resetQueries({ queryKey: currentKey, exact: true });
      } else if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
        await feedQuery.fetchNextPage();
      }
    },
    [queryClient, currentKey, feedQuery],
  );

  // Infinite scroll — keep sentinel observer for back-compat (P1.5 primary path
  // is virtualizer-driven; this is a fallback).
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && hasMore) {
          feedQuery.fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [feedQuery, loading, loadingMore, hasMore]);

  // ── Cache mutation helpers ─────────────────────────────────
  const updatePostsInCache = useCallback(
    (updater: (post: Post) => Post) => {
      queryClient.setQueryData<InfiniteData<FeedPage>>(currentKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: (page.posts || []).map(updater),
          })),
        };
      });
    },
    [queryClient, currentKey],
  );

  const removePostsFromCache = useCallback(
    (predicate: (post: Post) => boolean) => {
      queryClient.setQueryData<InfiniteData<FeedPage>>(currentKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: (page.posts || []).filter((p) => !predicate(p)),
          })),
        };
      });
    },
    [queryClient, currentKey],
  );

  const prependPostToCache = useCallback(
    (post: Post) => {
      queryClient.setQueryData<InfiniteData<FeedPage>>(currentKey, (old) => {
        if (!old) return old;
        const [firstPage, ...rest] = old.pages;
        if (!firstPage) return old;
        return {
          ...old,
          pages: [
            { ...firstPage, posts: [post, ...(firstPage.posts || [])] },
            ...rest,
          ],
        };
      });
    },
    [queryClient, currentKey],
  );

  // Surface change handler — leaving Place clears the active topic (topics
  // are Place-only in Phase 1 since the union needs a viewing location).
  const handleSurfaceChange = useCallback((newSurface: FeedSurface) => {
    if (newSurface === surface) return;
    setSurface(newSurface);
    setFilter('all');
    if (newSurface !== 'place') setTopicState(null);
  }, [surface]);

  // Topic toggle — entering a topic resets the post-type filter and sports
  // mode; leaving returns to the default "All" chip.
  const setTopic = useCallback((next: TopicKey | null) => {
    setTopicState(next);
    setFilter('all');
    if (next != null) setSportsMode('for_you');
  }, []);

  // Post actions
  const handleCreatePost = useCallback(async (data: PostComposerSubmitData) => {
    setIsPosting(true);
    try {
      const { mediaFiles, ...composerData } = data;
      const postData = { ...composerData } as Parameters<typeof api.posts.createPost>[0];
      if (surface === 'connections') {
        if (postData.audience == null) postData.audience = 'connections';
        if (postData.visibility == null) postData.visibility = 'connections';
      }
      if (surface === 'place') {
        if (postData.latitude == null && viewingLat != null) postData.latitude = viewingLat;
        if (postData.longitude == null && viewingLng != null) postData.longitude = viewingLng;
      }
      if (gpsTimestamp) postData.gpsTimestamp = gpsTimestamp;
      if (userLat != null) postData.gpsLatitude = userLat;
      if (userLng != null) postData.gpsLongitude = userLng;
      const res = await api.posts.createPost(postData);
      const newPost = res.post;

      const files = Array.isArray(mediaFiles) ? mediaFiles as File[] : [];
      if (files.length > 0) {
        try {
          const uploadResult = await api.upload.uploadPostMedia(newPost.id, files);
          newPost.media_urls = uploadResult.media_urls;
          newPost.media_types = uploadResult.media_types;
          await api.posts.updatePost(newPost.id, {
            mediaUrls: uploadResult.media_urls,
            mediaTypes: uploadResult.media_types,
          });
        } catch {
          if (!newPost.media_urls || newPost.media_urls.length === 0) {
            showToast('Post created, but media upload failed');
          }
        }
      }

      prependPostToCache(newPost);
      showToast('Posted!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setIsPosting(false);
    }
  }, [surface, viewingLat, viewingLng, gpsTimestamp, userLat, userLng, showToast, prependPostToCache]);

  // ── Like mutation (optimistic with automatic rollback) ──
  const likeMutation = useMutation({
    mutationFn: (postId: string) => api.posts.toggleLike(postId),
    onMutate: (postId: string) => {
      setLikingIds((prev) => new Set(prev).add(postId));
      const toggleLike = (p: Post): Post =>
        p.id === postId
          ? {
              ...p,
              userHasLiked: !p.userHasLiked,
              like_count: p.userHasLiked ? Math.max(0, p.like_count - 1) : p.like_count + 1,
            }
          : p;
      updatePostsInCache(toggleLike);
      return { toggleLike };
    },
    onError: (_err, _postId, context) => {
      if (context) updatePostsInCache(context.toggleLike);
    },
    onSettled: (_data, _err, postId) => {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    },
  });

  const handleLike = useCallback((postId: string) => {
    if (likingIds.has(postId)) return;
    likeMutation.mutate(postId);
  }, [likingIds, likeMutation]);

  // ── Save mutation (optimistic with automatic rollback) ──
  const saveMutation = useMutation({
    mutationFn: (postId: string) => api.posts.toggleSave(postId),
    onMutate: (postId: string) => {
      const previousSaved = posts.find((p) => p.id === postId)?.userHasSaved ?? false;
      updatePostsInCache((p) => (p.id === postId ? { ...p, userHasSaved: !previousSaved } : p));
      return { postId, previousSaved };
    },
    onSuccess: (res, postId) => {
      updatePostsInCache((p) => (p.id === postId ? { ...p, userHasSaved: res.saved } : p));
      showToast(res.saved ? 'Post saved' : 'Removed from saved');
    },
    onError: (_err, _postId, context) => {
      if (!context) return;
      updatePostsInCache((p) => (p.id === context.postId ? { ...p, userHasSaved: context.previousSaved } : p));
      showToast('Failed to update save');
    },
  });

  const handleSave = useCallback((postId: string) => {
    saveMutation.mutate(postId);
  }, [saveMutation]);

  const patchPost = useCallback((postId: string, patch: Partial<Post>) => {
    updatePostsInCache((post) => (post.id === postId ? { ...post, ...patch } : post));
  }, [updatePostsInCache]);

  const handleDelete = useCallback(async (postId: string) => {
    try {
      await api.posts.deletePost(postId);
      removePostsFromCache((p) => p.id === postId);
      showToast('Post deleted');
    } catch {
      showToast('Failed to delete post');
    }
  }, [showToast, removePostsFromCache]);

  const handleHide = useCallback(async (postId: string) => {
    try {
      await api.posts.hidePost(postId);
      removePostsFromCache((p) => p.id === postId);
      showToast('Post hidden');
    } catch {
      showToast('Failed to hide post');
    }
  }, [showToast, removePostsFromCache]);

  const handleReport = useCallback(async (
    postId: string,
    reason: Parameters<typeof api.posts.reportPost>[1]['reason'],
    details?: string,
  ) => {
    try {
      await api.posts.reportPost(postId, { reason, details });
      showToast("Post reported — we'll review it");
    } catch {
      showToast('Failed to report post');
    }
  }, [showToast]);

  const handleMute = useCallback(async (userId: string) => {
    try {
      await api.posts.muteEntity({ entityType: 'user', entityId: userId });
      removePostsFromCache((p) => (p.creator?.id || p.user_id) === userId);
      showToast('User muted — their posts are hidden from your feed');
    } catch {
      showToast('Failed to mute user');
    }
  }, [showToast, removePostsFromCache]);

  const handleMuteTopic = useCallback(async (postType: string) => {
    try {
      await api.posts.muteTopicOnSurface({ postType, surface: 'place' });
      setFilter('all');
      await loadFeed(true);
      showToast(`${postType} posts muted in Place feed`);
    } catch {
      showToast('Failed to mute topic');
    }
  }, [showToast, loadFeed]);

  const handleNotHelpful = useCallback((id: string) => {
    removePostsFromCache((p) => p.id === id);
  }, [removePostsFromCache]);

  const handleSolved = useCallback((id: string) => {
    updatePostsInCache((p) => (p.id === id ? { ...p, state: 'solved' as const } : p));
  }, [updatePostsInCache]);

  return {
    user,
    posts,
    surface,
    filter,
    setFilter,
    loading,
    loadingMore,
    hasMore,
    isPosting,
    likingIds,
    placeEligible,
    eligibilityReason,
    sentinelRef,
    loadFeed,
    handleSurfaceChange,
    handleCreatePost,
    handleLike,
    handleSave,
    handleDelete,
    handleHide,
    handleReport,
    handleMute,
    handleMuteTopic,
    handleNotHelpful,
    handleSolved,
    patchPost,
    // Sports topic lane
    topic,
    setTopic,
    sportsMode,
    setSportsMode,
    eventKey,
    setEventKey,
  };
}
