'use client';

import Image from 'next/image';
import React, { useState, type CSSProperties, type ReactNode } from 'react';
import {
  MessageCircle, Star, CalendarDays, Search, Megaphone,
  AlertTriangle, PenLine, Pencil, Siren, Tag, Wrench, Newspaper, X,
  Trophy, Compass, User, Bookmark, Lightbulb, CalendarCheck, PartyPopper,
  MapPin, Store, CheckCircle, Hammer, Plane, Bookmark as BookmarkIcon, Share, Repeat2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as api from '@pantopus/api';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import { personColor, personInitials } from '@/lib/personColor';
import { PostMediaPreview, resolvePostMediaSlots } from './PostMediaGrid';
import { PostLinkContent } from './LinkPreviewCard';
import LinkPreviewCard from './LinkPreviewCard';
import {
  formatDistance, formatTimeAgo as timeAgo, getPostTypeConfig, POST_TYPE_ICONS_LUCIDE, POST_REACTION_LABEL, postReaction,
  type PostTypeConfig,
} from '@pantopus/ui-utils';
import { chosenUsername } from '@pantopus/utils';
import { confirmStore } from '@/components/ui/confirm-store';
import PostMetadata from './PostMetadata';
import { canSharePost, sharePostLink } from './sharePostLink';
import type { AudienceProfile, Post } from '@pantopus/types';
import { launchFeatures } from '@/lib/featureFlags';
import { canOfferProfilePin } from '@/hooks/useProfilePin';

// ─── Lucide icon lookup (platform-specific JSX — data from shared config) ──
const LUCIDE_MAP: Record<string, LucideIcon> = {
  MessageCircle, Star, CalendarDays, Search, Megaphone, AlertTriangle,
  Pencil, Siren, Tag, Wrench, Newspaper, Trophy, Compass, User,
};

// Text on the card's own surface follows the theme: the palette's `textColor`
// in light mode and `darkTextColor` in dark mode (inline colors can't reach `dark:`).
const POST_TYPE_THEMED_TEXT = 'text-[color:var(--post-type-text)] dark:text-[color:var(--post-type-text-dark)]';
const postTypeTextVars = (config: PostTypeConfig) =>
  ({ '--post-type-text': config.textColor, '--post-type-text-dark': config.darkTextColor }) as CSSProperties;

/** The post kind's icon (a pencil for kinds this build doesn't know); a profile's Pinned cards use it too. */
export function postTypeIcon(type: string): LucideIcon {
  const name = POST_TYPE_ICONS_LUCIDE[type] || 'Pencil';
  return LUCIDE_MAP[name] || PenLine;
}

function getTypeIcon(type: string): ReactNode {
  const Icon = postTypeIcon(type);
  return <Icon className="w-4 h-4" />;
}

/** The icon of the post's one reaction, named by its kind (Going, Celebrate, Helpful); the post page uses it too. */
export function postReactionIcon(type: string | null | undefined): LucideIcon {
  switch (postReaction(type)) {
    case 'going': return CalendarCheck;
    case 'celebrate': return PartyPopper;
    default: return Lightbulb;
  }
}

function getTypeCtaIcon(type: string): ReactNode | null {
  const reply = <MessageCircle className="w-3.5 h-3.5" />;
  const map: Record<string, ReactNode> = {
    ask_local: reply,
    recommendation: <Bookmark className="w-3.5 h-3.5" />,
    event: reply,
    lost_found: <MapPin className="w-3.5 h-3.5" />,
    local_update: reply,
    announcement: reply,
    neighborhood_win: reply,
    progress_wins: reply,
    alert: <AlertTriangle className="w-3.5 h-3.5" />,
    deal: <Tag className="w-3.5 h-3.5" />,
    service_offer: reply,
  };
  return map[type] || null;
}

/** Connections: "Ben C. reposted", "Ben C. and Eve H. reposted", "Ben C. and 2 others reposted". */
function repostedByText(repostedBy: Post['reposted_by']): string | null {
  const first = repostedBy?.names?.[0];
  if (!repostedBy || !first || repostedBy.count < 1) return null;
  if (repostedBy.count === 1) return `${first} reposted`;
  const second = repostedBy.names[1];
  if (repostedBy.count === 2 && second) return `${first} and ${second} reposted`;
  const others = repostedBy.count - 1;
  return `${first} and ${others} ${others === 1 ? 'other' : 'others'} reposted`;
}

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onOpenDetail: (postId: string) => void;
  onReport?: (postId: string) => void;
  onSave?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  /** Opens the edit form for one of the viewer's own posts. */
  onEdit?: (post: Post) => void;
  /**
   * Pin to profile / Unpin from profile for one of the viewer's own posts. Offered only when the post says whether it
   * is pinned (`profile_pinned`) and can show on the profile; hooks/useProfilePin.ts.
   */
  onProfilePin?: (post: Post, pin: boolean) => void;
  onHide?: (postId: string) => void;
  onMute?: (target: Parameters<typeof api.posts.muteEntity>[0]) => void;
  onNotHelpful?: (postId: string) => void;
  onSolved?: (postId: string) => void;
  /** Dismisses a cold-start tip (a seeded fact, not a post). */
  onDismissSeeded?: (factId: string) => void;
  currentUserId?: string;
  /** A like or save is waiting for the server: the button shows it as pending. */
  isLiking?: boolean;
  isSaving?: boolean;
  surface?: string;
  showToast?: (msg: string) => void;
  /**
   * On a person's own profile, their account id: the author's initials then sit on the person's own color, as in the
   * profile header (and on iOS and Android). The feed colors initials by post kind.
   */
  authorColorSeed?: string;
}

