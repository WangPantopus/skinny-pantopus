'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { Post, PostComment, MatchedBusiness } from '@pantopus/api';
import type { User } from '@pantopus/types';
import {
  MessageCircle, Star, CalendarDays, Search as SearchIcon, Megaphone, AlertTriangle,
  Pencil, Siren, Tag, Wrench, Newspaper, Trophy, Compass, User as UserIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CommentThread } from '@/components/feed';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import FeedMediaImage from '@/components/feed/FeedMediaImage';
import { formatTimeAgo as timeAgo, getPostTypeConfig, POST_TYPE_ICONS_LUCIDE } from '@pantopus/ui-utils';
import { buildCanonicalShareUrlForPost } from '@pantopus/utils';
import Image from 'next/image';
import { confirmStore } from '@/components/ui/confirm-store';
import ReportModal from '@/components/ui/ReportModal';

// ─── Icon lookup (data from shared config, React icons stay local) ──
const LUCIDE_MAP: Record<string, LucideIcon> = {
  MessageCircle, Star, CalendarDays, Search: SearchIcon, Megaphone, AlertTriangle,
  Pencil, Siren, Tag, Wrench, Newspaper, Trophy, Compass, User: UserIcon,
};
function getTypeIcon(type: string): LucideIcon {
  const name = POST_TYPE_ICONS_LUCIDE[type] || 'Pencil';
  return LUCIDE_MAP[name] || Pencil;
}

