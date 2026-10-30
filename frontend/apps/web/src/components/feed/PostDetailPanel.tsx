'use client';

import Image from 'next/image';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageCircle, Star, CalendarDays, Search, Megaphone,
  AlertTriangle, PenLine, Pencil, Heart, Siren, Tag, Wrench, Newspaper,
  Trophy, Compass, User as UserIcon,   Bookmark, Repeat2, Share2, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as api from '@pantopus/api';
import CommentThread from './CommentThread';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import { PostMediaPreview, resolvePostMediaSlots } from './PostMediaGrid';
import PostMediaLightbox from './PostMediaLightbox';
import { PostLinkContent } from './LinkPreviewCard';
import LinkPreviewCard from './LinkPreviewCard';
import PostMetadata from './PostMetadata';
import { canSharePost, sharePostLink } from './sharePostLink';
import { formatTimeAgo as timeAgo, getPostTypeConfig, POST_TYPE_ICONS_LUCIDE } from '@pantopus/ui-utils';
import { chosenUsername } from '@pantopus/utils';
import { patchPostInFeedCaches, removePostFromFeedCaches } from '@/hooks/useFeedData';
import { usePostDetail } from '@/hooks/usePostDetail';
import type { Post, PostComment as PostCommentType } from '@pantopus/types';
import { launchFeatures } from '@/lib/featureFlags';

const LUCIDE_MAP: Record<string, LucideIcon> = {
  MessageCircle, Star, CalendarDays, Search, Megaphone, AlertTriangle,
  Pencil, Siren, Tag, Wrench, Newspaper, Trophy, Compass, User: UserIcon,
};

function typeIcon(type: string): ReactNode {
  const name = POST_TYPE_ICONS_LUCIDE[type] || 'Pencil';
  const Icon = LUCIDE_MAP[name] || PenLine;
  return <Icon className="w-4 h-4" />;
}

interface PostDetailPanelProps {
  postId: string | null;
  open: boolean;
  onClose: () => void;
  currentUserId?: string;
  initialPost?: Post | null;
  onPostChange?: (postId: string, patch: Partial<Post>) => void;
  canComment?: boolean;
  commentDisabledMessage?: string | null;
}

