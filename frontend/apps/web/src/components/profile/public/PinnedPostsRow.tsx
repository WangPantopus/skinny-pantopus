'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pin } from 'lucide-react';
import * as api from '@pantopus/api';
import type { Post } from '@pantopus/types';
import { getPostTypeConfig } from '@pantopus/ui-utils';
import FeedMediaImage from '@/components/feed/FeedMediaImage';
import { postTypeIcon } from '@/components/feed/PostCard';
import { queryKeys } from '@/lib/query-keys';

type PreviewAudience = 'neighbors' | 'connections';

// The kind's ink follows the theme (the palette's light and dark text colors), as on the feed's cards.
const KIND_TEXT = 'text-[color:var(--post-type-text)] dark:text-[color:var(--post-type-text-dark)]';

function kindText(type: string): CSSProperties {
  const config = getPostTypeConfig(type || 'general');
  return { '--post-type-text': config.textColor, '--post-type-text-dark': config.darkTextColor } as CSSProperties;
}

function kindTile(type: string): CSSProperties {
  // A light wash of the kind's color reads on light and dark surfaces alike.
  return { ...kindText(type), backgroundColor: `${getPostTypeConfig(type || 'general').color}1f` };
}

/** A post's kind as a tinted tile with its icon (Pinned cards, the editor's Pinned posts). */
export function PostKindTile({ type, className, iconClassName }: { type: string; className: string; iconClassName: string }) {
  const Icon = postTypeIcon(type || 'general');
  return (
    <span aria-hidden="true" className={`flex items-center justify-center ${KIND_TEXT} ${className}`} style={kindTile(type)}>
      <Icon className={iconClassName} strokeWidth={1.75} />
    </span>
  );
}

/** The post's title, or the first line of what it says. */
export function postFirstLine(post: Pick<Post, 'title' | 'content' | 'post_type'>): string {
  const title = post.title?.trim();
  if (title) return title;
  const line = (post.content || '').split('\n').map((part) => part.trim()).find(Boolean);
  return line || getPostTypeConfig(post.post_type || 'general').label;
}

/** The count that says most about it: Helpful marks, else replies. */
function mainCount(post: Post): string | null {
  const helpful = post.like_count || 0;
  if (helpful > 0) return `${helpful} helpful`;
  const replies = post.comment_count || 0;
  if (replies > 0) return `${replies} ${replies === 1 ? 'reply' : 'replies'}`;
  return null;
}

/** The first photo, when the post's first attachment is one. */
function firstPhoto(post: Post): string | null {
  const url = post.media_urls?.[0];
  if (!url) return null;
  const kind = (post.media_types?.[0] || '').toLowerCase();
  if (kind === 'video' || kind === 'document') return null;
  return post.media_thumbnails?.[0] || url;
}

interface PinnedPostsRowProps {
  personId: string;
  /** Signed in and allowed to read their posts (never signed out, a block, or the "anyone" preview). */
  enabled: boolean;
  /** Your own profile previewed as this audience (`?as=`). */
  audience?: PreviewAudience | null;
  /** Your own profile: where Edit goes (the editor's Pinned posts). */
  editHref?: string | null;
  /** A preview shows the cards as that audience sees them, without opening them. */
  inert?: boolean;
}

/**
 * The person's pinned posts (up to 3, newest pin first) as a row of cards that open the post. Hidden until the read
 * answers, and when there are none or it fails.
 */
export default function PinnedPostsRow({ personId, enabled, audience = null, editHref = null, inert = false }: PinnedPostsRowProps) {
  const query = useQuery({
    queryKey: queryKeys.personPinned(personId, audience ?? undefined),
    queryFn: () => api.posts.getUserPinnedPosts(personId, audience ? { as: audience } : undefined),
    enabled,
    staleTime: 60 * 1000,
  });
  const posts = (query.status === 'success' ? query.data?.posts : null) ?? [];
  if (!enabled || posts.length === 0) return null;
  const headingId = `pinned-${personId}`;

  return (
    <section className="mb-7" aria-labelledby={headingId} inert={inert || undefined}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <Pin aria-hidden="true" className="w-[1.125rem] h-[1.125rem] shrink-0 text-app-muted" strokeWidth={2} />
        <h2 id={headingId} className="flex-1 text-[1.25rem] leading-[1.5625rem] font-bold text-app">Pinned</h2>
        {editHref ? (
          <Link href={editHref} className="min-h-[2.75rem] -my-2.5 -mr-2 px-2 flex items-center text-[1.0625rem] text-app-link">
            Edit<span className="sr-only"> pinned posts</span>
          </Link>
        ) : null}
      </div>
      <ul className="-mx-5 px-5 lg:mx-0 lg:px-0 pb-1 flex gap-3 overflow-x-auto snap-x scroll-px-5 lg:scroll-px-0">
        {posts.slice(0, 3).map((post) => {
          const config = getPostTypeConfig(post.post_type || 'general');
          const photo = firstPhoto(post);
          const count = mainCount(post);
          const tile = <PostKindTile type={post.post_type || 'general'} className="w-full h-full" iconClassName="w-8 h-8" />;
          return (
            <li key={post.id} className="shrink-0 w-[10.5rem] snap-start">
              <Link
                href={`/app/feed/post/${encodeURIComponent(post.id)}`}
                className="h-full flex flex-col rounded-2xl border border-app bg-surface overflow-hidden hover-bg-app"
              >
                <span aria-hidden="true" className="block h-[4.5rem] shrink-0 overflow-hidden bg-app-surface-sunken">
                  {photo ? (
                    <FeedMediaImage src={photo} alt="" width={336} height={144} className="w-full h-full object-cover" errorFallback={tile} />
                  ) : tile}
                </span>
                <span className="flex-1 px-3 pt-3 pb-3.5 flex flex-col justify-between gap-2.5">
                  <span className="text-[0.9375rem] leading-5 font-semibold text-app line-clamp-3 [overflow-wrap:anywhere]">{postFirstLine(post)}</span>
                  <span className="text-[0.8125rem] leading-[1.125rem] text-app-muted">
                    <span className="sr-only">, </span>
                    <span className={`font-semibold ${KIND_TEXT}`} style={kindText(post.post_type || 'general')}>{config.label}</span>
                    {count ? ` · ${count}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
