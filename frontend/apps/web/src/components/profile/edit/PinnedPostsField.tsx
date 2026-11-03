'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { Post } from '@pantopus/types';
import { PostKindTile, postFirstLine } from '@/components/profile/public/PinnedPostsRow';
import { useProfilePin } from '@/hooks/useProfilePin';
import { queryKeys } from '@/lib/query-keys';

const MAX_PINS = 3;

/**
 * Edit profile's Pinned posts (up to 3): the posts pinned to your profile, each with Unpin (right away, not with
 * Save). Posts are pinned from their ⋯ menu.
 */
export default function PinnedPostsField({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient();
  const key = queryKeys.personPinned(accountId);
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.posts.getUserPinnedPosts(accountId),
    enabled: Boolean(accountId),
    staleTime: 60 * 1000,
  });
  const profilePin = useProfilePin();
  const [busy, setBusy] = useState<string | null>(null);
  const posts = query.data?.posts ?? [];

  const unpin = async (post: Post) => {
    setBusy(post.id);
    if (await profilePin(post, false)) {
      queryClient.setQueryData<{ posts: Post[] }>(key, (old) => (old ? { ...old, posts: old.posts.filter((p) => p.id !== post.id) } : old));
    }
    setBusy(null);
  };

  return (
    <section id="pinned" aria-labelledby="edit-pinned" className="mt-4 rounded-2xl border border-app bg-surface p-4 scroll-mt-24">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="edit-pinned" className="text-[1.0625rem] leading-[1.375rem] font-semibold text-app">Pinned posts</h3>
        {query.status === 'success' ? (
          <span className="text-[0.8125rem] leading-[1.125rem] text-app-muted">{posts.length} of {MAX_PINS}</span>
        ) : null}
      </div>
      {query.isError && !query.data ? (
        <p className="mt-2 text-[0.875rem] text-app-secondary">
          Your pinned posts didn&apos;t load.{' '}
          <button type="button" onClick={() => { void query.refetch(); }} className="min-h-[2.75rem] font-semibold text-app-link">Try again</button>
        </p>
      ) : null}
      {posts.length > 0 ? (
        <ul className="mt-2 divide-y divide-app">
          {posts.map((post) => {
            const title = postFirstLine(post);
            return (
              <li key={post.id} className="min-h-[3.75rem] py-1.5 flex items-center gap-3">
                <PostKindTile
                  type={post.post_type || 'general'}
                  className="w-9 h-9 shrink-0 rounded-[0.625rem]"
                  iconClassName="w-[1.1875rem] h-[1.1875rem]"
                />
                <span className="min-w-0 flex-1 text-[0.9375rem] leading-5 text-app line-clamp-2 [overflow-wrap:anywhere]">{title}</span>
                <button
                  type="button"
                  onClick={() => { void unpin(post); }}
                  disabled={busy === post.id}
                  aria-label={`Unpin “${title}”`}
                  // Opening the editor at #pinned never lands on a button that unpins.
                  data-anchor-skip
                  className="min-h-[2.75rem] shrink-0 pl-2 pr-0.5 text-[0.9375rem] text-app-link disabled:opacity-50"
                >
                  {busy === post.id ? 'Unpinning…' : 'Unpin'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="mt-1.5 text-[0.8125rem] leading-[1.125rem] text-app-muted">
        Pin a post from its ⋯ menu. You can pin up to {MAX_PINS}.
      </p>
    </section>
  );
}
