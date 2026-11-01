'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { Post } from '@pantopus/api';
import { extractApiError } from '@pantopus/ui-utils';
import { toast } from '@/components/ui/toast-store';
import { patchPostInFeedCaches } from '@/hooks/useFeedData';

/**
 * Whether one of your posts can be pinned to your profile: it has to show there (not a plan's post or one hidden from
 * your profile, and not written for a business), as the server checks. A pinned one can always be unpinned.
 */
export function canOfferProfilePin(post: Pick<Post, 'profile_pinned' | 'show_on_profile' | 'profile_visibility_scope' | 'post_as'>): boolean {
  if (typeof post.profile_pinned !== 'boolean') return false;
  if (post.profile_pinned) return true;
  return post.show_on_profile !== false && post.profile_visibility_scope !== 'hidden' && post.post_as !== 'business';
}

/**
 * "Pin to profile" / "Unpin from profile" for one of your own posts (up to 3 show in your profile's Pinned row). The
 * post changes wherever it is kept (the feeds, its own page) and your Pinned row reads again. A refusal shows the
 * server's sentence, e.g. a 4th pin: "You can pin up to 3 posts. Unpin one first." Resolves to whether it worked.
 */
export function useProfilePin() {
  const queryClient = useQueryClient();
  return useCallback(async (post: Pick<Post, 'id' | 'user_id' | 'author_user_id'>, pin: boolean): Promise<boolean> => {
    try {
      if (pin) await api.posts.pinPostToProfile(post.id);
      else await api.posts.unpinPostFromProfile(post.id);
    } catch (err: unknown) {
      toast.error(extractApiError(err, pin ? 'Couldn’t pin this post. Try again.' : 'Couldn’t unpin this post. Try again.'));
      return false;
    }
    patchPostInFeedCaches(queryClient, post.id, { profile_pinned: pin });
    const owner = post.author_user_id || post.user_id;
    if (owner) void queryClient.invalidateQueries({ queryKey: ['people', String(owner), 'pinned'] });
    toast.success(pin ? 'Pinned to your profile' : 'Unpinned from your profile');
    return true;
  }, [queryClient]);
}
