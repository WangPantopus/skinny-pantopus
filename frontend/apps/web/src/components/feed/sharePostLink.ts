import { buildCanonicalShareUrlForPost } from '@pantopus/utils';
import * as api from '@pantopus/api';

type PostShareAccess = {
  read_scope?: string | null;
  visibility?: string | null;
  audience?: string | null;
  allow_external_share?: boolean | null;
  moderation_state?: string | null;
  archive_reason?: string | null;
};

export function canSharePost(post: PostShareAccess): boolean {
  if (post.audience === 'household' || post.allow_external_share === false
    || post.archive_reason === 'moderation'
    || (post.moderation_state != null && post.moderation_state !== 'live')) return false;
  return post.read_scope != null ? post.read_scope === 'public'
    : post.visibility === 'public' || post.audience === 'public';
}

/** Preserve native cancel; fall back to a copied link when native sharing is unavailable. */
export async function sharePostLink(post: PostShareAccess & {
  id: string;
  title?: string | null;
  content?: string | null;
  ref_task_id?: string | null;
  ref_listing_id?: string | null;
}): Promise<boolean> {
  if (!canSharePost(post) || !(await api.posts.checkPostSharePermission(post.id)).canShare) {
    throw new Error("This post can't be shared outside Pantopus.");
  }
  const url = buildCanonicalShareUrlForPost(post);
  if (navigator.share) {
    try {
      await navigator.share({ title: post.title || 'Post', text: post.content?.slice(0, 120), url });
      return true;
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') return false;
    }
  }
  await navigator.clipboard.writeText(url);
  return true;
}
