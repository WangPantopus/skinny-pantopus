import { buildCanonicalShareUrlForPost } from '@pantopus/utils';

/** Preserve native cancel; fall back to a copied link when native sharing is unavailable. */
export async function sharePostLink(post: {
  id: string;
  title?: string | null;
  content?: string | null;
  ref_task_id?: string | null;
  ref_listing_id?: string | null;
}): Promise<boolean> {
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
