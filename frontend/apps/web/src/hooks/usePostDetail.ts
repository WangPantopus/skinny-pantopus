'use client';

// ============================================================
// One post and its comments, kept in the query cache and shared by the post
// page (/app/feed/post/[id]) and the feed's PostDetailPanel.
//
// A post opened from a feed list shows at once from the list's copy
// (initialData, dated by the list's load time). That copy lacks detail-only
// fields (sharing, edits, matched businesses), so it is always refreshed;
// a full copy is fresh for a minute (Instant Screens contract §4, "A post").
// Feed card changes reach the kept copy through patchPostInFeedCaches.
// ============================================================

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { Post, PostComment } from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';

export const POST_FRESH_MS = 60 * 1000;

/** The post as kept: `complete` is false for a copy taken from a feed list or card. */
export type PostEntry = { post: Post | null; complete: boolean };
type FeedPage = { posts?: Post[] };

/** The post from a feed list already in memory, and when that list was loaded. */
function postFromFeeds(queryClient: QueryClient, postId: string): { post: Post; updatedAt: number } | null {
  for (const [key, data] of queryClient.getQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] })) {
    for (const page of data?.pages ?? []) {
      const post = page?.posts?.find((candidate) => candidate.id === postId);
      if (post) return { post, updatedAt: queryClient.getQueryState(key)?.dataUpdatedAt ?? 0 };
    }
  }
  return null;
}

export function usePostDetail(postId: string | null, options: { enabled?: boolean; seed?: Post | null } = {}) {
  const { enabled = true, seed = null } = options;
  const queryClient = useQueryClient();
  const id = postId ?? '';
  const postKey = useMemo(() => queryKeys.postDetail(id), [id]);
  const commentsKey = useMemo(() => queryKeys.postComments(id), [id]);

  const postQuery = useQuery<PostEntry>({
    queryKey: postKey,
    queryFn: async () => ({ post: (await api.posts.getPost(id)).post, complete: true }),
    enabled: enabled && !!postId,
    staleTime: (query) => (query.state.data?.complete ? POST_FRESH_MS : 0),
    initialData: () => {
      const listed = seed && seed.id === id ? { post: seed, updatedAt: 0 } : postFromFeeds(queryClient, id);
      return listed ? { post: listed.post, complete: false } : undefined;
    },
    initialDataUpdatedAt: () => (seed && seed.id === id ? 0 : postFromFeeds(queryClient, id)?.updatedAt),
  });
  const commentsQuery = useQuery<PostComment[]>({
    queryKey: commentsKey,
    queryFn: async () => (await api.posts.getComments(id)).comments || [],
    enabled: enabled && !!postId,
    staleTime: POST_FRESH_MS,
  });

  const post = postQuery.data?.post ?? null;
  const comments = commentsQuery.data ?? post?.comments ?? [];

  // Edits update the kept copies, so coming back shows them.
  const setPost = useCallback((next: Post | null | ((p: Post | null) => Post | null)) => {
    queryClient.setQueryData<PostEntry>(postKey, (old) => ({
      post: typeof next === 'function' ? next(old?.post ?? null) : next,
      complete: old?.complete ?? true,
    }));
  }, [queryClient, postKey]);
  const setComments = useCallback((next: PostComment[] | ((prev: PostComment[]) => PostComment[])) => {
    queryClient.setQueryData<PostComment[]>(commentsKey, (old) => (typeof next === 'function' ? next(old ?? []) : next));
  }, [queryClient, commentsKey]);

  const status = (postQuery.error as { statusCode?: number } | null)?.statusCode;
  return {
    post,
    comments,
    postQuery,
    commentsQuery,
    setPost,
    setComments,
    /** Nothing to show yet (no kept or listed copy). */
    loading: postQuery.isPending && enabled && !!postId,
    /** The post is gone or no longer visible to you (404/403). */
    unavailable: !post && (status === 404 || status === 403),
    commentsFailed: commentsQuery.isError && !commentsQuery.data,
  };
}
