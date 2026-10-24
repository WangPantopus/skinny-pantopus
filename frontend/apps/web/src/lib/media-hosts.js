// Where uploaded media (avatars, post, chat and listing photos, documents) is
// served from: Pantopus's own storage only. next.config.js builds the image
// optimizer's allowed hosts and the CSP's object-src from this list, and the
// feed decides between next/image and a plain <img> with it, so the three never
// disagree. Before this list the optimizer fetched any *.amazonaws.com,
// *.cloudfront.net or *.supabase.co address for anyone, at Pantopus's cost.
// CommonJS on purpose: next.config.js requires it before anything is compiled.

/** @typedef {{ hostname: string, pathPrefix?: string }} MediaSource */

/** @type {MediaSource[]} */
const MEDIA_SOURCES = [
  // Production and staging: Supabase Storage (AWS_CLOUDFRONT_URL is the
  // project's /storage/v1/object/public/pantopus-uploads; private buckets hand
  // out signed /storage/v1/object/sign/ links).
  { hostname: 'falmvysvndmwtfxsrxek.supabase.co', pathPrefix: '/storage/v1/object/' },
  { hostname: 'ptudkfqdhqpkbkzqlabu.supabase.co', pathPrefix: '/storage/v1/object/' },
  // The older dev project and its AWS bucket behind CloudFront.
  { hostname: 'gzzdqechcbfpalfvgyro.supabase.co', pathPrefix: '/storage/v1/object/' },
  { hostname: 'd17q91nbcz20e.cloudfront.net' },
  { hostname: 'pantopus-uploads-dev.s3.us-west-2.amazonaws.com' },
  // The bucket the backend names when no CDN address is set (backend/config/aws.js).
  { hostname: 'pantopus-uploads.s3.us-west-2.amazonaws.com' },
];

/** `images.remotePatterns` entries for next.config.js. */
function mediaRemotePatterns() {
  return MEDIA_SOURCES.map(({ hostname, pathPrefix }) => (
    pathPrefix ? { protocol: 'https', hostname, pathname: `${pathPrefix}**` } : { protocol: 'https', hostname }
  ));
}

/** CSP source expressions; a path ending in "/" admits everything under it. */
function mediaCspSources() {
  return MEDIA_SOURCES.map(({ hostname, pathPrefix }) => `https://${hostname}${pathPrefix || ''}`);
}

/** True for an https address on Pantopus's own storage (the hosts and paths above). */
function isPantopusMediaUrl(src) {
  let url;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && MEDIA_SOURCES.some(({ hostname, pathPrefix }) => (
    url.hostname === hostname && (!pathPrefix || url.pathname.startsWith(pathPrefix))
  ));
}

module.exports = { MEDIA_SOURCES, mediaRemotePatterns, mediaCspSources, isPantopusMediaUrl };
