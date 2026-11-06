import type { Audience } from '@pantopus/types';

// A device fix is the evidence that someone is at the place they post to, and the server takes one for 5 minutes
// (`canPostToPlace`). Writing a post can take longer, so a fix this old is asked for again when the post is sent.
const FIX_STALE_MS = 3 * 60 * 1000;
// As the apps.
const NEW_FIX_WAIT_MS = 3000;

type PostWithFix = { audience?: Audience; gpsTimestamp?: string; gpsLatitude?: number; gpsLongitude?: number };

/** The post with a new device fix if the one it carries has gone stale. Without a new one, it keeps the old one. */
export async function withFreshFix<Post extends PostWithFix>(post: Post): Promise<Post> {
  // A Connections post has no place to prove, though the feed's fix goes with it.
  if (!post.gpsTimestamp || post.audience === 'connections' || !navigator.geolocation) return post;
  if (Date.now() - Date.parse(post.gpsTimestamp) < FIX_STALE_MS) return post;

  const fix = await new Promise<GeolocationPosition | null>((resolve) => {
    // Its own timer too: the browser's timeout doesn't count the time a permission question stays open.
    setTimeout(() => resolve(null), NEW_FIX_WAIT_MS);
    // No high accuracy: a quick answer matters here, and the check allows 5 km.
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: NEW_FIX_WAIT_MS });
  });
  if (!fix) return post;
  return {
    ...post,
    // The time of the answer, like "Use current location" and the apps: a device can answer with its last reading,
    // whose own time can be minutes old though the person hasn't moved.
    gpsTimestamp: new Date().toISOString(),
    gpsLatitude: fix.coords.latitude,
    gpsLongitude: fix.coords.longitude,
  };
}
