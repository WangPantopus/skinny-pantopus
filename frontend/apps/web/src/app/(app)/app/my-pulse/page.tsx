'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { Post } from '@pantopus/types';
import { EditPostDialog, PostCard, PostDetailPanel } from '@/components/feed';
import { patchPostInFeedCaches, removePostFromFeedCaches } from '@/hooks/useFeedData';
import ReportModal from '@/components/ui/ReportModal';
import { toast } from '@/components/ui/toast-store';
import ErrorState from '@/components/ui/ErrorState';
import { Bookmark, Newspaper } from 'lucide-react';
import { ListArchetype } from '@/components/archetypes';

const PAGE_SIZE = 50;

type PageCursor = { createdAt: string; id: string };
type Tab = 'mine' | 'saved';

export default function MyPulsePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Where the next (older) page starts; null once the server has no more.
  const [nextCursor, setNextCursor] = useState<PageCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  // Bumped by every first-page load so a page that lands later can't
  // append to the list that replaced it.
  const loadGeneration = useRef(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [me, setMe] = useState<Awaited<ReturnType<typeof api.users.getMyProfile>> | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>('mine');
  // Saved posts page by offset over saves; the server says where the next page starts.
  const [saved, setSaved] = useState<Post[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedLoadError, setSavedLoadError] = useState(false);
  const [savedNextOffset, setSavedNextOffset] = useState<number | null>(null);
  const [savedLoadingMore, setSavedLoadingMore] = useState(false);
  const [savedLoadMoreFailed, setSavedLoadMoreFailed] = useState(false);
  const savedGeneration = useRef(0);

  // ── Fetch user ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const token = getAuthToken();
      if (!token) { router.push('/login'); return; }
      try {
        const u = await api.users.getMyProfile();
        setUserId(u.id);
        setMe(u);
      } catch {
        router.push('/login');
      }
    })();
  }, [router]);

  // ── Fetch posts ──────────────────────────────────────────
  const loadPosts = useCallback(async () => {
    if (!userId) return;
    const generation = ++loadGeneration.current;
    setLoading(true);
    setLoadError(false);
    setLoadingMore(false);
    setLoadMoreFailed(false);
    try {
      const result = await api.posts.getUserPosts(userId, { limit: PAGE_SIZE });
      if (generation !== loadGeneration.current) return;
      setPosts(result?.posts || []);
      setNextCursor(result?.pagination?.hasMore ? result.pagination.nextCursor : null);
    } catch (err) {
      if (generation !== loadGeneration.current) return;
      console.error('Failed to load my posts:', err);
      // A failed load is not an empty history: say so and offer a retry.
      setPosts([]);
      setNextCursor(null);
      setLoadError(true);
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const loadMore = useCallback(async () => {
    if (!userId || !nextCursor || loadingMore) return;
    const generation = loadGeneration.current;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const result = await api.posts.getUserPosts(userId, {
        limit: PAGE_SIZE,
        cursorCreatedAt: nextCursor.createdAt,
        cursorId: nextCursor.id,
      });
      if (generation !== loadGeneration.current) return;
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...(result?.posts || []).filter((p) => !seen.has(p.id))];
      });
      setNextCursor(result?.pagination?.hasMore ? result.pagination.nextCursor : null);
    } catch (err) {
      if (generation !== loadGeneration.current) return;
      console.error('Failed to load more of my posts:', err);
      setLoadMoreFailed(true);
    } finally {
      if (generation === loadGeneration.current) setLoadingMore(false);
    }
  }, [userId, nextCursor, loadingMore]);

  // ── Fetch saved posts (the Saved tab) ───────────────────
  const loadSaved = useCallback(async () => {
    const generation = ++savedGeneration.current;
    setSavedLoading(true);
    setSavedLoadError(false);
    setSavedLoadingMore(false);
    setSavedLoadMoreFailed(false);
    try {
      const result = await api.posts.getSavedPosts({ limit: PAGE_SIZE, offset: 0 });
      if (generation !== savedGeneration.current) return;
      setSaved(result?.posts || []);
      setSavedNextOffset(result?.pagination?.hasMore ? result.pagination.nextOffset : null);
    } catch (err) {
      if (generation !== savedGeneration.current) return;
      console.error('Failed to load saved posts:', err);
      setSaved([]);
      setSavedNextOffset(null);
      setSavedLoadError(true);
    } finally {
      if (generation === savedGeneration.current) setSavedLoading(false);
    }
  }, []);

  // Every visit to the tab re-reads it, so posts saved elsewhere since show up.
  useEffect(() => { if (tab === 'saved') void loadSaved(); }, [tab, loadSaved]);

  const loadMoreSaved = useCallback(async () => {
    if (savedNextOffset == null || savedLoadingMore) return;
    const generation = savedGeneration.current;
    setSavedLoadingMore(true);
    setSavedLoadMoreFailed(false);
    try {
      const result = await api.posts.getSavedPosts({ limit: PAGE_SIZE, offset: savedNextOffset });
      if (generation !== savedGeneration.current) return;
      setSaved((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...(result?.posts || []).filter((p) => !seen.has(p.id))];
      });
      setSavedNextOffset(result?.pagination?.hasMore ? result.pagination.nextOffset : null);
    } catch (err) {
      if (generation !== savedGeneration.current) return;
      console.error('Failed to load more saved posts:', err);
      setSavedLoadMoreFailed(true);
    } finally {
      if (generation === savedGeneration.current) setSavedLoadingMore(false);
    }
  }, [savedNextOffset, savedLoadingMore]);

  // A page the visibility check (or Remove) left empty isn't the end of the list: read on.
  const savedReadingOn = saved.length === 0 && savedNextOffset != null && !savedLoadMoreFailed;
  useEffect(() => {
    if (tab === 'saved' && !savedLoading && savedReadingOn) void loadMoreSaved();
  }, [tab, savedLoading, savedReadingOn, loadMoreSaved]);

  // ── Post actions ─────────────────────────────────────────
  // The state the person chose goes with each request, so a re-send can't flip it back.
  const listedPost = (postId: string) => posts.find((p) => p.id === postId) ?? saved.find((p) => p.id === postId);

  const likeMutation = useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) => api.posts.toggleLike(postId, liked),
    onMutate: ({ postId }) => {
      setLikingIds((prev) => new Set(prev).add(postId));
    },
    onSuccess: (res, { postId }) => {
      // Either tab's card can be liked, so both lists take the result.
      const liked = (p: Post) => (p.id === postId ? { ...p, userHasLiked: res.liked, like_count: res.likeCount } : p);
      setPosts((prev) => prev.map(liked));
      setSaved((prev) => prev.map(liked));
      patchPostInFeedCaches(queryClient, postId, { userHasLiked: res.liked, like_count: res.likeCount });
    },
    onError: () => {
      toast.error('Failed to like post');
    },
    onSettled: (_data, _err, { postId }) => {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    },
  });

  const handleLike = (postId: string) => {
    likeMutation.mutate({ postId, liked: !(listedPost(postId)?.userHasLiked ?? false) });
  };

  // A listed save that goes (unsaved, or its post deleted) moves every later save up one,
  // so the next page starts one earlier or Load more would skip a saved post.
  const dropFromSaved = (postId: string) => {
    if (!saved.some((p) => p.id === postId)) return;
    setSaved((prev) => prev.filter((p) => p.id !== postId));
    setSavedNextOffset((offset) => (offset == null ? offset : Math.max(0, offset - 1)));
  };

  const handleDelete = async (postId: string) => {
    try {
      await api.posts.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      dropFromSaved(postId);
      removePostFromFeedCaches(queryClient, postId);
      toast.success('Post deleted');
    } catch {
      toast.error('Failed to delete post');
    }
  };

  const saveMutation = useMutation({
    mutationFn: ({ postId, wantSaved }: { postId: string; wantSaved: boolean }) => api.posts.toggleSave(postId, wantSaved),
    onSuccess: (res, { postId }) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, userHasSaved: res.saved } : p,
        ),
      );
      // Unsaving from the Saved tab takes the post off that list.
      if (res.saved) setSaved((prev) => prev.map((p) => (p.id === postId ? { ...p, userHasSaved: true } : p)));
      else dropFromSaved(postId);
      patchPostInFeedCaches(queryClient, postId, { userHasSaved: res.saved });
    },
    onError: () => {
      toast.error('Failed to save post');
    },
  });

  // One toggle per post at a time: a second click while the first is in flight would undo it.
  const savingIds = useRef<Set<string>>(new Set());
  const handleSave = (postId: string) => {
    if (savingIds.current.has(postId)) return;
    savingIds.current.add(postId);
    saveMutation.mutate({ postId, wantSaved: !(listedPost(postId)?.userHasSaved ?? false) }, {
      onSettled: () => {
        savingIds.current.delete(postId);
      },
    });
  };

  const onSaved = tab === 'saved';
  const shown = onSaved ? saved : posts;
  // A failed read past an emptied page is a failed load, not "nothing saved".
  const shownError = onSaved ? savedLoadError || (saved.length === 0 && savedLoadMoreFailed) : loadError;
  const shownMore = onSaved ? savedNextOffset != null : nextCursor != null;
  const shownLoadingMore = onSaved ? savedLoadingMore : loadingMore;
  const shownLoadMoreFailed = onSaved ? savedLoadMoreFailed : loadMoreFailed;
  const loadMoreShown = () => { void (onSaved ? loadMoreSaved() : loadMore()); };
  const countLabel = onSaved
    ? `${shown.length}${shownMore ? '+' : ''} saved`
    : shownMore ? `${posts.length}+ posts` : `${posts.length} post${posts.length !== 1 ? 's' : ''}`;

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <ListArchetype<Post>
          title="My pulse"
          // No count when loading failed; while older posts are unloaded the
          // loaded count is a floor, not the total.
          subtitle={shownError ? undefined : countLabel}
          primaryAction={{
            label: 'Go to Pulse',
            onClick: () => router.push('/app/feed'),
          }}
          tabs={[
            { key: 'mine', label: 'My posts' },
            { key: 'saved', label: 'Saved' },
          ]}
          activeTabKey={tab}
          onTabChange={(key) => setTab(key as Tab)}
          loading={onSaved ? savedLoading || savedReadingOn : loading}
          rows={shown}
          rowSpacing={4}
          keyExtractor={(post) => post.id}
          renderRow={(post) => (
            <PostCard
              post={post}
              onLike={handleLike}
              onComment={(id) => setDetailPostId(id)}
              onOpenDetail={(id) => setDetailPostId(id)}
              onSave={handleSave}
              onDelete={handleDelete}
              onEdit={setEditingPost}
              onReport={(id) => setReportPostId(id)}
              currentUserId={userId || undefined}
              isLiking={likingIds.has(post.id)}
              showToast={(message) => toast.info(message)}
            />
          )}
          emptyState={onSaved ? {
            icon: Bookmark,
            headline: 'Nothing saved yet',
            subcopy: 'Tap the bookmark on a post to keep it here.',
            tone: 'personal',
            ctaLabel: 'Go to Pulse',
            onCtaClick: () => router.push('/app/feed'),
          } : {
            icon: Newspaper,
            headline: 'No posts yet',
            subcopy: 'Share updates, questions, or recommendations with your community.',
            tone: 'personal',
            ctaLabel: 'Go to Pulse',
            onCtaClick: () => router.push('/app/feed'),
          }}
          renderEmpty={shownError ? () => (
            <div role="alert">
              <ErrorState
                message={onSaved ? "We couldn't load your saved posts. Please try again." : "We couldn't load your posts. Please try again."}
                onRetry={() => { void (onSaved ? loadSaved() : loadPosts()); }}
              />
            </div>
          ) : undefined}
          renderFooter={(shownMore || shownLoadMoreFailed) && !shownError ? () => (
            <>
              {shownLoadMoreFailed && (
                <div role="alert" className="my-4 flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-strong">
                  <p>Couldn&apos;t load more {onSaved ? 'saved posts' : 'posts'}.</p>
                  <button
                    type="button"
                    disabled={shownLoadingMore}
                    onClick={loadMoreShown}
                    className="font-semibold text-primary-600 hover:underline disabled:opacity-50"
                  >
                    Try again
                  </button>
                </div>
              )}
              {shownMore && !shownLoadMoreFailed && (
                <div className="text-center py-3">
                  <button
                    type="button"
                    onClick={loadMoreShown}
                    disabled={shownLoadingMore}
                    className="px-4 py-2 text-sm font-medium text-app-text-secondary hover:text-app-text hover:bg-app-hover rounded-lg transition disabled:opacity-50"
                  >
                    {shownLoadingMore ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          ) : undefined}
        />
      </main>

      {/* ── Post detail panel ───────────────────────────────── */}
      <PostDetailPanel
        postId={detailPostId}
        open={!!detailPostId}
        onClose={() => {
          // A post unsaved in the panel leaves the Saved list once the panel closes.
          if (detailPostId && saved.some((p) => p.id === detailPostId && !p.userHasSaved)) dropFromSaved(detailPostId);
          setDetailPostId(null);
        }}
        // Likes, saves, comments and shares made in the panel show on the cards too, and in the feed.
        onPostChange={(postId, patch) => {
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
          setSaved((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
          patchPostInFeedCaches(queryClient, postId, patch);
        }}
        currentUserId={userId || undefined}
      />

      {/* ── Edit one of your posts ──────────────────────────── */}
      {editingPost && (
        <EditPostDialog
          post={editingPost}
          user={me}
          onClose={() => setEditingPost(null)}
          onSaved={(postId, changes) => {
            setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...changes } : p)));
            setSaved((prev) => prev.map((p) => (p.id === postId ? { ...p, ...changes } : p)));
            patchPostInFeedCaches(queryClient, postId, changes);
            setEditingPost(null);
            toast.success('Post updated');
          }}
          onGone={(postId) => {
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            dropFromSaved(postId);
            removePostFromFeedCaches(queryClient, postId);
            setEditingPost(null);
            toast.info('This post was deleted, so it can’t be edited.');
          }}
        />
      )}

      {/* ── Report modal ────────────────────────────────────── */}
      <ReportModal
        open={!!reportPostId}
        onClose={() => setReportPostId(null)}
        onSubmit={async (reason, details) => {
          if (!reportPostId) return;
          await api.posts.reportPost(reportPostId, {
            reason: reason as 'spam' | 'harassment' | 'inappropriate' | 'misinformation' | 'other',
            details,
          });
          toast.success('Report submitted');
          setReportPostId(null);
        }}
        entityType="post"
      />
    </div>
  );
}
