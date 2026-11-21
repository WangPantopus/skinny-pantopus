'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';
import { formatTimeAgo as timeAgo, getPostTypeConfig } from '@pantopus/ui-utils';
import { chosenUsername } from '@pantopus/utils';
import type { Post } from '@pantopus/types';
import { useHydrated } from '@/hooks/useHydrated';
import FeedMediaImage from './FeedMediaImage';
import { resolvePostMediaSlots } from './PostMediaGrid';
import type { QuotedPostState } from './repost';

interface QuotedPostCardProps {
  /** The quoted original (readQuotedPost), or the post being quoted in the composer. */
  state: QuotedPostState;
  testId: string;
  /**
   * Opens the original in place (the feed's post panel). Without it the card links to the original's post page; a
   * modified click (new tab) always follows the link.
   */
  onOpen?: (postId: string) => void;
  /** The composer's copy: shown, not opened. */
  interactive?: boolean;
}

function authorName(post: Post): string {
  return post.author?.displayName
    || chosenUsername(post.author?.handle)
    || post.creator?.name
    || chosenUsername(post.creator?.username)
    || 'Someone nearby';
}

/** The first photo, or a video's frame, as a small square; nothing for a document or a video without a frame. */
function thumbnailOf(post: Post): { src: string; video: boolean } | null {
  const urls = Array.isArray(post.media_urls) ? post.media_urls : [];
  if (urls.length === 0 || typeof urls[0] !== 'string' || !urls[0]) return null;
  const slot = resolvePostMediaSlots(urls, post.media_types, post.media_live_urls)[0];
  const frame = post.media_thumbnails?.[0];
  if (slot.kind === 'document') return null;
  if (slot.kind === 'video') return frame ? { src: frame, video: true } : null;
  // Stored thumbnails are small square crops: right for a small square.
  return { src: frame || urls[0], video: false };
}

/**
 * The post a quote post quotes (PULSEREPOST contract §8.3), compact and read-only inside the quoting card: the
 * original author's small photo and name, how long ago, up to three lines (its title first) and its first photo. No
 * reactions, menu or repost on it. Its own tap opens the original, never the quoting post.
 */
export default function QuotedPostCard({ state, testId, onOpen, interactive = true }: QuotedPostCardProps) {
  const hydrated = useHydrated();

  if (state.kind === 'unavailable') {
    return (
      <div data-testid={testId} className="rounded-xl border border-app bg-surface-muted px-3 py-2.5 text-xs text-app-muted">
        This post isn&apos;t available.
      </div>
    );
  }

  const { post } = state;
  const name = authorName(post);
  const avatar = post.author?.avatarUrl || post.creator?.profile_picture_url || null;
  const thumb = thumbnailOf(post);
  const color = getPostTypeConfig(post.post_type || 'general').color;
  const title = typeof post.title === 'string' ? post.title.trim() : '';
  const content = typeof post.content === 'string' ? post.content : '';

  const body: ReactNode = (
    <div className="flex gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {avatar ? (
            <Image src={avatar} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" width={20} height={20} sizes="20px" quality={75} />
          ) : (
            <span
              aria-hidden="true"
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0"
              style={{ background: color }}
            >
              {name[0]?.toUpperCase() || '?'}
            </span>
          )}
          <span className="text-xs font-semibold text-app truncate">{name}</span>
          {/* "5m ago" follows the clock: shown once hydrated, as on the card. */}
          {hydrated && post.created_at ? (
            <>
              <span className="text-[10px] text-app-muted" aria-hidden="true">·</span>
              <span className="text-[10px] text-app-muted flex-shrink-0">{timeAgo(post.created_at)}</span>
            </>
          ) : null}
        </div>
        {(title || content) && (
          <p className="mt-1 text-xs text-app leading-relaxed whitespace-pre-wrap break-words line-clamp-3">
            {title && <span className="font-semibold">{title}</span>}
            {title && content ? '\n' : null}
            {content}
          </p>
        )}
      </div>
      {thumb && (
        <div className="relative w-14 h-14 flex-shrink-0 overflow-hidden rounded-lg bg-surface-muted">
          <FeedMediaImage src={thumb.src} alt="" width={112} height={112} className="h-full w-full object-cover" loading="lazy" />
          {thumb.video && (
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
                <svg viewBox="0 0 24 24" fill="white" className="ml-0.5 h-3 w-3"><path d="M8 5v14l11-7z" /></svg>
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );

  const frame = 'block rounded-xl border border-app bg-surface px-3 py-2.5';
  if (!interactive) {
    return <div data-testid={testId} className={frame}>{body}</div>;
  }

  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    // The quoting card's own tap would open the quoting post: the inner tap wins.
    event.stopPropagation();
    if (!onOpen || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onOpen(post.id);
  };

  return (
    <Link
      href={`/app/feed/post/${encodeURIComponent(post.id)}`}
      data-testid={testId}
      onClick={open}
      className={`${frame} hover-bg-app transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
    >
      {body}
    </Link>
  );
}
