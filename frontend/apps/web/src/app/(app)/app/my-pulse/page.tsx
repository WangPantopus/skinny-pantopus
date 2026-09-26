'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { Post } from '@pantopus/types';
import { PostCard, PostDetailPanel } from '@/components/feed';
import ReportModal from '@/components/ui/ReportModal';
import { toast } from '@/components/ui/toast-store';
import ErrorState from '@/components/ui/ErrorState';
import { Newspaper } from 'lucide-react';
import { ListArchetype } from '@/components/archetypes';

const PAGE_SIZE = 50;

type PageCursor = { createdAt: string; id: string };

export default function MyPulsePage() {
  const router = useRouter();
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
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());

  // ── Fetch user ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const token = getAuthToken();
      if (!token) { router.push('/login'); return; }
      try {
        const u = await api.users.getMyProfile();
        setUserId(u.id);
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

  // ── Post actions ─────────────────────────────────────────
  const likeMutation = useMutation({
    mutationFn: (postId: string) => api.posts.toggleLike(postId),
    onMutate: (postId) => {
      setLikingIds((prev) => new Set(prev).add(postId));
    },
    onSuccess: (res, postId) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked_by_user: res.liked, like_count: res.likeCount }
            : p,
        ),
      );
    },
    onError: () => {
      toast.error('Failed to like post');
    },
    onSettled: (_data, _err, postId) => {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    },
  });

  const handleLike = (postId: string) => {
    likeMutation.mutate(postId);
  };

  const handleDelete = async (postId: string) => {
    try {
      await api.posts.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success('Post deleted');
    } catch {
      toast.error('Failed to delete post');
    }
  };

  const saveMutation = useMutation({
    mutationFn: (postId: string) => api.posts.toggleSave(postId),
    onSuccess: (res, postId) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, userHasSaved: res.saved } : p,
        ),
      );
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
    saveMutation.mutate(postId, {
      onSettled: () => {
        savingIds.current.delete(postId);
      },
    });
  };

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <ListArchetype<Post>
          title="My pulse"
          // No count when loading failed; while older posts are unloaded the
          // loaded count is a floor, not the total.
          subtitle={loadError
            ? undefined
            : nextCursor ? `${posts.length}+ posts` : `${posts.length} post${posts.length !== 1 ? 's' : ''}`}
          primaryAction={{
            label: 'Go to Pulse',
            onClick: () => router.push('/app/feed'),
          }}
          loading={loading}
          rows={posts}
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
              onReport={(id) => setReportPostId(id)}
              currentUserId={userId || undefined}
              isLiking={likingIds.has(post.id)}
            />
          )}
          emptyState={{
            icon: Newspaper,
            headline: 'No posts yet',
            subcopy: 'Share updates, questions, or recommendations with your community.',
            tone: 'personal',
            ctaLabel: 'Go to Pulse',
            onCtaClick: () => router.push('/app/feed'),
          }}
          renderEmpty={loadError ? () => (
            <div role="alert">
              <ErrorState
                message="We couldn't load your posts. Please try again."
                onRetry={() => { void loadPosts(); }}
              />
            </div>
          ) : undefined}
          renderFooter={nextCursor || loadMoreFailed ? () => (
            <>
              {loadMoreFailed && (
                <div role="alert" className="my-4 flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-strong">
                  <p>Couldn&apos;t load more posts.</p>
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => { void loadMore(); }}
                    className="font-semibold text-primary-600 hover:underline disabled:opacity-50"
                  >
                    Try again
                  </button>
                </div>
              )}
              {nextCursor && !loadMoreFailed && (
                <div className="text-center py-3">
                  <button
                    type="button"
                    onClick={() => { void loadMore(); }}
                    disabled={loadingMore}
                    className="px-4 py-2 text-sm font-medium text-app-text-secondary hover:text-app-text hover:bg-app-hover rounded-lg transition disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'Load more'}
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
        onClose={() => setDetailPostId(null)}
        currentUserId={userId || undefined}
      />

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
