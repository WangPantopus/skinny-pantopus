'use client';

// Hands a document's first content (lib/firstContent.ts) to React Query, so the
// tab's screen renders from it on the server and in the browser's first render,
// and doesn't ask again while it is fresh.
//
// It goes into the cache in this boundary's first render, before the screen's
// own queries read it. The app shell above has already made some of the same
// entries in this render (empty: your homes, your primary home), and React
// Query's HydrationBoundary would only fill those in an effect, which the
// server never runs. The page hydrates in the same pass as the shell (no
// Suspense boundary between them), so the shell's reads find the content
// when their effects start instead of asking for it again.
//
// It is used once, for the account it was read for. The server read it with the
// cookies of this document's request; the browser checks that no sign-in, sign-out
// or account switch happened since (in this tab, or in another one before this
// tab was listening) before using it. Every later render of the same payload (the
// router keeps a visited route for 30 minutes, next.config.js staleTimes) leaves
// the screen to its own reads, as does content for another account: those screens
// load exactly as they do without first content.

import { useEffect, useState, type ReactNode } from 'react';
import { hydrate, useQueryClient, type DehydratedState } from '@tanstack/react-query';
import { authSessionMarker } from '@pantopus/api/client';
import { firstContentTag } from '@/lib/firstContent';

const spent = new WeakSet<DehydratedState>();

function cookieValue(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function readForThisSession(tag: string): boolean {
  // The API client counts this tab's session changes since it loaded.
  if (!authSessionMarker().startsWith('0:')) return false;
  return cookieValue('pantopus_session') === '1' && firstContentTag(cookieValue('pantopus_csrf')) === tag;
}

/** Always rendered, with `state` null when there is no content, so the screen keeps its place in the tree. */
export default function FirstContentBoundary({ state, tag, children }: {
  state: DehydratedState | null;
  tag: string;
  children: ReactNode;
}) {
  const client = useQueryClient();
  // Once, in the first render, so the browser's first render matches the server's.
  // hydrate() never replaces an entry holding newer data.
  useState(() => {
    const used = !!state && (typeof window === 'undefined' || (!spent.has(state) && readForThisSession(tag)));
    if (used && state) hydrate(client, state);
    return used;
  });
  useEffect(() => { if (state) spent.add(state); }, [state]);
  return children;
}
