'use client';

// "Invite your neighbors" on "Verified homes nearby" and on Place (founder
// decision 2026-11-07): the person's own invite link (/join/:code) opens the
// /start funnel under their name and credits them; the bare /start stands in
// until it has loaded. Read ahead of the tap: Safari drops the share sheet's
// user gesture across a slow await.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';

const INVITE_TEXT =
  'See what’s true about your address — records, risks, and who’s verified nearby. Free, no account:';

export function useNeighborInvite() {
  const [copied, setCopied] = useState(false);
  const inviteQuery = useQuery({
    queryKey: ['users', 'invite-code'],
    queryFn: () => api.getInviteCode(),
    staleTime: 60 * 60_000,
    retry: 1,
  });
  const inviteUrl = inviteQuery.data?.invite_url || 'https://pantopus.com/start';

  const share = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Pantopus', text: INVITE_TEXT, url: inviteUrl });
        return;
      }
    } catch {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(`${INVITE_TEXT} ${inviteUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — nothing else to do
    }
  };

  return { share, copied };
}
