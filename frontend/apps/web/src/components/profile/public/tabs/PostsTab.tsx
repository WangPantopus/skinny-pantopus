'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { Post } from '@pantopus/types';
import { PostCard, PostDetailPanel } from '@/components/feed';
import { patchPostInFeedCaches } from '@/hooks/useFeedData';
import ReportModal from '@/components/ui/ReportModal';
import { toast } from '@/components/ui/toast-store';

interface PostsTabProps {
  posts: Post[];
  /** Applies a change made here (a like, a save, a reply in the post panel) to the profile's list. */
  onPostsChange: (update: (posts: Post[]) => Post[]) => void;
  loading: boolean;
  failed?: boolean;
  onRetry?: () => void;
  /** The viewer blocked this person: a block hides both people's posts from each other. */
  blocked?: boolean;
  firstName?: string | null;
  currentUserId?: string;
}

/**
 * A person's posts on their profile, drawn with the feed's card (photos and video, link previews,
 * Helpful, comments, save, share and report); a click opens the post panel, as in the feed and
 * My Pulse.
 */
export default function PostsTab({ posts, onPostsChange, loading, failed = false, onRetry, blocked = false, firstName = null, currentUserId }: PostsTabProps) {
  const queryClient = useQueryClient();
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  // One toggle per post at a time: a second click while the first is in flight would undo it.
  const savingIds = useRef<Set<string>>(new Set());

  const patch = (postId: string, changes: Partial<Post>) => {
    onPostsChange((prev) => prev.map((p) => (p.id === postId ? { ...p, ...changes } : p)));
    patchPostInFeedCaches(queryClient, postId, changes);
  };

  // The state the person chose goes with each request, so a re-send can't flip it back.
  const likeMutation = useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) => api.posts.toggleLike(postId, liked),
    onMutate: ({ postId }) => setLikingIds((prev) => new Set(prev).add(postId)),
    onSuccess: (res, { postId }) => patch(postId, { userHasLiked: res.liked, like_count: res.likeCount }),
    onError: () => toast.error('Failed to like post'),
    onSettled: (_data, _err, { postId }) => {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ postId, wantSaved }: { postId: string; wantSaved: boolean }) => api.posts.toggleSave(postId, wantSaved),
    onSuccess: (res, { postId }) => patch(postId, { userHasSaved: res.saved }),
    onError: () => toast.error('Failed to save post'),
  });

  const handleLike = (postId: string) => {
    likeMutation.mutate({ postId, liked: !(posts.find((p) => p.id === postId)?.userHasLiked ?? false) });
  };

  const handleSave = (postId: string) => {
    if (savingIds.current.has(postId)) return;
    savingIds.current.add(postId);
    saveMutation.mutate({ postId, wantSaved: !(posts.find((p) => p.id === postId)?.userHasSaved ?? false) }, {
      onSettled: () => {
        savingIds.current.delete(postId);
      },
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        <p className="mt-4 text-app-secondary">Loading posts...</p>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="text-center py-12 bg-surface rounded-xl border border-app">
        <div className="text-6xl mb-4" aria-hidden="true">🔒</div>
        <h3 className="text-lg font-semibold text-app mb-2">Posts hidden</h3>
        <p className="text-app-secondary">
          You blocked {firstName || 'this person'}. Neither of you sees the other&apos;s posts while the block is on.
        </p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 bg-surface rounded-xl border border-app">
        <div className="text-6xl mb-4" aria-hidden="true">🏡</div>
        <h3 className="text-lg font-semibold text-app mb-2">{failed ? "Couldn't load posts" : 'No posts yet'}</h3>
        <p className="text-app-secondary">{failed ? 'Check your connection and try again.' : firstName ? `${firstName}'s posts will appear here.` : 'Their posts will appear here.'}</p>
        {failed && onRetry && <button onClick={onRetry} className="mt-4 text-primary-600">Try again</button>}
      </div>
    );
  }

  return (
    <>
      <div className="max-w-2xl space-y-4" data-testid="profile-posts">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={handleLike}
            onComment={(id) => setDetailPostId(id)}
            onOpenDetail={(id) => setDetailPostId(id)}
            onSave={handleSave}
            onReport={(id) => setReportPostId(id)}
            currentUserId={currentUserId}
            isLiking={likingIds.has(post.id)}
            showToast={(message) => toast.info(message)}
          />
        ))}
      </div>

      {/* Likes, saves, comments and shares made in the panel show on the cards too, and in the feed. */}
      <PostDetailPanel
        postId={detailPostId}
        open={!!detailPostId}
        onClose={() => setDetailPostId(null)}
        onPostChange={(postId, changes) => patch(postId, changes)}
        currentUserId={currentUserId}
      />

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
    </>
  );
}
