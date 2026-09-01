'use client';

import { useCallback, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

const UNDO_TIMEOUT_MS = 5000;
const HIDE_SIMILAR_THRESHOLD = 3;

/**
 * Hook for dismissing gigs with undo toast and "hide similar" prompt.
 *
 * Returns:
 *   dismissGig(gigId, category) — call to dismiss a gig
 *   dismissedIds — Set of currently dismissed gig IDs (for local filtering)
 *   hideSimilarPrompt — { category, count } | null — show "Hide all X?" prompt
 *   confirmHideSimilar() — accept the hide-similar prompt
 *   dismissHideSimilarPrompt() — dismiss the prompt
 */
export function useDismissGig() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [hideSimilarPrompt, setHideSimilarPrompt] = useState<{
    category: string;
    count: number;
  } | null>(null);

  // Track per-session dismiss counts by category
  const categoryCountsRef = useRef<Map<string, number>>(new Map());
  const undoTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissGig = useCallback((gigId: string, category: string) => {
    // Optimistically add to dismissed set
    setDismissedIds((prev) => new Set(prev).add(gigId));

    // Call API (non-blocking)
    api.gigs.dismissGig(gigId).catch(() => {});

    // Track category count for "hide similar" prompt
    if (category) {
      const counts = categoryCountsRef.current;
      const newCount = (counts.get(category) || 0) + 1;
      counts.set(category, newCount);

      if (newCount >= HIDE_SIMILAR_THRESHOLD) {
        setHideSimilarPrompt({ category, count: newCount });
      }
    }

    // Clear any existing undo timer for this gig
    const existingTimer = undoTimersRef.current.get(gigId);
    if (existingTimer) clearTimeout(existingTimer);

    // Show undo toast
    toast.info(`Task hidden. Undo`, UNDO_TIMEOUT_MS);

    // Set undo timer — after timeout, the dismiss is permanent
    const timer = setTimeout(() => {
      undoTimersRef.current.delete(gigId);
    }, UNDO_TIMEOUT_MS);
    undoTimersRef.current.set(gigId, timer);

    // Return undo function
    return () => {
      clearTimeout(timer);
      undoTimersRef.current.delete(gigId);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(gigId);
        return next;
      });
      api.gigs.undismissGig(gigId).catch(() => {});

      // Decrement category count
      if (category) {
        const counts = categoryCountsRef.current;
        const current = counts.get(category) || 0;
        if (current > 0) counts.set(category, current - 1);
      }
    };
  }, []);

  const confirmHideSimilar = useCallback(() => {
    if (!hideSimilarPrompt) return;
    api.gigs.hideCategory(hideSimilarPrompt.category).catch(() => {});
    toast.success(`${hideSimilarPrompt.category} tasks hidden`);
    setHideSimilarPrompt(null);
  }, [hideSimilarPrompt]);

  const dismissHideSimilarPrompt = useCallback(() => {
    setHideSimilarPrompt(null);
  }, []);

  return {
    dismissGig,
    dismissedIds,
    hideSimilarPrompt,
    confirmHideSimilar,
    dismissHideSimilarPrompt,
  };
}
