'use client';

import Image from 'next/image';
import React, { useState, type ReactNode } from 'react';
import {
  MessageCircle, Star, Calendar, CalendarDays, Search, Megaphone,
  AlertTriangle, PenLine, Pencil, Siren, Tag, Wrench, Newspaper,
  Trophy, Compass, User, Heart, Bookmark, Hand, ThumbsUp,
  MapPin, Store, Clock, CheckCircle, Hammer, Plane, Bookmark as BookmarkIcon, Share,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as api from '@pantopus/api';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import FeedMediaImage from './FeedMediaImage';
import LinkPreviewCard from './LinkPreviewCard';
import { formatTimeAgo as timeAgo, getPostTypeConfig, POST_TYPE_ICONS_LUCIDE } from '@pantopus/ui-utils';
import { buildCanonicalShareUrlForPost } from '@pantopus/utils';
import { confirmStore } from '@/components/ui/confirm-store';
import type { Post } from '@pantopus/types';

// ─── Lucide icon lookup (platform-specific JSX — data from shared config) ──
const LUCIDE_MAP: Record<string, LucideIcon> = {
  MessageCircle, Star, CalendarDays, Search, Megaphone, AlertTriangle,
  Pencil, Siren, Tag, Wrench, Newspaper, Trophy, Compass, User,
};

function getTypeIcon(type: string): ReactNode {
  const name = POST_TYPE_ICONS_LUCIDE[type] || 'Pencil';
  const Icon = LUCIDE_MAP[name] || PenLine;
  return <Icon className="w-4 h-4" />;
}

function getTypeCtaIcon(type: string): ReactNode | null {
  const map: Record<string, ReactNode> = {
    ask_local: <MessageCircle className="w-3.5 h-3.5" />,
    recommendation: <Bookmark className="w-3.5 h-3.5" />,
    event: <Hand className="w-3.5 h-3.5" />,
    lost_found: <MapPin className="w-3.5 h-3.5" />,
    announcement: <ThumbsUp className="w-3.5 h-3.5" />,
    alert: <AlertTriangle className="w-3.5 h-3.5" />,
    deal: <Tag className="w-3.5 h-3.5" />,
    service_offer: <MessageCircle className="w-3.5 h-3.5" />,
  };
  return map[type] || null;
}

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onOpenDetail: (postId: string) => void;
  onReport?: (postId: string) => void;
  onSave?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onHide?: (postId: string) => void;
  onMute?: (userId: string) => void;
  onNotHelpful?: (postId: string) => void;
  onSolved?: (postId: string) => void;
  currentUserId?: string;
  isLiking?: boolean;
  surface?: string;
  showToast?: (msg: string) => void;
}

