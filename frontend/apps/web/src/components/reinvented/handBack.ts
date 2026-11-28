'use client';

// Going back from the new Pulse's "+" (coord BRIEF §1, LEAD-6 03:07): when the server says the switch is off for the
// person while the Studio is open, the new Pulse gives way to today's Pulse at once, and the composer inside it goes
// with it. So the words (the caption, or a card's words) are handed to today's Moments the way the assistant hands it
// a Moment ("Open in Moments": this tab's session storage, taken once as Moments opens), and today's Moments opens
// with today's composer holding them. Nothing goes in the address bar.

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { MomentChatDraft } from '@pantopus/types';
import { AI_MOMENT_DRAFT_KEY, handOffDraft } from '@/lib/aiDraftHandoff';

const SWITCH = ['featureFlag', 'pulse_reinvented'];

/**
 * Reads the switch again; once it says off, keeps `words` for today's Moments and opens it. True when handed over;
 * false while the switch still reads on (or the words can't be kept), so the caller keeps them where it is.
 */
export function useHandBackToMoments() {
  const client = useQueryClient();
  const router = useRouter();
  return useCallback(
    async (words: MomentChatDraft): Promise<boolean> => {
      await client.refetchQueries({ queryKey: SWITCH });
      if (client.getQueryData<{ enabled?: boolean }>(SWITCH)?.enabled === true) return false;
      if (!handOffDraft(AI_MOMENT_DRAFT_KEY, words)) return false;
      router.push('/app/moments');
      return true;
    },
    [client, router],
  );
}
