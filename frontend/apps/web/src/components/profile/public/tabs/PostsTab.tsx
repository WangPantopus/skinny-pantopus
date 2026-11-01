'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Hand, Lock, MessageSquare } from 'lucide-react';
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
  /**
   * Signed out (or your profile previewed as anyone with the link): posts are for signed-in neighbors
   * (GET /api/posts/user/:userId needs a session), so the tab says so instead of showing an empty list.
   */
  signedOut?: boolean;
  onSignIn?: () => void;
  /** Joined in the last 14 days: an empty list reads "<name> just joined". */
  justJoined?: boolean;
  /** Message the person from an empty list; left out where messaging isn't open. */
  onSayHi?: () => void;
  /** Your own profile: an empty list speaks to you. */
  isOwner?: boolean;
  /** The person's account id: their initials on the cards use their own color, as in the header. */
  authorColorSeed?: string;
}

const emptyCard = 'rounded-2xl border border-app bg-surface px-5 py-6 flex flex-col items-center text-center';
const emptyIcon = 'w-12 h-12 rounded-full bg-app-surface-sunken text-app-secondary flex items-center justify-center';
const pillButton = 'mt-4 min-h-[2.75rem] px-5 rounded-full border border-app-strong bg-surface text-base font-semibold text-app inline-flex items-center gap-2 hover-bg-app';

/**
 * A person's posts on their profile, drawn with the feed's card (photos and video, link previews,
 * Helpful, comments, save, share and report); a click opens the post panel, as in the feed and
 * My Pulse.
 */
export default function PostsTab({
  posts,
  onPostsChange,
  loading,
  failed = false,
  onRetry,
  blocked = false,
  firstName = null,
  currentUserId,
  signedOut = false,
  onSignIn,
  justJoined = false,
  onSayHi,
  isOwner = false,
  authorColorSeed,
}: PostsTabProps) {
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

  if (signedOut) {
    return (
      <div className={emptyCard}>
        <span aria-hidden="true" className={emptyIcon}><Lock className="w-[1.375rem] h-[1.375rem]" /></span>
        <h3 className="mt-3 text-[1.0625rem] leading-[1.375rem] font-semibold text-app">Posts are for neighbors</h3>
        <p className="mt-1.5 max-w-[18rem] text-[0.9375rem] leading-5 text-app-muted">
          Sign in or join Pantopus to see {firstName ? `${firstName}'s` : 'their'} posts and pinned posts.
        </p>
        {onSignIn && <button type="button" onClick={onSignIn} className={pillButton}>Sign in</button>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" aria-hidden="true" />
        <p className="mt-4 text-app-secondary">Loading posts…</p>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className={emptyCard}>
        <span aria-hidden="true" className={emptyIcon}><Lock className="w-[1.375rem] h-[1.375rem]" /></span>
        <h3 className="mt-3 text-[1.0625rem] leading-[1.375rem] font-semibold text-app">Posts hidden</h3>
        <p className="mt-1.5 max-w-[20rem] text-[0.9375rem] leading-5 text-app-muted">
          You blocked {firstName || 'this person'}. Neither of you sees the other&apos;s posts while the block is on.
        </p>
      </div>
    );
  }

  if (posts.length === 0 && failed) {
    return (
      <div className={emptyCard} role="alert">
        <h3 className="text-[1.0625rem] leading-[1.375rem] font-semibold text-app">Couldn&apos;t load posts</h3>
        <p className="mt-1.5 text-[0.9375rem] leading-5 text-app-muted">Check your connection and try again.</p>
        {onRetry && <button type="button" onClick={onRetry} className={pillButton}>Try again</button>}
      </div>
    );
  }

  if (posts.length === 0 && isOwner) {
    return (
      <div className={emptyCard}>
        <span aria-hidden="true" className={emptyIcon}><Hand className="w-[1.375rem] h-[1.375rem]" /></span>
        <h3 className="mt-3 text-[1.0625rem] leading-[1.375rem] font-semibold text-app">No posts yet</h3>
        <p className="mt-1.5 max-w-[17rem] text-[0.9375rem] leading-5 text-app-muted">
          When you post, neighbors see it here too.
        </p>
      </div>
    );
  }

  if (posts.length === 0) {
    // A quiet profile still reads as intentional, with a way to say hi.
    return (
      <div className={emptyCard}>
        <span aria-hidden="true" className={emptyIcon}><Hand className="w-[1.375rem] h-[1.375rem]" /></span>
        <h3 className="mt-3 text-[1.0625rem] leading-[1.375rem] font-semibold text-app">
          {justJoined ? `${firstName || 'This neighbor'} just joined` : 'No posts yet'}
        </h3>
        <p className="mt-1.5 max-w-[17rem] text-[0.9375rem] leading-5 text-app-muted">
          {justJoined ? 'No posts yet. A quick hello goes a long way.' : `When ${firstName || 'they'} post${firstName ? 's' : ''}, it shows up here.`}
        </p>
        {onSayHi && (
          <button type="button" onClick={onSayHi} className={pillButton}>
            <MessageSquare aria-hidden="true" className="w-4 h-4" strokeWidth={2.25} />
            Say hi
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3" data-testid="profile-posts">
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
            authorColorSeed={authorColorSeed}
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