function PostCard({
  post,
  onLike,
  onComment,
  onOpenDetail,
  onReport,
  onSave,
  onDelete,
  onEdit,
  onProfilePin,
  onHide,
  onMute,
  onNotHelpful,
  onSolved,
  onDismissSeeded,
  currentUserId,
  isLiking,
  isSaving,
  surface,
  showToast,
  authorColorSeed,
}: PostCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [solving, setSolving] = useState(false);
  const config = getPostTypeConfig(post.post_type || 'general');
  const typeIconNode = getTypeIcon(post.post_type || 'general');
  const ctaIconNode = getTypeCtaIcon(post.post_type || 'general');
  const reactionLabel = POST_REACTION_LABEL[postReaction(post.post_type)];
  const ReactionIcon = postReactionIcon(post.post_type);
  // A "Save" call to action saves the post, like the bookmark; the others open the replies.
  const ctaSaves = config.ctaIcon === 'bookmark' && Boolean(onSave);
  const authorUserId = post.author_user_id || post.user_id;
  const isOwn = authorUserId === currentUserId;
  const publicAuthor = post.author || null;
  const isOwnPersona = publicAuthor?.type === 'persona'
    && (publicAuthor as AudienceProfile).viewer?.isOwner === true;
  const muteTarget = isOwnPersona ? null : publicAuthor?.type === 'persona' && publicAuthor.id
    ? { entityType: 'persona' as const, entityId: publicAuthor.id }
    : post.identity_context_type === 'persona'
      ? null
      : authorUserId ? { entityType: 'user' as const, entityId: authorUserId } : null;

  // P0.4 audit follow-up: prefer the typed author shape (handle / displayName
  // / avatarUrl). The legacy post.creator slot still ships from the backend
  // via legacyCreatorFromAuthor, but new code reads from post.author so
  // retiring that bridge becomes safe.
  // A made-up username (user_…) is never shown as the author's name.
  const creatorName =
    publicAuthor?.displayName ||
    chosenUsername(publicAuthor?.handle) ||
    post.creator?.name ||
    chosenUsername(post.creator?.username) ||
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
  // A cold-start tip isn't a post: there's no page to open, nothing to react to, and its X dismisses it.
  const seeded = post.is_seeded === true;
  const tapClass = seeded ? '' : ' cursor-pointer';
  const openFullPost = () => { if (!seeded) onOpenDetail(post.id); };
  const repostedBy = repostedByText(post.reposted_by);

  return (
    <article
      className="group bg-surface rounded-2xl shadow-sm border transition-all duration-200 hover:shadow-md overflow-hidden"
      style={{ borderColor: config.borderColor }}
    >
      {/* ─── Who among your connections reposted it (Connections) ── */}
      {repostedBy && (
        <div className={`flex items-center gap-1.5 px-4 pt-3 text-[11px] font-medium text-app-muted${tapClass}`} onClick={openFullPost}>
          <Repeat2 className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{repostedBy}</span>
        </div>
      )}

      {/* ─── Type indicator strip ─────────────────────── */}
      <div className={`flex items-center gap-2 px-4 ${repostedBy ? 'pt-2' : 'pt-3'} pb-1${tapClass}`} onClick={openFullPost}>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{ background: config.bgLight, color: config.textColor }}
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
            Safety Alert{post.safety_alert_kind ? ` · ${post.safety_alert_kind.replace(/_/g, ' ')}` : ''}
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
            style={{ background: authorColorSeed ? personColor(authorColorSeed) : config.color }}
          >
            {authorColorSeed ? personInitials(creatorName) || creatorInitial : creatorInitial}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {/* Launch cuts #1 + #2: a Beacon author's name does not link to the hidden persona page. */}
            {publicAuthor?.type === 'persona' && !(launchFeatures.beacon && launchFeatures.personas) ? (
              <span className="text-sm font-semibold text-app truncate">{creatorName}</span>
            ) : publicAuthor?.href ? (
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

        {/* ─── Overflow menu (a tip gets a dismiss X instead) ─── */}
        {seeded ? (
          onDismissSeeded && (
            <button
              onClick={() => onDismissSeeded(post.id)}
              aria-label="Dismiss this tip"
              className="p-1.5 rounded-lg hover-bg-app transition"
            >
              <X className="w-4 h-4 text-app-muted" />
            </button>
          )
        ) : (
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="More actions"
            aria-expanded={menuOpen}
            className="p-1.5 rounded-lg hover-bg-app transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <svg className="w-4 h-4 text-app-muted" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="4" r="1.5" />
              <circle cx="10" cy="10" r="1.5" />
              <circle cx="10" cy="16" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-surface rounded-xl shadow-xl border border-app py-1 z-20">
              {isOwn && onEdit && (
                <button
                  onClick={() => { onEdit(post); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-app-muted hover-bg-app"
                >
                  Edit Post
                </button>
              )}
              {isOwn && onProfilePin && canOfferProfilePin(post) && (
                <button
                  onClick={() => { onProfilePin(post, !post.profile_pinned); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-app-muted hover-bg-app"
                >
                  {post.profile_pinned ? 'Unpin from profile' : 'Pin to profile'}
                </button>
              )}
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
              {!isOwn && onMute && muteTarget && (
                <button
                  onClick={async () => { const yes = await confirmStore.open({ title: muteTarget.entityType === 'persona' ? 'Mute this profile?' : 'Mute this user?', description: 'Their posts will be hidden from your Pulse. You can unmute them in Settings → Blocked Users.', confirmLabel: 'Mute', variant: 'destructive' }); if (yes) { onMute(muteTarget); setMenuOpen(false); } }}
                  className="w-full text-left px-3 py-2 text-xs text-app-muted hover-bg-app"
                >
                  {muteTarget.entityType === 'persona' ? 'Mute Profile' : 'Mute User'}
                </button>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* ─── Location tag (if post has location) ────── */}
      {(post.location_name || post.latitude) && (
        <div className={`px-4 pb-1${tapClass}`} onClick={openFullPost}>
          <span className="inline-flex items-center gap-1 text-[11px] text-app-muted bg-surface-muted rounded-full px-2 py-0.5">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {post.location_name || 'Pinned location'}
            {post.distance_meters != null && post.distance_meters > 0 && (
              <span className="text-app-muted">
                · {formatDistance(post.distance_meters) === 'nearby' ? 'nearby' : `${formatDistance(post.distance_meters)} away`}
              </span>
            )}
          </span>
        </div>
      )}

      {/* ─── Content ─────────────────────────────────── */}
      <div className={`px-4 pb-2${tapClass}`} onClick={openFullPost}>
        {post.title && <h3 className="mb-1 text-sm font-semibold text-app break-words">{post.title}</h3>}
        <p
          className="text-sm text-app leading-relaxed whitespace-pre-wrap break-words"
        >
          {post.content.length > 400 ? (
            <>
              <PostLinkContent content={post.content.slice(0, 400)} />
              <span className="text-app-link font-medium">… Read more</span>
            </>
          ) : (
            <PostLinkContent content={post.content} />
          )}
        </p>
      </div>

      {/* ─── Link preview ──────────────────────────────── */}
      {post.content && <LinkPreviewCard content={post.content} />}

      <PostMetadata post={post} onClick={seeded ? undefined : openFullPost} />

      {/* ─── Cross-surface reference links ─────────── */}
      {/* Launch cuts #3 (listings) and #4 (open tasks): their links are hidden. */}
      {launchFeatures.marketplace && post.ref_listing_id && (
        <div className="mx-4 mb-2">
          <a href={`/app/marketplace/${post.ref_listing_id}`} className="flex items-center gap-2 px-3 py-2 bg-sky-50 rounded-xl text-xs text-sky-700 font-medium hover:bg-sky-100 transition">
            <Store className="w-3.5 h-3.5 flex-shrink-0" /><span>View linked listing</span><span className="ml-auto">&rarr;</span>
          </a>
        </div>
      )}
      {launchFeatures.openGigs && post.ref_task_id && (
        <div className="mx-4 mb-2">
          <a href={`/app/gigs/${post.ref_task_id}`} className="flex items-center gap-2 px-3 py-2 bg-sky-50 rounded-xl text-xs text-sky-700 font-medium hover:bg-sky-100 transition">
            <Hammer className="w-3.5 h-3.5 flex-shrink-0" /><span>View linked task</span><span className="ml-auto">&rarr;</span>
          </a>
        </div>
      )}

      {/* ─── Tags ──────────────────────────────────── */}
      {post.tags && post.tags.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 px-4 pb-2${tapClass}`} onClick={openFullPost}>
          {[...new Set(post.tags)].slice(0, 5).map((tag: string) => (
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
              <PostMediaPreview url={url} thumbnailUrl={post.media_thumbnails?.[idx]} slot={resolvePostMediaSlots(post.media_urls, post.media_types, post.media_live_urls)[idx]} onPress={openFullPost} />


              {idx === 3 && post.media_urls.length > 4 && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">+{post.media_urls.length - 4}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Action bar (none on a tip) ──────────────── */}
      {!seeded && (
      <div className="flex items-center gap-1 px-3 py-2 border-t border-app">
        {/* The post's one reaction, named by its kind: Going (event), Celebrate (win), Helpful (the rest) */}
        <button
          onClick={() => onLike(post.id)}
          disabled={isLiking}
          aria-busy={isLiking || undefined}
          aria-pressed={Boolean(post.userHasLiked)}
          aria-label={post.like_count > 0 ? `${reactionLabel}, ${post.like_count}` : reactionLabel}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${isLiking ? 'opacity-60 ' : ''}${
            post.userHasLiked
              ? 'text-sky-600 bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300'
              : 'text-app-muted hover-bg-app'
          }`}
        >
          <ReactionIcon className="w-4 h-4" aria-hidden="true" />
          <span>{reactionLabel}</span>
          {post.like_count > 0 && <span>{post.like_count}</span>}
        </button>

        {/* Comment */}
        <button
          onClick={() => onComment(post.id)}
          aria-label="Comments"
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
          disabled={isSaving}
          aria-busy={isSaving || undefined}
          aria-label={post.userHasSaved ? 'Remove from saved' : 'Save post'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${isSaving ? 'opacity-60 ' : ''}${
            post.userHasSaved ? 'text-sky-600 bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300' : 'text-app-muted hover-bg-app'
          }`}
        >
          <BookmarkIcon className={`w-4 h-4 ${post.userHasSaved ? 'fill-current' : ''}`} />
        </button>

        {/* Share */}
        {canSharePost(post) && (
          <button
            onClick={async () => {
              try {
                if (!await sharePostLink(post)) return;
              } catch {
                showToast?.('Failed to share post. Please try again.');
                return;
              }
              showToast?.('Post link shared. Only people with access can open it.');
              void api.posts.sharePost(post.id).catch(() => {});
            }}
            aria-label="Share post"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-app-muted hover-bg-app transition"
          >
            <Share className="w-4 h-4" />
          </button>
        )}

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
              if (solving) return;
              setSolving(true);
              try {
                await api.posts.solvePost(post.id);
                onSolved?.(post.id);
                showToast?.('Marked solved');
              } catch {
                showToast?.('Could not mark this question solved. Please try again.');
              } finally {
                setSolving(false);
              }
            }}
            disabled={solving}
            aria-busy={solving || undefined}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" /> {solving ? 'Saving…' : 'Mark Solved'}
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
            onClick={() => (ctaSaves ? onSave?.(post.id) : onComment(post.id))}
            disabled={ctaSaves && isSaving}
            aria-pressed={ctaSaves ? Boolean(post.userHasSaved) : undefined}
            aria-busy={(ctaSaves && isSaving) || undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 hover:shadow-sm active:scale-95 ${ctaSaves && isSaving ? 'opacity-60 ' : ''}${POST_TYPE_THEMED_TEXT}`}
            style={{
              background: `${config.color}10`,
              border: `1px solid ${config.color}25`,
              ...postTypeTextVars(config),
            }}
          >
            {ctaIconNode && <span className="flex-shrink-0">{ctaIconNode}</span>}
            {ctaSaves && post.userHasSaved ? 'Saved' : config.ctaLabel}
          </button>
        )}
      </div>
      )}
    </article>
  );
}

export default React.memo(PostCard, (prev, next) => {
  return prev.post.id === next.post.id
    && prev.post.updated_at === next.post.updated_at
    && prev.post.like_count === next.post.like_count
    && prev.post.comment_count === next.post.comment_count
    && prev.post.userHasSaved === next.post.userHasSaved
    && prev.post.profile_pinned === next.post.profile_pinned
    && repostedByText(prev.post.reposted_by) === repostedByText(next.post.reposted_by)
    && prev.isLiking === next.isLiking
    && prev.isSaving === next.isSaving
    && prev.currentUserId === next.currentUserId
    && prev.surface === next.surface
    && prev.onLike === next.onLike
    && prev.onComment === next.onComment
    && prev.onOpenDetail === next.onOpenDetail
    && prev.onReport === next.onReport
    && prev.onSave === next.onSave
    && prev.onDelete === next.onDelete
    && prev.onEdit === next.onEdit
    && prev.onProfilePin === next.onProfilePin
    && prev.onHide === next.onHide
    && prev.onMute === next.onMute
    && prev.onDismissSeeded === next.onDismissSeeded;
});
