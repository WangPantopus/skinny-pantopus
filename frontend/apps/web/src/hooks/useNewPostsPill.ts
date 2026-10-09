'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Post } from '@pantopus/api';

// New posts wait behind a pill (Instant Screens contract §3 "New items arrive").
//
// A quiet refresh of the feed (coming back to the browser tab, the network
// returning) can bring posts that sort above the ones the reader already had.
// Inserted while the reader is scrolled down, they would push the post being
// read down the list. Until the reader is back at the top, those posts stay out
// of the list and are counted on an "N new posts" pill; tapping it scrolls to
// the top and shows them. At the top they slide straight in. The list is
// filtered from the live cache, so likes and saves still update every card
// shown, and your own posts always show.

/** Within this distance of the top, new posts slide in. */
const TOP_PX = 24;

interface Options {
  /** Changes when the feed shows another list (surface, filter, area, lane): a new list starts with nothing held. */
  listKey: string;
  /** The feed's own scroll area. */
  scrollRef: RefObject<HTMLElement | null>;
  currentUserId?: string | null;
}

export function useNewPostsPill(posts: Post[], { listKey, scrollRef, currentUserId }: Options) {
  // The posts each list has shown, so a refresh can tell which ones are new.
  const seen = useRef(new Map<string, Set<string>>());
  const [atTop, setAtTop] = useState(true);
  const hasList = posts.length > 0;
  // A list that was empty (first read, or read again from scratch) opens with nothing held.
  const [listShown, setListShown] = useState(hasList);

  useEffect(() => {
    setListShown(hasList);
    const el = scrollRef.current;
    if (!el) { setAtTop(true); return undefined; }
    const onScroll = () => setAtTop(el.scrollTop <= TOP_PX);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef, hasList, listKey]);

  const { shown, held } = useMemo(() => {
    const ids = seen.current.get(listKey);
    if (atTop || !listShown || !ids || ids.size === 0) return { shown: posts, held: [] as Post[] };
    // Posts above the first one the reader already had, which they haven't had yet.
    const firstSeen = posts.findIndex((post) => ids.has(post.id));
    if (firstSeen <= 0) return { shown: posts, held: [] as Post[] };
    const own = (post: Post) => !!currentUserId && (post.user_id === currentUserId || post.author_user_id === currentUserId);
    const newer = posts.slice(0, firstSeen).filter((post) => !ids.has(post.id) && !own(post));
    if (newer.length === 0) return { shown: posts, held: newer };
    const heldIds = new Set(newer.map((post) => post.id));
    return { shown: posts.filter((post) => !heldIds.has(post.id)), held: newer };
  }, [posts, atTop, listShown, listKey, currentUserId]);

  useEffect(() => {
    let ids = seen.current.get(listKey);
    if (!ids) { ids = new Set(); seen.current.set(listKey, ids); }
    for (const post of shown) ids.add(post.id);
  }, [shown, listKey]);

  /** The pill's tap: the new posts join the list, then the list goes back to the top. */
  const showNewPosts = useCallback(() => {
    // Kept as shown even if a scroll event lands before the list updates.
    let ids = seen.current.get(listKey);
    if (!ids) { ids = new Set(); seen.current.set(listKey, ids); }
    for (const post of held) ids.add(post.id);
    setAtTop(true);
    // Scrolling in the same moment would race a virtualized list measuring the posts it just gained.
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; });
  }, [held, listKey, scrollRef]);

  return { posts: shown, newCount: held.length, showNewPosts };
}