// ═══════════════════════════════════════════════════════════════
// POST DETAIL PAGE
// ═══════════════════════════════════════════════════════════════

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentPosting, setCommentPosting] = useState(false);
  const [toast, setToast] = useState('');

  // Matched businesses
  const [matchedBusinesses, setMatchedBusinesses] = useState<MatchedBusiness[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);

  // Report flow
  const [showReportModal, setShowReportModal] = useState(false);

  // Lightbox
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // ─── Load user ─────────────────────────────────────────────
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

  // ─── Load post + comments ──────────────────────────────────
  useEffect(() => {
    if (!postId) return;
    (async () => {
      setLoading(true);
      try {
        const [postRes, commentsRes] = await Promise.all([
          api.posts.getPost(postId),
          api.posts.getComments(postId),
        ]);
        setPost(postRes.post);
        setComments(commentsRes.comments || postRes.post.comments || []);
      } catch (err) {
        console.error('Failed to load post', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

  // ─── Load matched businesses ───────────────────────────────
  useEffect(() => {
    if (!post) return;
    // Only load for ask_local/recommendation types
    const matchTypes = ['ask_local', 'recommendation', 'service_offer', 'lost_found'];
    if (!matchTypes.includes(post.post_type)) return;

    setLoadingBusinesses(true);
    api.posts
      .getMatchedBusinesses(postId, { cached: true })
      .then((res) => setMatchedBusinesses(res.businesses || []))
      .catch(() => {})
      .finally(() => setLoadingBusinesses(false));
  }, [post, postId]);

  // ─── Actions ───────────────────────────────────────────────
  const likeMutation = useMutation({
    mutationFn: (postId: string) => api.posts.toggleLike(postId),
    onMutate: () => {
      setPost((p: Post | null) =>
        p
          ? { ...p, userHasLiked: !p.userHasLiked, like_count: p.userHasLiked ? Math.max(0, p.like_count - 1) : p.like_count + 1 }
          : p
      );
    },
    onSuccess: (res) => {
      setPost((p: Post | null) => (p ? { ...p, userHasLiked: res.liked, like_count: res.likeCount } : p));
    },
    onError: () => {
      // Revert
      setPost((p) =>
        p
          ? { ...p, userHasLiked: !p.userHasLiked, like_count: p.userHasLiked ? Math.max(0, p.like_count - 1) : p.like_count + 1 }
          : p
      );
    },
  });

  const handleLike = useCallback(() => {
    if (!post) return;
    likeMutation.mutate(post.id);
  }, [post, likeMutation]);

  const saveMutation = useMutation({
    mutationFn: (postId: string) => api.posts.toggleSave(postId),
    onMutate: () => {
      const prevSaved = post?.userHasSaved ?? false;
      setPost((p: Post | null) => (p ? { ...p, userHasSaved: !prevSaved } : p));
      return { prevSaved };
    },
    onSuccess: (res) => {
      setPost((p: Post | null) => (p ? { ...p, userHasSaved: res.saved } : p));
      showToast(res.saved ? 'Post saved' : 'Removed from saved');
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      setPost((p: Post | null) => (p ? { ...p, userHasSaved: context.prevSaved } : p));
      showToast('Failed to update save');
    },
  });

  const handleSave = useCallback(() => {
    if (!post) return;
    saveMutation.mutate(post.id);
  }, [post, saveMutation]);

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
        } catch {
          uploadFailed = true;
        }
      }

      setComments((prev) => [...prev, nextComment]);
      setPost((p: Post | null) => (p ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p));
      showToast(uploadFailed ? 'Comment posted, but image upload failed' : 'Comment posted');
    } catch {
      showToast('Failed to add comment');
    } finally {
      setCommentPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!postId) return;
    try {
      await api.posts.deleteComment(postId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setPost((p: Post | null) => (p ? { ...p, comment_count: Math.max(0, (p.comment_count || 1) - 1) } : p));
      showToast('Comment deleted');
    } catch {
      showToast('Failed to delete comment');
    }
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
    } catch {
      console.warn('Failed to toggle comment like');
    }
  };

  const handleRepost = async () => {
    if (!post) return;
    try {
      const res = await api.posts.repostPost(post.id);
      setPost((p: Post | null) => (p ? {
        ...p,
        userHasReposted: res.reposted,
        share_count: res.shareCount,
      } : p));
      showToast(res.reposted ? 'Post reposted' : 'Repost removed');
    } catch {
      showToast('Failed to update repost');
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    const yes = await confirmStore.open({ title: 'Delete this post?', description: 'This cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.posts.deletePost(post.id);
      router.push('/app/feed');
    } catch {
      showToast('Failed to delete post');
    }
  };

  const handleResolve = async () => {
    if (!post) return;
    try {
      await api.posts.solvePost(post.id);
      const now = new Date().toISOString();
      setPost((p: Post | null) => (p ? { ...p, state: 'solved', solved_at: now, resolved_at: now } : p));
      showToast('Marked as solved');
    } catch {
      showToast('Failed to resolve');
    }
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!post) return;
    try {
      await api.posts.reportPost(post.id, { reason: reason as 'spam' | 'harassment' | 'inappropriate' | 'misinformation' | 'other', details });
      showToast("Post reported — we'll review it");
    } catch {
      showToast('Failed to report post');
    }
  };

  const handleShare = () => {
    if (!post) return;
    const url = buildCanonicalShareUrlForPost(post);
    const share = async () => {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: post.title || 'Post', text: post.content?.slice(0, 100), url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      const res = await api.posts.sharePost(post.id);
      setPost((p: Post | null) => (p ? { ...p, share_count: res.shareCount } : p));
      showToast('Link copied!');
    };

    share().catch(() => showToast('Failed to share post'));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ─── Derived ───────────────────────────────────────────────
  const config = getPostTypeConfig(post?.post_type || 'general');
  const TypeIcon = getTypeIcon(post?.post_type || 'general');
  const isOwn = post?.user_id === user?.id;
  // P0.4 audit follow-up: prefer post.author (typed identity).
  const publicAuthor = post?.author || null;
  const creatorName =
    publicAuthor?.displayName ||
    publicAuthor?.handle ||
    post?.creator?.name ||
    post?.creator?.username ||
    'Neighbor';
  const creatorAvatarUrl =
    publicAuthor?.avatarUrl ||
    post?.creator?.profile_picture_url ||
    null;
  const creatorHandle =
    publicAuthor?.handle ||
    post?.creator?.username ||
    null;
  const creatorInitial = (creatorName || '?')[0]?.toUpperCase() || '?';
  const locationText = '';
  const homeLabel = post?.home?.address || post?.home?.city || null;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="min-h-screen bg-app">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Back button skeleton */}
          <div className="mb-4 w-20 h-8 rounded-lg bg-surface-muted animate-pulse" />
          {/* Post skeleton */}
          <div className="bg-surface rounded-2xl shadow-sm border border-app p-6 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-surface-muted" />
              <div>
                <div className="w-28 h-4 rounded bg-surface-muted mb-2" />
                <div className="w-20 h-3 rounded bg-surface-muted" />
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="w-full h-4 rounded bg-surface-muted" />
              <div className="w-4/5 h-4 rounded bg-surface-muted" />
              <div className="w-3/5 h-4 rounded bg-surface-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-lg font-semibold text-app mb-1">Post not found</h2>
        <p className="text-sm text-app-muted mb-6">This post may have been deleted or is no longer available.</p>
        <button
          onClick={() => router.push('/app/feed')}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ─── Back navigation ──────────────────────────────── */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-app-muted hover:text-app transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* ─── Main post card ───────────────────────────────── */}
        <article
          className="bg-surface rounded-2xl shadow-sm border border-app overflow-hidden"
          style={{ borderColor: config.borderColor }}
        >
          {/* Type indicator */}
          <div
            className="flex items-center gap-2 px-5 py-3"
            style={{ background: config.bgLight }}
          >
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{ background: `${config.color}15`, color: config.color }}
            >
              <TypeIcon className="w-3.5 h-3.5" />
              {config.label}
            </span>
            <span className="text-[10px] text-app-muted">{timeAgo(post.created_at)}</span>
            {post.is_edited && (
              <span className="text-[10px] text-app-muted italic">edited</span>
            )}
            {post.state === 'solved' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                Solved
              </span>
            )}
          </div>

          {/* Safety alert banner */}
          {post.post_type === 'alert' && (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-red-50 border-b border-red-100">
              <span className="text-xs">🚨</span>
              <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
                Safety Alert{post.safety_alert_kind ? ` · ${post.safety_alert_kind}` : ''}
              </span>
            </div>
          )}

          {/* Author row */}
          <div className="flex items-center gap-3 px-5 py-4">
            {creatorAvatarUrl ? (
              <Image
                src={creatorAvatarUrl}
                alt={creatorName || ''}
                width={44}
                height={44}
                sizes="44px"
                quality={75}
                className="w-11 h-11 rounded-full object-cover ring-2 ring-app"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-semibold ring-2"
                style={{ background: config.color }}
              >
                {creatorInitial}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {creatorHandle ? (
                  <UserIdentityLink
                    userId={post.creator?.id || post.user_id}
                    username={creatorHandle}
                    displayName={creatorName || 'Neighbor'}
                    avatarUrl={creatorAvatarUrl}
                    city={null}
                    state={null}
                    textClassName="text-sm font-semibold text-app hover:underline"
                  />
                ) : (
                  <span className="text-sm font-semibold text-app">{creatorName}</span>
                )}
              </div>
              <div className="text-[11px] text-app-muted">
                {locationText && <span>{locationText}</span>}
                {homeLabel && <span> · from {homeLabel}</span>}
              </div>
            </div>

            {/* Owner / non-owner actions */}
            <div className="flex items-center gap-1">
              {isOwn && post.post_type === 'ask_local' && post.state !== 'solved' && (
                <button
                  onClick={handleResolve}
                  className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition"
                >
                  Mark Resolved
                </button>
              )}
              {isOwn && (
                <button
                  onClick={handleDelete}
                  className="p-2 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  title="Delete post"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              {!isOwn && (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="p-2 text-app-muted hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition"
                  title="Report post"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Location tag */}
          {(post.location_name || post.latitude) && (
            <div className="px-5 pb-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-app-muted bg-surface-muted border border-app rounded-full px-3 py-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {post.location_name || post.location_address || 'Pinned location'}
                {post.distance_meters != null && post.distance_meters > 0 && (
                  <span className="text-app-muted">
                    · {post.distance_meters < 1000
                        ? `${post.distance_meters}m away`
                        : `${(post.distance_meters / 1609.34).toFixed(1)} mi away`}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Title */}
          {post.title && (
            <h1 className="px-5 pb-1 text-lg font-bold text-app">{post.title}</h1>
          )}

          {/* Full content (no truncation) */}
          <div className="px-5 pb-4">
            <p className="text-sm text-app leading-relaxed whitespace-pre-wrap">
              {post.content}
            </p>
          </div>

          {/* Type-specific metadata cards */}
          {post.post_type === 'event' && (post.event_date || post.event_venue) && (
            <div className="mx-5 mb-3 p-3 bg-blue-50 rounded-xl border-l-4 border-blue-400 space-y-1">
              {post.event_date && (
                <div className="flex items-center gap-2 text-xs text-blue-800">
                  <span>📅</span>
                  <span>
                    {new Date(post.event_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {post.event_end_date && ` – ${new Date(post.event_end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                  </span>
                </div>
              )}
              {post.event_venue && (
                <div className="flex items-center gap-2 text-xs text-blue-800">
                  <span>📍</span>
                  <span>{post.event_venue}</span>
                </div>
              )}
            </div>
          )}

          {post.post_type === 'deal' && (post.deal_business_name || post.deal_expires_at) && (
            <div className="mx-5 mb-3 p-3 bg-green-50 rounded-xl border-l-4 border-green-400 space-y-1">
              {post.deal_business_name && (
                <div className="flex items-center gap-2 text-xs text-green-800">
                  <span>🏪</span>
                  <span>{post.deal_business_name}</span>
                </div>
              )}
              {post.deal_expires_at && (
                <div className="flex items-center gap-2 text-xs text-green-800">
                  <span>⏰</span>
                  <span>Expires {new Date(post.deal_expires_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          {post.post_type === 'lost_found' && post.lost_found_type && (
            <div className="mx-5 mb-3 p-3 bg-yellow-50 rounded-xl border-l-4 border-yellow-400">
              <div className="flex items-center gap-2 text-xs text-yellow-800 font-bold">
                <span>{post.lost_found_type === 'lost' ? '🔍' : '✅'}</span>
                <span className="uppercase">{post.lost_found_type}</span>
                {post.lost_found_contact_pref && <span className="font-normal">· Contact: {post.lost_found_contact_pref}</span>}
              </div>
            </div>
          )}

          {post.post_type === 'service_offer' && post.service_category && (
            <div className="mx-5 mb-3 p-3 bg-violet-50 rounded-xl border-l-4 border-violet-400">
              <div className="flex items-center gap-2 text-xs text-violet-800">
                <span>🔧</span>
                <span>{post.service_category}</span>
              </div>
            </div>
          )}

          {/* Cross-surface reference links */}
          {post.ref_listing_id && (
            <div className="mx-5 mb-3">
              <a href={`/app/marketplace/${post.ref_listing_id}`} className="flex items-center gap-2 px-3 py-2 bg-sky-50 rounded-xl text-xs text-sky-700 font-medium hover:bg-sky-100 transition">
                <span>🏪</span><span>View linked listing</span><span className="ml-auto">→</span>
              </a>
            </div>
          )}
          {post.ref_task_id && (
            <div className="mx-5 mb-3">
              <a href={`/app/gigs/${post.ref_task_id}`} className="flex items-center gap-2 px-3 py-2 bg-sky-50 rounded-xl text-xs text-sky-700 font-medium hover:bg-sky-100 transition">
                <span>🔨</span><span>View linked task</span><span className="ml-auto">→</span>
              </a>
            </div>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-5 pb-3">
              {post.tags.map((tag: string) => (
                <span key={tag} className="px-2 py-0.5 bg-sky-50 text-sky-700 text-[11px] font-medium rounded-full">#{tag}</span>
              ))}
            </div>
          )}

          {/* Media grid with lightbox */}
          {post.media_urls && post.media_urls.length > 0 && (
            <div
              className={`px-5 pb-4 grid gap-1.5 ${
                post.media_urls.length === 1
                  ? 'grid-cols-1'
                  : 'grid-cols-2'
              }`}
            >
              {post.media_urls.map((url: string, idx: number) => (
                <div
                  key={idx}
                  className={`relative overflow-hidden rounded-xl bg-surface-muted cursor-pointer hover:opacity-90 transition ${
                    post.media_urls!.length === 1 ? 'aspect-video' : 'aspect-square'
                  } ${post.media_urls!.length === 3 && idx === 0 ? 'row-span-2 aspect-auto' : ''}`}
                  onClick={() => setLightboxIdx(idx)}
                >
                  <FeedMediaImage src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-1 px-4 py-3 border-t border-app">
            {/* Like */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                post.userHasLiked
                  ? 'text-red-500 bg-red-50 hover:bg-red-100'
                  : 'text-app-muted hover-bg-app'
              }`}
            >
              <span className="text-sm">{post.userHasLiked ? '❤️' : '🤍'}</span>
              <span>{post.like_count || 0} {post.like_count === 1 ? 'like' : 'likes'}</span>
            </button>

            {/* Comment count */}
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-app-muted">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
            </span>

            {/* Bookmark */}
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                post.userHasSaved ? 'text-sky-600 bg-sky-50 hover:bg-sky-100' : 'text-app-muted hover-bg-app'
              }`}
            >
              <span className="text-sm">🔖</span>
              <span>{post.userHasSaved ? 'Saved' : 'Save'}</span>
            </button>

            <button
              onClick={handleRepost}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                post.userHasReposted ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-app-muted hover-bg-app'
              }`}
            >
              <span className="text-sm">🔁</span>
              <span>{post.userHasReposted ? 'Reposted' : 'Repost'}</span>
            </button>

            <div className="flex-1" />

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-app-muted hover-bg-app transition"
            >
              <span className="text-sm">↗️</span>
              <span>Share · {post.share_count || 0}</span>
            </button>
          </div>
        </article>

        {/* ─── Matched Businesses ────────────────────────────── */}
        {matchedBusinesses.length > 0 && (
          <div className="bg-surface rounded-2xl shadow-sm border border-app overflow-hidden">
            <div className="px-5 py-3 border-b border-app">
              <h3 className="text-sm font-semibold text-app flex items-center gap-2">
                <span>🏪</span>
                Matched Businesses
                <span className="text-[10px] text-app-muted font-normal">({matchedBusinesses.length})</span>
              </h3>
            </div>
            <div className="divide-y divide-app">
              {matchedBusinesses.map((biz) => (
                <a
                  key={biz.business_user_id}
                  href={`/app/profile/${biz.username}`}
                  className="flex items-center gap-3 px-5 py-3 hover-bg-app transition"
                >
                  {biz.profile_picture_url ? (
                    <Image src={biz.profile_picture_url} alt={biz.name} width={36} height={36} sizes="36px" quality={75} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-semibold">
                      {biz.name[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-app truncate">{biz.name}</div>
                    <div className="flex items-center gap-2 text-[11px] text-app-muted">
                      {biz.categories.length > 0 && <span>{biz.categories.slice(0, 2).join(', ')}</span>}
                      {biz.average_rating != null && (
                        <span className="flex items-center gap-0.5">
                          ⭐ {biz.average_rating.toFixed(1)}
                          <span className="text-app-muted">({biz.review_count})</span>
                        </span>
                      )}
                      {biz.distance_miles != null && (
                        <span>{biz.distance_miles.toFixed(1)} mi</span>
                      )}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}

        {loadingBusinesses && (
          <div className="bg-surface rounded-2xl shadow-sm border border-app p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-app-surface-sunken" />
              <div>
                <div className="w-24 h-3 rounded bg-app-surface-sunken mb-1.5" />
                <div className="w-16 h-2.5 rounded bg-app-surface-sunken" />
              </div>
            </div>
          </div>
        )}

        {/* ─── Comments section ──────────────────────────────── */}
        <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border-subtle overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-app-text-strong flex items-center gap-2">
              <svg className="w-4 h-4 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Comments
            </h3>
          </div>
          <div className="px-2">
            <CommentThread
              comments={comments}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onLikeComment={handleCommentLike}
              currentUserId={user?.id}
              isPosting={commentPosting}
            />
          </div>
        </div>
      </div>

      {/* ─── Media Lightbox ───────────────────────────────── */}
      {lightboxIdx !== null && post.media_urls && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          {/* Close */}
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Prev */}
          {lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
              className="absolute left-4 p-2 text-white/70 hover:text-white transition"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Image */}
          <FeedMediaImage
            src={post.media_urls[lightboxIdx]}
            alt=""
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {lightboxIdx < post.media_urls.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
              className="absolute right-4 p-2 text-white/70 hover:text-white transition"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Counter */}
          {post.media_urls.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium">
              {lightboxIdx + 1} / {post.media_urls.length}
            </div>
          )}
        </div>
      )}

      {/* ─── Report Modal ─────────────────────────────────── */}
      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        entityType="post"
      />

      {/* ─── Toast ─────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