export default function PostDetailPanel({
  postId,
  open,
  onClose,
  currentUserId,
  initialPost = null,
  onPostChange,
  canComment = true,
  commentDisabledMessage = null,
}: PostDetailPanelProps) {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // The post and its comments come from the shared cache (hooks/usePostDetail):
  // the card's copy shows at once, a post opened before shows with its comments.
  const detail = usePostDetail(postId, { enabled: open, seed: initialPost });
  const post: Post | null = open ? detail.post : null;
  const comments: PostCommentType[] = open ? detail.comments : [];
  const { setPost, setComments, postQuery, commentsQuery, unavailable } = detail;
  const loading = open && postQuery.isFetching;
  const [commentPosting, setCommentPosting] = useState(false);
  const [toast, setToast] = useState('');
  /** Index into `post.media_urls` when viewing full-screen image; `null` = closed */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const targetVersion = useRef(0);

  useEffect(() => {
    targetVersion.current += 1;
    setCommentPosting(false);
    setToast('');
    return () => { targetVersion.current += 1; };
  }, [postId, currentUserId, open]);

  const showToast = (message: string) => {
    const target = targetVersion.current;
    setToast(message);
    window.setTimeout(() => {
      if (target === targetVersion.current) setToast('');
    }, 2500);
  };

  const refreshCommentState = async () => {
    const [updated] = await Promise.all([postQuery.refetch(), commentsQuery.refetch()]);
    const count = updated.data?.post?.comment_count;
    if (postId && typeof count === 'number' && !updated.isError) {
      patchPostInFeedCaches(queryClient, postId, { comment_count: count });
      onPostChange?.(postId, { comment_count: count });
    }
  };

  // Deleted, or no longer visible to you: say so rather than showing the card's
  // copy as a live post, and stop the feed listing it.
  useEffect(() => {
    if (open && postId && unavailable) removePostFromFeedCaches(queryClient, postId);
  }, [open, postId, unavailable, queryClient]);

  // A refresh of the comments that failed keeps the ones shown and says so.
  const commentsRefreshFailed = open && !unavailable && commentsQuery.isError && commentsQuery.data !== undefined;
  useEffect(() => {
    if (commentsRefreshFailed) showToast('Could not refresh comments. Close and reopen this post to retry.');
  }, [commentsRefreshFailed, commentsQuery.errorUpdatedAt]);

  useEffect(() => {
    if (!open) {
      setLightboxIndex(null);
      return;
    }
    if (lightboxIndex !== null) return; // The media viewer owns its keyboard controls.
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, lightboxIndex, post?.media_urls]);

  useEffect(() => {
    if (lightboxIndex === null || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxIndex]);

  const handleAddComment = async ({ text, parentId, files = [], clientRequestId }: { text: string; parentId?: string; files?: File[]; clientRequestId: string }) => {
    if (!postId) return false;
    const target = targetVersion.current;
    setCommentPosting(true);
    try {
      const res = await api.posts.addComment(postId, {
        comment: text,
        parentCommentId: parentId,
        clientRequestId,
      });

      let nextComment = res.comment;
      let uploadFailed = false;
      if (files.length > 0) {
        try {
          const uploadRes = await api.upload.uploadCommentMedia(nextComment.id, files);
          nextComment = { ...nextComment, attachments: uploadRes.attachments || [] };
        } catch (err) {
          uploadFailed = true;
          console.warn('Failed to upload comment media', err);
        }
      }

      if (target !== targetVersion.current) return false;
      const alreadyAdded = comments.some((comment) => comment.id === nextComment.id);
      const nextCommentCount = (post?.comment_count ?? comments.length) + (alreadyAdded ? 0 : 1);
      setComments((prev) => prev.some((comment) => comment.id === nextComment.id)
        ? prev.map((comment) => comment.id === nextComment.id ? nextComment : comment)
        : [...prev, nextComment]);
      setPost((prev) => prev ? { ...prev, comment_count: nextCommentCount } : prev);
      onPostChange?.(postId, { comment_count: nextCommentCount });
      void refreshCommentState();
      showToast(uploadFailed ? 'Comment posted; images not confirmed. Send to retry or Clear to discard draft.' : 'Comment posted');
      return !uploadFailed;
    } catch (err) {
      if (target !== targetVersion.current) return false;
      console.warn('Failed to add comment', err);
      showToast(err instanceof Error ? err.message : 'Failed to add comment');
      return false;
    } finally {
      if (target === targetVersion.current) setCommentPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string, deletedIds: ReadonlySet<string>) => {
    if (!postId) return;
    const target = targetVersion.current;
    try {
      await api.posts.deleteComment(postId, commentId);
      if (target !== targetVersion.current) return;
      const nextCommentCount = Math.max(0, (post?.comment_count ?? comments.length) - deletedIds.size);
      setComments((prev) => prev.filter((comment) => !deletedIds.has(comment.id)));
      setPost((prev) => prev ? { ...prev, comment_count: nextCommentCount } : prev);
      onPostChange?.(postId, { comment_count: nextCommentCount });
      // A cascade can also remove replies hidden from this viewer.
      void refreshCommentState();
      showToast('Comment deleted');
    } catch (err) {
      if (target !== targetVersion.current) return;
      console.warn('Failed to delete comment', err);
      showToast('Failed to delete comment');
    }
  };

  // Each request carries the state the person chose, so a re-send can't flip it back.
  const likeMutation = useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) => api.posts.toggleLike(postId, liked),
    onMutate: () => ({ target: targetVersion.current }),
    onSuccess: (res, { postId }) => {
      patchPostInFeedCaches(queryClient, postId, { userHasLiked: res.liked, like_count: res.likeCount });
      onPostChange?.(postId, { userHasLiked: res.liked, like_count: res.likeCount });
    },
    onError: (err, _vars, context) => {
      console.warn('Failed to toggle like', err);
      if (context?.target === targetVersion.current) showToast('Failed to update like');
    },
  });

  const handleLike = () => {
    if (!post) return;
    likeMutation.mutate({ postId: post.id, liked: !post.userHasLiked });
  };

  const handleCommentLike = async (commentId: string) => {
    if (!postId) return;
    const target = targetVersion.current;
    try {
      const comment = comments.find((c) => c.id === commentId);
      const res = await api.posts.toggleCommentLike(postId, commentId, !(comment?.userHasLiked ?? false));
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, userHasLiked: res.liked, like_count: res.likeCount } : c
        )
      );
    } catch (err) {
      console.warn('Failed to toggle comment like', err);
      if (target === targetVersion.current) showToast('Failed to update comment like. Please try again.');
    }
  };

  const saveMutation = useMutation({
    mutationFn: ({ postId, saved }: { postId: string; saved: boolean }) => api.posts.toggleSave(postId, saved),
    onMutate: ({ postId, saved }) => {
      const prevSaved = post?.userHasSaved ?? false;
      patchPostInFeedCaches(queryClient, postId, { userHasSaved: saved });
      return { prevSaved, target: targetVersion.current };
    },
    onSuccess: (res, { postId }, context) => {
      patchPostInFeedCaches(queryClient, postId, { userHasSaved: res.saved });
      onPostChange?.(postId, { userHasSaved: res.saved });
      if (context?.target === targetVersion.current) showToast(res.saved ? 'Post saved' : 'Removed from saved');
    },
    onError: (err, { postId }, context) => {
      if (context) patchPostInFeedCaches(queryClient, postId, { userHasSaved: context.prevSaved });
      console.warn('Failed to toggle save', err);
      if (context?.target === targetVersion.current) showToast('Failed to update save');
    },
  });

  // One toggle at a time: a second click while the first is in flight would undo it.
  const saveInFlight = useRef(false);
  const handleSave = () => {
    if (!post || saveInFlight.current) return;
    saveInFlight.current = true;
    saveMutation.mutate({ postId: post.id, saved: !post.userHasSaved }, {
      onSettled: () => {
        saveInFlight.current = false;
      },
    });
  };

  const handleRepost = async () => {
    if (!post) return;
    const target = targetVersion.current;
    try {
      const res = await api.posts.repostPost(post.id, !post.userHasReposted);
      const patch = {
        userHasReposted: res.reposted,
        share_count: res.shareCount,
      };
      patchPostInFeedCaches(queryClient, post.id, patch);
      onPostChange?.(post.id, patch);
      if (target === targetVersion.current) showToast(res.reposted ? 'Post reposted' : 'Repost removed');
    } catch (err) {
      console.warn('Failed to repost post', err);
      if (target === targetVersion.current) showToast('Failed to update repost');
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const target = targetVersion.current;
    try {
      if (!await sharePostLink(post)) return;

      const res = await api.posts.sharePost(post.id);
      patchPostInFeedCaches(queryClient, post.id, { share_count: res.shareCount });
      onPostChange?.(post.id, { share_count: res.shareCount });
      if (target === targetVersion.current) showToast('Post link shared');
    } catch (err) {
      if (target !== targetVersion.current) return;
      // A post that isn't public is never counted as shared, but the link is already copied and opens for people who can see the post.
      if ((err as { code?: string } | null)?.code === 'SHARE_NOT_ALLOWED') {
        showToast('Post link shared. Only people who can see this post in Pantopus can open it.');
        return;
      }
      console.warn('Failed to share post', err);
      showToast('Failed to share post');
    }
  };

  const config = getPostTypeConfig(post?.post_type || 'general');
  // P0.4 audit follow-up: prefer post.author (typed identity) over the
  // legacy post.creator slot. Both are populated today; new code reads
  // the new shape so the legacy slot can retire.
  const publicAuthor = post?.author || null;
  const creatorAvatarUrl =
    publicAuthor?.avatarUrl ||
    post?.creator?.profile_picture_url ||
    null;
  const creatorHandle =
    publicAuthor?.handle ||
    post?.creator?.username ||
    null;
  const creatorName =
    publicAuthor?.displayName ||
    chosenUsername(publicAuthor?.handle) ||
    post?.creator?.name ||
    chosenUsername(post?.creator?.username) ||
    'Neighbor';
  // The hover card follows and connects by account id: a person's creator.id is their Local Profile id. A business
  // keeps its own id, which its writer's copy of the post doesn't carry in user_id.
  const creatorUserId = publicAuthor?.type === 'local'
    ? post?.author_user_id || post?.user_id
    : post?.creator?.id || post?.user_id;

  if (!mounted) return null;
  // Match SlidePanel: keep the existing overlay above the app shell's stacking context.
  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside
        ref={panelRef}
        // Closed, the panel only slides off-screen; inert keeps its controls out of the tab order and screen readers.
        inert={!open}
        className={`fixed top-0 right-0 bottom-0 z-[61] w-full max-w-xl bg-surface border-l border-app shadow-2xl transform transition-transform duration-250 ease-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div
          className="sticky top-0 z-10 border-b px-5 py-3"
          style={{ background: config.bgLight, borderColor: `${config.color}20` }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span>{typeIcon(post?.post_type || 'general')}</span>
                <span className="text-sm font-semibold" style={{ color: config.textColor }}>
                  {config.label}
                </span>
                {post?.state === 'solved' && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                    Solved
                  </span>
                )}
              </div>
              {post?.title && (
                <div className="mt-1 truncate text-sm font-semibold text-app">{post.title}</div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onClose}
                aria-label="Close post"
                className="rounded-lg p-2 text-app-muted transition hover-bg-app hover:text-app"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && !post ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 rounded-full border-2 border-app border-t-primary-500 animate-spin" />
            </div>
          ) : !post && postQuery.isError && !detail.unavailable ? (
            <div role="alert" className="flex h-40 flex-col items-center justify-center gap-3 px-5 text-sm text-app-muted">
              <span>Couldn&apos;t load this post. Please try again.</span>
              <button onClick={() => void postQuery.refetch()} className="font-medium text-primary-600 hover:text-primary-700">
                Try again
              </button>
            </div>
          ) : post ? (
            <div>
              <div className="flex items-center gap-3 px-5 py-4">
                {creatorAvatarUrl ? (
                  <Image
                    src={creatorAvatarUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-100"
                    width={40}
                    height={40}
                    sizes="40px"
                    quality={75}
                  />
                ) : (
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ background: config.color }}
                  >
                    {creatorName[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {publicAuthor?.type === 'persona' ? (
                  // Launch cuts #1 + #2: no link to the hidden persona page.
                  publicAuthor.href && launchFeatures.beacon && launchFeatures.personas ? (
                    <a href={publicAuthor.href} className="text-sm font-semibold text-app hover:underline">
                      {creatorName}
                    </a>
                  ) : <span className="text-sm font-semibold text-app">{creatorName}</span>
                ) : creatorHandle ? (
                    <UserIdentityLink
                      userId={creatorUserId}
                      username={creatorHandle}
                      displayName={creatorName}
                      avatarUrl={creatorAvatarUrl}
                      city={null}
                      state={null}
                      textClassName="text-sm font-semibold text-app hover:underline"
                    />
                  ) : (
                    <div className="text-sm font-semibold text-app">{creatorName}</div>
                  )}
                  <div className="text-[11px] text-app-muted">
                    {timeAgo(post.created_at)}
                    {post.is_edited && ' · edited'}
                  </div>
                </div>
              </div>

              {(post.location_name || post.latitude) && (
                <div className="px-5 pb-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-app bg-surface-muted px-3 py-1 text-xs text-app-muted">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {post.location_name || post.location_address || 'Pinned location'}
                  </span>
                </div>
              )}

              <div className="px-5 pb-4">
                {post.title && <h3 className="mb-2 text-base font-semibold text-app break-words">{post.title}</h3>}
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-app">
                  <PostLinkContent content={post.content} />
                </p>
              </div>

              <PostMetadata post={post} spacing="mx-5 mb-3" />

              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-5 pb-3">
                  {[...new Set(post.tags)].map((tag) => (
                    <span key={tag} className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {post.content && <LinkPreviewCard content={post.content} />}

              {post.media_urls && post.media_urls.length > 0 && (
                <div className="space-y-2 px-5 pb-4">
                  {post.media_urls.map((url, idx) => (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          setLightboxIndex(idx);
                        }
                      }}
                      onClick={() => setLightboxIndex(idx)}
                      className={`relative ${(post.media_types?.[idx] ?? "image") !== "image" ? "h-80" : ""} block w-full cursor-zoom-in overflow-hidden rounded-xl border-0 bg-transparent p-0 text-left transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
                      aria-label={`View attachment ${idx + 1} full size`}
                    >
                      <PostMediaPreview url={url} thumbnailUrl={post.media_thumbnails?.[idx]}
                        slot={resolvePostMediaSlots(post.media_urls!, post.media_types, post.media_live_urls)[idx]}
                        imageClassName="max-h-80 w-full rounded-xl object-cover" onPress={() => setLightboxIndex(idx)} />

                    </div>

                  ))}
                </div>
              )}

              <div className={`grid grid-cols-2 gap-2 border-y border-app px-5 py-3 ${canSharePost(post) ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
                <button
                  type="button"
                  aria-label={post.userHasLiked ? 'Unlike post' : 'Like post'}
                  aria-pressed={!!post.userHasLiked}
                  onClick={handleLike}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                    post.userHasLiked ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'text-app-muted hover-bg-app'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${post.userHasLiked ? 'fill-current' : ''}`} />
                  <span>{post.like_count || 0}</span>
                </button>
                <div className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-app-muted">
                  <MessageCircle className="h-4 w-4" />
                  <span>{post.comment_count ?? comments.length}</span>
                </div>
                <button
                  onClick={handleSave}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                    post.userHasSaved ? 'bg-sky-50 text-sky-700 hover:bg-sky-100' : 'text-app-muted hover-bg-app'
                  }`}
                >
                  <Bookmark className={`h-4 w-4 ${post.userHasSaved ? 'fill-current' : ''}`} />
                  <span>{post.userHasSaved ? 'Saved' : 'Save'}</span>
                </button>
                <button
                  onClick={handleRepost}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                    post.userHasReposted ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'text-app-muted hover-bg-app'
                  }`}
                >
                  <Repeat2 className="h-4 w-4" />
                  <span>{post.userHasReposted ? 'Reposted' : 'Repost'}</span>
                </button>
                {canSharePost(post) && (
                  <button
                    type="button"
                    aria-label="Share post"
                    onClick={handleShare}
                    className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-app-muted transition hover-bg-app"
                  >
                    <Share2 className="h-4 w-4" />
                    <span>{post.share_count || 0}</span>
                  </button>
                )}
              </div>

              <div className="px-2">
                {detail.commentsFailed && (
                  <div role="alert" className="flex items-center justify-between gap-3 px-3 py-3 text-sm text-app-muted">
                    <span>Couldn&apos;t load comments.</span>
                    <button onClick={() => void commentsQuery.refetch()} className="font-medium text-primary-600 hover:text-primary-700">
                      Try again
                    </button>
                  </div>
                )}
                <CommentThread
                  key={`${postId}:${currentUserId}`}
                  comments={comments}
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                  onLikeComment={handleCommentLike}
                  currentUserId={currentUserId}
                  isPosting={commentPosting}
                  canCompose={canComment}
                  composeDisabledMessage={commentDisabledMessage}
                  emptyText={detail.commentsFailed || commentsQuery.isPending ? null : undefined}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-app-muted">
              Post not found
            </div>
          )}
        </div>

        {/* The live region stays mounted so screen readers announce each message. */}
        <div role="status" aria-live="polite">
          {toast && (
            <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-xl">
              {toast}
            </div>
          )}
        </div>
      </aside>

      {post?.media_urls && <PostMediaLightbox urls={post.media_urls} mediaTypes={post.media_types}
        liveUrls={post.media_live_urls} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} />}

    </>,
    document.body
  );
}
