import type { MetadataRoute } from 'next';

// Without this file /robots.txt fell through to the /[username] profile route
// and answered with an HTML page. Only the Vercel production deployment is
// indexable; staging, previews and local builds ask crawlers to stay out.
// Signed-in pages and link-token pages (status, guest passes, invitations,
// verification) are never crawled.
const PRIVATE_PATHS = [
  '/app/', '/api/', '/auth/', '/dev/', '/status/', '/guest/', '/invite/', '/join/',
  '/verify-claim/', '/verify-residency/', '/session/', '/shared/', '/unlisted/', '/book/o/',
];

export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return { rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS } };
}