function PostCard({
  post,
  onLike,
  onComment,
  onOpenDetail,
  onReport,
  onSave,
  onDelete,
  onHide,
  onMute,
  onNotHelpful,
  onSolved,
  currentUserId,
  isLiking,
  surface,
  showToast,
}: PostCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const config = getPostTypeConfig(post.post_type || 'general');
  const typeIconNode = getTypeIcon(post.post_type || 'general');
  const ctaIconNode = getTypeCtaIcon(post.post_type || 'general');
  const authorUserId = post.author_user_id || post.user_id;
  const isOwn = authorUserId === currentUserId;
  const publicAuthor = post.author || null;

  // P0.4 audit follow-up: prefer the typed author shape (handle / displayName
  // / avatarUrl). The legacy post.creator slot still ships from the backend
  // via legacyCreatorFromAuthor, but new code reads from post.author so
  // retiring that bridge becomes safe.
  const creatorName =
    publicAuthor?.displayName ||
    publicAuthor?.handle ||
    post.creator?.name ||
    post.creator?.username ||
    'Neighbor';

  const creatorAvatar =
    publicAuthor?.avatarUrl ||
    post.creator?.profile_picture_url ||
    null;
  const creatorInitial = creatorName[0]?.toUpperCase() || '?';
  // City / state never lived on the typed author shape; the legacy reads
  // were always a User-row leak, gone after P0.3 narrowed the SELECT.
  const locationText = '';
  const homeLabel = post.home?.address || post.home?.city || null;
  const openFullPost = () => onOpenDetail(post.id);

  return (
    <article
      className="group bg-surface rounded-2xl shadow-sm border transition-all duration-200 hover:shadow-md overflow-hidden"
      style={{ borderColor: config.borderColor }}
    >
      {/* ─── Type indicator strip ─────────────────────── */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1 cursor-pointer" onClick={openFullPost}>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{ background: config.bgLight, color: config.color }}
        >
          <span className="flex-shrink-0">{typeIconNode}</span>
          {config.label}
        </span>
        {post.is_visitor_post && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700">
            <Plane className="w-3 h-3" /> Visitor
          </span>
        )}
        <span className="text-[10px] text-app-muted">·</span>
        <span className="text-[10px] text-app-muted">{timeAgo(post.created_at)}</span>
        {post.is_edited && (
          <>
            <span className="text-[10px] text-app-muted">·</span>
            <span className="text-[10px] text-app-muted italic">edited</span>
          </>
        )}
      </div>

      {/* ─── Safety alert banner ─────────────────────── */}
      {post.post_type === 'alert' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100">
          <Siren className="w-3.5 h-3.5" />
          <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
            Safety Alert{post.safety_alert_kind ? ` · ${post.safety_alert_kind}` : ''}
          </span>
        </div>
      )}

      {/* ─── Author row ──────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2">
        {creatorAvatar ? (
          <Image
            src={creatorAvatar}
            alt={creatorName}
            className="w-9 h-9 rounded-full object-cover ring-2 ring-app"
            width={36}
            height={36}
            sizes="36px"
            quality={75}
          />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold ring-2"
            style={{ background: config.color }}
          >
            {creatorInitial}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {publicAuthor?.href ? (
              <a href={publicAuthor.href} className="text-sm font-semibold text-app hover:underline truncate">
                {creatorName}
              </a>
            ) : (publicAuthor?.handle || post.creator?.username) ? (
              <UserIdentityLink
                userId={authorUserId}
                username={publicAuthor?.handle || post.creator?.username || ''}
                displayName={creatorName}
                avatarUrl={creatorAvatar}
                city={null}
                state={null}
                textClassName="text-sm font-semibold text-app hover:underline truncate"
              />
            ) : (
              <span className="text-sm font-semibold text-app truncate">{creatorName}</span>
            )}
            {homeLabel && (
              <span className="text-[10px] text-app-muted bg-surface-muted px-1.5 py-0.5 rounded-full truncate max-w-[140px]">
                from {homeLabel}
              </span>
            )}
          </div>
          {locationText && (
            <span className="text-[11px] text-app-muted">{locationText}</span>
          )}
        </div>

        {/* ─── Overflow menu ───────────────────────────── */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg hover-bg-app transition sm:opacity-0 sm:group-hover:opacity-100"
          >
            <svg className="w-4 h-4 text-app-muted" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="4" r="1.5" />
              <circle cx="10" cy="10" r="1.5" />
              <circle cx="10" cy="16" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-surface rounded-xl shadow-xl border border-app py-1 z-20">
              {isOwn && onDelete && (
                <button
                  onClick={async () => { const yes = await confirmStore.open({ title: 'Delete this post?', confirmLabel: 'Delete', variant: 'destructive' }); if (yes) { onDelete(post.id); setMenuOpen(false); } }}
                  className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                >
                  Delete Post
                </button>
              )}
              {!isOwn && onReport && (
                <button
                  onClick={() => { onReport(post.id); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-app-muted hover-bg-app"
                >
                  Report Post
                </button>
              )}
              {!isOwn && onHide && (
                <button
                  onClick={() => { onHide(post.id); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-app-muted hover-bg-app"
                >
                  Hide Post
                </button>
              )}
              {!isOwn && onMute && authorUserId && (
                <button
                  onClick={async () => { const yes = await confirmStore.open({ title: 'Mute this user?', description: 'Their posts will be hidden from your Pulse.', confirmLabel: 'Mute', variant: 'destructive' }); if (yes) { onMute(authorUserId); setMenuOpen(false); } }}
                  className="w-full text-left px-3 py-2 text-xs text-app-muted hover-bg-app"
                >
                  Mute User
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Location tag (if post has location) ────── */}
      {(post.location_name || post.latitude) && (
        <div className="px-4 pb-1 cursor-pointer" onClick={openFullPost}>
          <span className="inline-flex items-center gap-1 text-[11px] text-app-muted bg-surface-muted rounded-full px-2 py-0.5">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {post.location_name || 'Pinned location'}
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

      {/* ─── Content ─────────────────────────────────── */}
      <div className="px-4 pb-2 cursor-pointer" onClick={openFullPost}>
        <p
          className="text-sm text-app leading-relaxed whitespace-pre-wrap"
        >
          {post.content.length > 400 ? (
            <>
              {post.content.slice(0, 400)}
              <span className="text-primary-500 font-medium">… Read more</span>
            </>
          ) : (
            post.content
          )}
        </p>
      </div>

      {/* ─── Link preview ──────────────────────────────── */}
      {post.content && <LinkPreviewCard content={post.content} />}

      {/* ─── Type-specific metadata cards ────────────── */}
      {(post.post_type === 'event') && (post.event_date || post.event_venue) && (
        <div className="mx-4 mb-2 p-3 bg-blue-50 rounded-xl border-l-4 border-blue-400 space-y-1 cursor-pointer" onClick={openFullPost}>
          {post.event_date && (
            <div className="flex items-center gap-2 text-xs text-blue-800">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {new Date(post.event_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                {post.event_end_date ? ` – ${new Date(post.event_end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
              </span>
            </div>
          )}
          {post.event_venue && (
            <div className="flex items-center gap-2 text-xs text-blue-800">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{post.event_venue}</span>
            </div>
          )}
        </div>
      )}

      {post.post_type === 'deal' && (post.deal_business_name || post.deal_expires_at) && (
        <div className="mx-4 mb-2 p-3 bg-green-50 rounded-xl border-l-4 border-green-400 space-y-1 cursor-pointer" onClick={openFullPost}>
          {post.deal_business_name && (
            <div className="flex items-center gap-2 text-xs text-green-800">
              <Store className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{post.deal_business_name}</span>
            </div>
          )}
          {post.deal_expires_at && (
            <div className="flex items-center gap-2 text-xs text-green-800">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Expires {new Date(post.deal_expires_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      )}

      {post.post_type === 'lost_found' && post.lost_found_type && (
        <div className="mx-4 mb-2 p-3 bg-yellow-50 rounded-xl border-l-4 border-yellow-400 cursor-pointer" onClick={openFullPost}>
          <div className="flex items-center gap-2 text-xs text-yellow-800 font-bold">
            {post.lost_found_type === 'lost' ? <Search className="w-3.5 h-3.5 flex-shrink-0" /> : <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            <span className="uppercase">{post.lost_found_type}</span>
            {post.lost_found_contact_pref && <span className="font-normal">· Contact: {post.lost_found_contact_pref}</span>}
          </div>
        </div>
      )}

      {post.post_type === 'service_offer' && post.service_category && (
        <div className="mx-4 mb-2 p-3 bg-violet-50 rounded-xl border-l-4 border-violet-400 cursor-pointer" onClick={openFullPost}>
          <div className="flex items-center gap-2 text-xs text-violet-800">
            <Wrench className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{post.service_category}</span>
          </div>
        </div>
      )}

      {/* ─── Cross-surface reference links ─────────── */}
      {post.ref_listing_id && (
        <div className="mx-4 mb-2">
          <a href={`/app/marketplace/${post.ref_listing_id}`} className="flex items-center gap-2 px-3 py-2 bg-sky-50 rounded-xl text-xs text-sky-700 font-medium hover:bg-sky-100 transition">
            <Store className="w-3.5 h-3.5 flex-shrink-0" /><span>View linked listing</span><span className="ml-auto">&rarr;</span>
          </a>
        </div>
      )}
      {post.ref_task_id && (
        <div className="mx-4 mb-2">
          <a href={`/app/gigs/${post.ref_task_id}`} className="flex items-center gap-2 px-3 py-2 bg-sky-50 rounded-xl text-xs text-sky-700 font-medium hover:bg-sky-100 transition">
            <Hammer className="w-3.5 h-3.5 flex-shrink-0" /><span>View linked task</span><span className="ml-auto">&rarr;</span>
          </a>
        </div>
      )}

      {/* ─── Tags ──────────────────────────────────── */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2 cursor-pointer" onClick={openFullPost}>
          {post.tags.slice(0, 5).map((tag: string) => (
            <span key={tag} className="px-2 py-0.5 bg-sky-50 text-sky-700 text-[11px] font-medium rounded-full">#{tag}</span>
          ))}
        </div>
      )}

      {/* ─── Media grid ──────────────────────────────── */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div
          className={`px-4 pb-3 grid gap-1.5 ${
            post.media_urls.length === 1
              ? 'grid-cols-1'
              : post.media_urls.length === 2
              ? 'grid-cols-2'
              : 'grid-cols-2'
          } cursor-pointer`}
          onClick={openFullPost}
        >
          {post.media_urls.slice(0, 4).map((url: string, idx: number) => (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-xl bg-surface-muted ${
                post.media_urls.length === 1 ? 'aspect-video' : 'aspect-square'
              } ${post.media_urls.length === 3 && idx === 0 ? 'row-span-2 aspect-auto' : ''}`}
            >
              <FeedMediaImage src={post.media_thumbnails?.[idx] || url} alt="" className="w-full h-full object-cover" loading="lazy" />
              {post.media_types?.[idx] === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50">
                    <svg viewBox="0 0 24 24" fill="white" className="ml-0.5 h-5 w-5"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              )}
              {idx === 3 && post.media_urls.length > 4 && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">+{post.media_urls.length - 4}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Action bar ──────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-app">
        {/* Like */}
        <button
          onClick={() => onLike(post.id)}
          disabled={isLiking}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            post.userHasLiked
              ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-app-muted hover-bg-app'
          }`}
        >
          <Heart className={`w-4 h-4 ${post.userHasLiked ? 'fill-current' : ''}`} />
          {post.like_count > 0 && <span>{post.like_count}</span>}
        </button>

        {/* Comment */}
        <button
          onClick={() => onComment(post.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-app-muted hover-bg-app transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {post.comment_count > 0 && <span>{post.comment_count}</span>}
        </button>

        {/* Bookmark */}
        <button
          onClick={() => onSave?.(post.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            post.userHasSaved ? 'text-sky-600 bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300' : 'text-app-muted hover-bg-app'
          }`}
        >
          <BookmarkIcon className={`w-4 h-4 ${post.userHasSaved ? 'fill-current' : ''}`} />
        </button>

        {/* Share */}
        <button
          onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.share) {
              navigator.share({ title: post.title || 'Post', text: post.content?.slice(0, 100), url: buildCanonicalShareUrlForPost(post) })
                .then(() => api.posts.sharePost(post.id))
                .catch(() => {});
            } else {
              navigator.clipboard?.writeText(buildCanonicalShareUrlForPost(post));
              void api.posts.sharePost(post.id).catch(() => {});
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-app-muted hover-bg-app transition"
        >
          <Share className="w-4 h-4" />
        </button>

        {/* Not Helpful — only on Place surface, not own posts */}
        {surface === 'place' && !isOwn && (
          <button
            onClick={async () => {
              try {
                // Map surface tab name to DB-valid value
                const dbSurface = surface === 'place' ? 'nearby' : surface;
                await api.posts.markNotHelpful(post.id, dbSurface);
                onNotHelpful?.(post.id);
                showToast?.('Thanks — we\'ll show fewer posts like this here.');
              } catch {}
            }}
            title="Not helpful for this area"
            className="p-1.5 rounded-lg text-app-muted hover:text-app hover-bg-app transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
            </svg>
          </button>
        )}

        {/* Mark as Solved — only author, only Ask posts */}
        {post.post_type === 'ask_local' &&
          isOwn && post.state !== 'solved' && (
          <button
            onClick={async () => {
              try {
                await api.posts.solvePost(post.id);
                onSolved?.(post.id);
              } catch {}
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Mark Solved
          </button>
        )}

        {/* Solved badge */}
        {post.state === 'solved' && (
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-green-600 bg-green-50 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5" /> Solved
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Type-specific CTA */}
        {config.ctaLabel && (
          <button
            onClick={() => onComment(post.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 hover:shadow-sm active:scale-95"
            style={{
              background: `${config.color}10`,
              color: config.color,
              border: `1px solid ${config.color}25`,
            }}
          >
            {ctaIconNode && <span className="flex-shrink-0">{ctaIconNode}</span>}
            {config.ctaLabel}
          </button>
        )}
      </div>
    </article>
  );
}

export default React.memo(PostCard, (prev, next) => {
  return prev.post.id === next.post.id
    && prev.post.updated_at === next.post.updated_at
    && prev.post.like_count === next.post.like_count
    && prev.post.comment_count === next.post.comment_count
    && prev.isLiking === next.isLiking
    && prev.currentUserId === next.currentUserId
    && prev.surface === next.surface
    && prev.onLike === next.onLike
    && prev.onComment === next.onComment
    && prev.onOpenDetail === next.onOpenDetail
    && prev.onReport === next.onReport
    && prev.onSave === next.onSave
    && prev.onDelete === next.onDelete
    && prev.onHide === next.onHide
    && prev.onMute === next.onMute;
});
