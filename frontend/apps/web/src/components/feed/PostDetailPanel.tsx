'use client';

import Image from 'next/image';
import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  MessageCircle, Star, CalendarDays, Search, Megaphone,
  AlertTriangle, PenLine, Pencil, Heart, Siren, Tag, Wrench, Newspaper,
  Trophy, Compass, User as UserIcon,   Bookmark, Repeat2, Share2, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as api from '@pantopus/api';
import CommentThread from './CommentThread';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import FeedMediaImage from './FeedMediaImage';
import LinkPreviewCard from './LinkPreviewCard';
import { formatTimeAgo as timeAgo, getPostTypeConfig, POST_TYPE_ICONS_LUCIDE } from '@pantopus/ui-utils';
import { buildCanonicalShareUrlForPost } from '@pantopus/utils';
import type { Post, PostComment as PostCommentType } from '@pantopus/types';

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
  const [post, setPost] = useState<Post | null>(initialPost);
  const [comments, setComments] = useState<PostCommentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentPosting, setCommentPosting] = useState(false);
  const [toast, setToast] = useState('');
  /** Index into `post.media_urls` when viewing full-screen image; `null` = closed */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  };

  const loadPost = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [postRes, commentsRes] = await Promise.allSettled([
        api.posts.getPost(id),
        api.posts.getComments(id),
      ]);

      if (postRes.status === 'fulfilled') {
        setPost(postRes.value.post);
      }

      if (commentsRes.status === 'fulfilled') {
        setComments(commentsRes.value.comments || []);
      } else if (postRes.status === 'fulfilled') {
        setComments(postRes.value.post.comments || []);
      }

      if (postRes.status === 'rejected' && commentsRes.status === 'rejected') {
        if (!initialPost) {
          setPost(null);
          setComments([]);
        }
        console.warn('Failed to load post detail panel data', {
          postError: postRes.reason,
          commentsError: commentsRes.reason,
        });
      } else {
        if (postRes.status === 'rejected') {
          console.warn('Failed to refresh post details', postRes.reason);
        }
        if (commentsRes.status === 'rejected') {
          console.warn('Failed to refresh post comments', commentsRes.reason);
        }
      }
    } catch (err) {
      console.warn('Unexpected panel load error', err);
    } finally {
      setLoading(false);
    }
  }, [initialPost]);

  useEffect(() => {
    if (open && postId) {
      setPost(initialPost || null);
      setComments(initialPost?.comments || []);
      void loadPost(postId);
    } else {
      setPost(null);
      setComments([]);
    }
  }, [initialPost, loadPost, open, postId]);

  useEffect(() => {
    if (!open) {
      setLightboxIndex(null);
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (lightboxIndex !== null && post?.media_urls && post.media_urls.length > 0) {
        const n = post.media_urls.length;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setLightboxIndex((i) => (i === null ? 0 : (i - 1 + n) % n));
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setLightboxIndex((i) => (i === null ? 0 : (i + 1) % n));
          return;
        }
      }
      if (e.key !== 'Escape') return;
      if (lightboxIndex !== null) {
        e.preventDefault();
        setLightboxIndex(null);
        return;
      }
      onClose();
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

  const handleAddComment = async ({ text, parentId, files = [] }: { text: string; parentId?: string; files?: File[] }) => {
    if (!postId) return;
    setCommentPosting(true);
    try {
      const res = await api.posts.addComment(postId, {
        comment: text,
        parentCommentId: parentId,
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

      const nextCommentCount = comments.length + 1;
      setComments((prev) => [...prev, nextComment]);
      setPost((prev) => prev ? { ...prev, comment_count: nextCommentCount } : prev);
      onPostChange?.(postId, { comment_count: nextCommentCount });
      showToast(uploadFailed ? 'Comment posted, but image upload failed' : 'Comment posted');
    } catch (err) {
      console.warn('Failed to add comment', err);
      showToast('Failed to add comment');
    } finally {
      setCommentPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!postId) return;
    try {
      await api.posts.deleteComment(postId, commentId);
      const nextCommentCount = Math.max(0, comments.length - 1);
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      setPost((prev) => prev ? { ...prev, comment_count: nextCommentCount } : prev);
      onPostChange?.(postId, { comment_count: nextCommentCount });
      showToast('Comment deleted');
    } catch (err) {
      console.warn('Failed to delete comment', err);
      showToast('Failed to delete comment');
    }
  };

  const likeMutation = useMutation({
    mutationFn: (postId: string) => api.posts.toggleLike(postId),
    onSuccess: (res, postId) => {
      setPost((prev) => prev ? { ...prev, userHasLiked: res.liked, like_count: res.likeCount } : prev);
      onPostChange?.(postId, { userHasLiked: res.liked, like_count: res.likeCount });
    },
    onError: (err) => {
      console.warn('Failed to toggle like', err);
      showToast('Failed to update like');
    },
  });

  const handleLike = () => {
    if (!post) return;
    likeMutation.mutate(post.id);
  };

  const handleCommentLike = async (commentId: string) => {
    if (!postId) return;
    try {
      const res = await api.posts.toggleCommentLike(postId, commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, userHasLiked: res.liked, like_count: res.likeCount } : c
        )
      );
    } catch (err) {
      console.warn('Failed to toggle comment like', err);
    }
  };

  const saveMutation = useMutation({
    mutationFn: (postId: string) => api.posts.toggleSave(postId),
    onMutate: () => {
      const prevSaved = post?.userHasSaved ?? false;
      setPost((prev) => prev ? { ...prev, userHasSaved: !prevSaved } : prev);
      return { prevSaved };
    },
    onSuccess: (res, postId) => {
      setPost((prev) => prev ? { ...prev, userHasSaved: res.saved } : prev);
      onPostChange?.(postId, { userHasSaved: res.saved });
      showToast(res.saved ? 'Post saved' : 'Removed from saved');
    },
    onError: (err, _postId, context) => {
      if (context) setPost((prev) => prev ? { ...prev, userHasSaved: context.prevSaved } : prev);
      console.warn('Failed to toggle save', err);
      showToast('Failed to update save');
    },
  });

  const handleSave = () => {
    if (!post) return;
    saveMutation.mutate(post.id);
  };

  const handleRepost = async () => {
    if (!post) return;
    try {
      const res = await api.posts.repostPost(post.id);
      const patch = {
        userHasReposted: res.reposted,
        share_count: res.shareCount,
      };
      setPost((prev) => prev ? {
        ...prev,
        ...patch,
      } : prev);
      onPostChange?.(post.id, patch);
      showToast(res.reposted ? 'Post reposted' : 'Repost removed');
    } catch (err) {
      console.warn('Failed to repost post', err);
      showToast('Failed to update repost');
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const url = buildCanonicalShareUrlForPost(post);

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: post.title || 'Post',
          text: post.content?.slice(0, 120),
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }

      const res = await api.posts.sharePost(post.id);
      setPost((prev) => prev ? { ...prev, share_count: res.shareCount } : prev);
      onPostChange?.(post.id, { share_count: res.shareCount });
      showToast('Post link shared');
    } catch (err) {
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
    publicAuthor?.handle ||
    post?.creator?.name ||
    post?.creator?.username ||
    'Neighbor';

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside
        ref={panelRef}
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
                <span className="text-sm font-semibold" style={{ color: config.color }}>
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
                  {creatorHandle ? (
                    <UserIdentityLink
                      userId={post.creator?.id || post.user_id}
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
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-app">
                  {post.content}
                </p>
              </div>

              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-5 pb-3">
                  {post.tags.map((tag) => (
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
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLightboxIndex(idx)}
                      className="relative block w-full cursor-zoom-in overflow-hidden rounded-xl border-0 bg-transparent p-0 text-left transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      aria-label={`View ${post.media_types?.[idx] === 'video' ? 'video' : 'image'} ${idx + 1} full size`}
                    >
                      <FeedMediaImage
                        src={url}
                        alt=""
                        className="max-h-80 w-full rounded-xl object-cover"
                        loading="lazy"
                      />
                      {post.media_types?.[idx] === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50">
                            <svg viewBox="0 0 24 24" fill="white" className="ml-0.5 h-6 w-6"><path d="M8 5v14l11-7z" /></svg>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 border-y border-app px-5 py-3 sm:grid-cols-5">
                <button
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
                  <span>{comments.length}</span>
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
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-app-muted transition hover-bg-app"
                >
                  <Share2 className="h-4 w-4" />
                  <span>{post.share_count || 0}</span>
                </button>
              </div>

              <div className="px-2">
                <CommentThread
                  comments={comments}
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                  onLikeComment={handleCommentLike}
                  currentUserId={currentUserId}
                  isPosting={commentPosting}
                  canCompose={canComment}
                  composeDisabledMessage={commentDisabledMessage}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-app-muted">
              Post not found
            </div>
          )}
        </div>

        {toast && (
          <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-xl">
            {toast}
          </div>
        )}
      </aside>

      {lightboxIndex !== null &&
        post?.media_urls &&
        post.media_urls.length > 0 &&
        lightboxIndex < post.media_urls.length && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Full size image"
            onClick={() => setLightboxIndex(null)}
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute right-4 top-4 z-[102] rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
            {post.media_urls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((i) =>
                      i === null ? 0 : (i - 1 + post.media_urls!.length) % post.media_urls!.length
                    );
                  }}
                  className="absolute left-2 top-1/2 z-[102] -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:left-4"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-7 w-7" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((i) =>
                      i === null ? 0 : (i + 1) % post.media_urls!.length
                    );
                  }}
                  className="absolute right-2 top-1/2 z-[102] -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:right-4"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-7 w-7" />
                </button>
              </>
            )}
            <div
              className="relative max-h-[min(92vh,1080px)] max-w-[min(96vw,1920px)]"
              onClick={(e) => e.stopPropagation()}
            >
              {post.media_types?.[lightboxIndex] === 'video' ? (
                <video
                  key={lightboxIndex}
                  src={post.media_urls[lightboxIndex]}
                  controls
                  autoPlay
                  className="max-h-[min(92vh,1080px)] w-auto max-w-full rounded-lg"
                />
              ) : (
                <FeedMediaImage
                  src={post.media_urls[lightboxIndex]}
                  alt=""
                  width={1920}
                  height={1080}
                  className="max-h-[min(92vh,1080px)] w-auto max-w-full object-contain"
                  priority
                />
              )}
            </div>
            {post.media_urls.length > 1 && (
              <div className="pointer-events-none absolute bottom-6 left-1/2 z-[102] -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                {lightboxIndex + 1} / {post.media_urls.length}
              </div>
            )}
          </div>
        )}
    </>
  );
}
